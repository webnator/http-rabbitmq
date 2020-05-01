'use strict';

const config = require('../../config');

function makeService(deps) {
  const {
    globalService,
    queue,
    queueRouter,
    logger
  } = deps;

  let isClosing = false;
  let isConnecting = false;

  async function setQueueConnection() {
    // Sets up a new queue instance
    isConnecting = true;
    await queue.connect();
    isConnecting = false;
    isClosing = false;
    setConnectionErrorProcedure();
    await consumeQueue();
  }

  function setConnectionErrorProcedure() {
    queue.connection.once('exit', err => errorHandler(err, 'exit'));
    queue.connection.once('close', err => errorHandler(err, 'close'));
    queue.connection.on('error', err => errorHandler(err, 'error'));
  }

  async function errorHandler(err, type) {
    const mLogger = logger.child({file: __filename, method: 'errorHandler'});
    mLogger.warn({err, type}, 'Handling error: ' + type);
    try {
      await queue.cancelConsumers();
      await queue.channel.close();
      await queue.connection.close();
    } catch (e) {
      mLogger.warn({err: e}, 'Error tearing down previous connection');
    }
    if (isClosing === false && isConnecting === false) {
      mLogger.info('Reconnecting');
      await setQueueConnection();
    }
  }

  async function consumeQueue() {
    let routes = queueRouter.getRoutes();
    const clogger = logger.child({ file: __filename, method: '_consumeQueue'});
    clogger.info('Registering ' + routes.length + ' routes');
    for (let i = 0; i < routes.length; i++) {
      let route = routes[i];
      await queue.consume(route.queue, route.topic, (message) => {
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

        request.payload = request.payload || {};
        request.headers = request.headers || {};
        request.method = config.methodName;
        request.path = route.topic;
        request.info = { received: Date.now() };

        const myReplyFn = replyFunction.bind({
          message,
          raw,
          request,
          logger
        });
        myReplyFn.response = myReplyFn;

        Promise.resolve()
          .then(() =>
            route.handler(request, myReplyFn))
          .catch((err) => {
            logger.error({ err }, 'Error executing handler. Sending to error queue');
            return queue.publishToErrorQueue(raw, err).then(() => queue.ack(message));
          }).catch(
            (err) => logger.fatal({err}, 'Unhandled error while publishing to the error queue')
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
          logger.info(loggerData, loggerMessage);
          queue.ack(this.message);
          break;
        case 4: //4xx status codes
          logger.info(loggerData, loggerMessage);
          queue.publishToErrorQueue(raw, responseBody);
          queue.ack(this.message);
          break;
        case 5: //5xx status codes
          logger.warn(loggerData, loggerMessage);
          if (raw.headers && raw.headers['X-TimesResent'] !== undefined && !isNaN(parseInt(raw.headers['X-TimesResent']))) {
            raw.headers['X-TimesResent']++;
          } else {
            raw.headers = raw.headers || {};
            raw.headers['X-TimesResent'] = 0;
          }

          queue.ack(this.message);

          setTimeout(() => {
            if (raw.headers['X-TimesResent'] >= globalService.getConfigValue(config.configVariable).maxRetries) {
              logger.error(loggerData, '500 after max retries Sending to error queue');
              return queue.publishToErrorQueue(raw, responseBody);
            }
            logger.warn(loggerData, '500 Re-queueing for the ' + raw.headers['X-TimesResent'] + ' time');
            queue.publish({
              key: this.message.fields.routingKey,
              msg: raw,
            });
          }, globalService.getConfigValue(config.configVariable).timeBetweenRetries);

          break;
        default:
          logger.error(loggerData, 'Unknown response Sending to error queue');
          queue.publishToErrorQueue(raw, responseBody);
          queue.ack(this.message);
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
      routeFile(queueRouter);
    },

    connect() {
      return setQueueConnection();
    },

    getQueue() {
      return queue;
    },

    async close() {
      if (queue && queue.connection) {
        isClosing = true;
        queueRouter.cleanRoutes();
        await queue.connection.close();
      }
    }
  };
}

module.exports = makeService;
