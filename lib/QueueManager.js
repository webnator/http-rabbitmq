'use strict';

const uuid = require('uuid');
const config = require('./config');

function makeService(deps) {
  const {
    GlobalService,
    Queue,
    QueueRouter,
    logger
  } = deps;

  let isClosing = false;
  let isConnecting = false;

  async function setQueueConnection() {
    // Sets up a new queue instance
    isConnecting = true;
    await Queue.connect();
    isConnecting = false;
    isClosing = false;
    setConnectionErrorProcedure();
    await consumeQueue();
  }

  function setConnectionErrorProcedure() {
    Queue.connection.once('exit', err => errorHandler(err, 'exit'));
    Queue.connection.once('close', err => errorHandler(err, 'close'));
    Queue.connection.on('error', err => errorHandler(err, 'error'));
  }

  async function errorHandler(err, type) {
    const mLogger = logger.child({file: __filename, method: 'errorHandler'});
    mLogger.warn({err, type}, 'Handling error: ' + type);
    try {
      await Queue.cancelConsumers();
      await Queue.channel.close();
      await Queue.connection.close();
    } catch (e) {
      mLogger.warn({err: e}, 'Error tearing down previous connection');
    }
    if (isClosing === false && isConnecting === false) {
      mLogger.info('Reconnecting');
      await setQueueConnection();
    }
  }

  async function informWorkflow(request, status, body) {
    if (request.headers && request.headers['x-flowinformtopic']) {
      const maestro_response = {
        headers: Object.assign({}, request.headers, {
          'x-flowresponsecode': status,
          'x-flowtaskfinishedon': new Date(),
          'x-flowinformtopic': undefined
        }),
        payload: body,
        traceId: request.traceId
      };

      Queue.publishHTTPToTopic(request.headers['x-flowinformtopic'], maestro_response);
    }
  }

  async function consumeQueue() {
    let routes = QueueRouter.getRoutes();
    const clogger = logger.child({ file: __filename, method: '_consumeQueue'});
    clogger.info('Registering ' + routes.length + ' routes');
    for (let i = 0; i < routes.length; i++) {
      let route = routes[i];
      await Queue.consume(route.queue, route.topic, (message) => {
        let request = {};
        try {
          request = Object.assign({}, JSON.parse(message.content.toString()));
        } catch (err) {
          request = Object.assign({}, {queueMessage: message.content.toString()});
          clogger.warn({
            err,
            method: message.fields.exchange,
            url: route.topic,
            from: message.properties.headers['x-from'] || 'unknown'
          }, 'The message is not a JSON object. Sending as queueMessage');
        }

        const raw = Object.assign({}, request);
        if (!request.headers) {
          request.headers = {};
        }
        if (!request.headers['x-trace-id']) {
          clogger.warn({
            method: message.fields.exchange,
            url: route.topic,
            headers: request.headers,
            from: message.properties.headers['x-from'] || 'unknown',
          }, 'You should send the "x-trace-id" in the headers to keep the request traceability');
          request.headers['x-trace-id'] = uuid.v4();
        }
        request.payload = request.payload || {};
        request.method = config.methodName;
        request.path = route.topic;
        request.info = {received: Date.now()};
        logger.trace = request.headers['x-trace-id'];
        request.logger = logger.child({
          trace: request.headers['x-trace-id'],
          req: {
            id: uuid.v4(),
            raw: {
              req: {
                method: message.fields.exchange,
                url: route.topic,
                headers: request.headers,
                connection: {
                  remoteAddress: message.properties.headers['x-from'] || 'unknown'
                },
              },
            },
          },
        });

        Promise.resolve()
          .then(() =>
            route.handler(request, replyFunction.bind({
              message,
              raw,
              request,
              logger
            }))
          ).catch((err) => {
            request.logger.error({ err }, 'Error executing handler. Sending to error queue');

            informWorkflow(request, 500, { error: err.message });

            return Queue.publishToErrorQueue(raw, err).then(() => Queue.ack(message));
          }).catch(
            (err) => request.logger.fatal({err}, 'Unhandled error while publishing to the error queue')
          );
      });
    }
  }

  // REVIEW: ADD ASYNOP counter
  function replyFunction(responseBody) {
    const {request, raw} = this;
    request.info.responded = Date.now();
    let status = 200;
    let header = {};

    process.nextTick(() => {
      informWorkflow(request, status, responseBody);

      const loggerData = {
        payload: request.payload,
        res: {
          statusCode: status,
          header,
        },
        responseTime: request.info.responded - request.info.received,
      };
      const loggerMessage = 'Queue request completed';
      switch (parseInt(status.toString().charAt(0))) {
        case 2: //2xx status codes
          request.logger.info(loggerData, loggerMessage);
          Queue.ack(this.message);
          break;
        case 4: //4xx status codes
          request.logger.info(loggerData, loggerMessage);
          Queue.publishToErrorQueue(raw, responseBody);
          Queue.ack(this.message);
          break;
        case 5: //5xx status codes
          request.logger.warn(loggerData, loggerMessage);
          if (raw.headers && raw.headers['X-TimesResent'] !== undefined && !isNaN(parseInt(raw.headers['X-TimesResent']))) {
            raw.headers['X-TimesResent']++;
          } else {
            raw.headers = raw.headers || {};
            raw.headers['X-TimesResent'] = 0;
          }

          Queue.ack(this.message);

          setTimeout(() => {
            if (raw.headers['X-TimesResent'] >= GlobalService.getConfigValue(config.configVariable).maxRetries) {
              request.logger.error(loggerData, '500 after max retries Sending to error queue');
              return Queue.publishToErrorQueue(raw, responseBody);
            }
            request.logger.warn(loggerData, '500 Re-queueing for the ' + raw.headers['X-TimesResent'] + ' time');
            Queue.publish({
              key: this.message.fields.routingKey,
              msg: raw,
            });
          }, GlobalService.getConfigValue(config.configVariable).timeBetweenRetries);

          break;
        default:
          request.logger.error(loggerData, 'Unknown response Sending to error queue');
          Queue.publishToErrorQueue(raw, responseBody);
          Queue.ack(this.message);
          break;
      }
    });

    return {
      code(code) {
        status = code;
        return this;
      },
      header(key, value) {
        header[key] = value;
        return this;
      }
    };
  }

  return {
    startRoutes(routeFile) {
      routeFile(QueueRouter);
    },

    connect() {
      return setQueueConnection();
    },

    getQueue() {
      return Queue;
    },

    async close() {
      if (Queue && Queue.connection) {
        isClosing = true;
        QueueRouter.cleanRoutes();
        // Queue.connection.on('close', () => {});
        await Queue.connection.close();
      }
    }
  };
}

module.exports = makeService;
