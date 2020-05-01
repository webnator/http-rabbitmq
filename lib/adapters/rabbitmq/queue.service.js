'use strict';

const {
  defaults: {
    generalConfig: defaultGeneralConfig,
    retryConfig: defaultRetryConfig,
    exchangeConfig: defaultExchangeConfig,
    publishConfig: defaultPublishConfig,
    consumeConfig: defaultConsumeConfig,
  },
  methodName: queueMethodName,
} = require('./../../config');

const modelHTTPPublishRequest = require('./models/http.publish.model');
const modelHTTPQueueRequest = require('./models/http.request.model');

module.exports = ({
  queueAdapter,
  logger,
  delay,
}) => class RabbitQueueService {
  constructor(config, { retryConfig, exchangeConfig } = {}) {
    this.channel = null;
    this.connection = null;
    this.config = Object.assign({}, config, defaultGeneralConfig);
    this.extraConfig = {
      retryConfig: Object.assign({}, retryConfig, defaultRetryConfig),
      exchangeConfig: Object.assign({}, exchangeConfig, defaultExchangeConfig),
    };
    this.exchange = {
      name: this.config.exchange,
      config: this.extraConfig.exchangeConfig,
    };
    this.routes = [];
    this.status = {
      isConnecting: false,
      isClosing: false,
    };
  }

  async connect() {
    this._connecting();
    const { channel, connection } = await queueAdapter.connect(this.config);
    this.channel = channel;
    this.connection = connection;
    this._finishedConnecting();
    this._setConnectionErrorProcedure();
  }

  async publishToTopic({ key, body }, publishOptions) {
    return this._publishRetry({ key, body }, publishOptions);
  }

  async publishHTTPToTopic(key, { payload, headers, query, params }, publishOptions) {
    const body = modelHTTPPublishRequest(payload, headers, query, params);
    return this.publishToTopic({ key, body }, publishOptions);
  }

  async close() {
    if (this.connection) {
      this.status.isClosing = true;
      await this._closeConnection();
    }
  }

  async register(routes) {
    this._validateRoutes(routes);
    this.routes = routes;
    await this._setRoutesHandlers();
  }

  async _setRoutesHandlers() {
    const clogger = logger.child({ file: __filename, method: '_consumeQueue'});
    clogger.info('Registering ' + this.routes.length + ' routes');
    for (const route of this.routes) {
      await queueAdapter.consume(this.channel, this.exchange, {
        queue: route.queue,
        topic: route.topic,
        config: Object.assign({}, route.opts, defaultConsumeConfig),
        callback: (message) => this._messageHandlerForRoute(route, message)
      });
    }
  }

  async _messageHandlerForRoute(route, message) {
    const { request, raw } = modelHTTPQueueRequest(route.topic, queueMethodName, message);

    const myReplyFn = (responseBody) => this._replyFunction(responseBody, {
      message,
      raw,
      request,
    });
    myReplyFn.response = myReplyFn;

    try {
      route.handler(request, myReplyFn);
    } catch (error) {
      logger.error({ error }, 'Error executing handler. Sending to error queue');
      try {
        await this._publishToErrorQueue(raw, error);
        queueAdapter.ack(this.channel, message);
      } catch (handlingError) {
        logger.fatal({ error: handlingError }, 'Unhandled error while publishing to the error queue')
      }
    }
  }

  // REVIEW: ADD ASYNOP counter
  _replyFunction(responseBody, { message, raw, request }) {
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
          queueAdapter.ack(this.channel, message);
          break;
        case 4: //4xx status codes
          logger.info(loggerData, loggerMessage);
          this._publishToErrorQueue(raw, responseBody);
          queueAdapter.ack(this.channel, message);
          break;
        case 5: //5xx status codes
          logger.warn(loggerData, loggerMessage);
          if (raw.headers && raw.headers['X-TimesResent'] !== undefined && !isNaN(parseInt(raw.headers['X-TimesResent']))) {
            raw.headers['X-TimesResent']++;
          } else {
            raw.headers = raw.headers || {};
            raw.headers['X-TimesResent'] = 0;
          }

          queueAdapter.ack(this.channel, message);

          setTimeout(() => {
            if (raw.headers['X-TimesResent'] >= this.config.maxRetries) {
              logger.error(loggerData, '500 after max retries Sending to error queue');
              return this._publishToErrorQueue(raw, responseBody);
            }
            logger.warn(loggerData, '500 Re-queueing for the ' + raw.headers['X-TimesResent'] + ' time');
            this.publishToTopic({
              key: message.fields.routingKey,
              msg: raw,
            });
          }, this.config.timeBetweenRetries);

          break;
        default:
          logger.error(loggerData, 'Unknown response Sending to error queue');
          this._publishToErrorQueue(raw, responseBody);
          queueAdapter.ack(this.channel, message);
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

  async _publishToErrorQueue(body, responseData) {
    if (responseData instanceof Error) {
      body.response = responseData.message;
    } else {
      body.response = responseData;
    }

    await queueAdapter.publish(this.channel, this.exchange, {
      key: this.config.errorTopic,
      body,
      config: Object.assign({}, defaultPublishConfig)
    });
  }

  _validateRoutes(routes) {
    if (!Array.isArray(routes)) { throw new Error(`KO Error while registering route: Wrong route object. Object: ${routes}`); }
    for (const route of routes) {
      if (!route || !route.topic || typeof route.topic !== 'string' || !route.handler || typeof route.handler !== 'function') {
        throw new Error(`KO Error while registering route: Wrong route object. Object: ${JSON.stringify(route)}`);
      }
    }
  }

  _connecting() {
    this.status.isConnecting = true;
  }

  _finishedConnecting() {
    this.status.isConnecting = false;
    this.status.isClosing = false;
  }

  _setConnectionErrorProcedure() {
    this.connection.once('exit', err => this._errorHandler(err, 'exit'));
    this.connection.once('close', err => this._errorHandler(err, 'close'));
    this.connection.on('error', err => this._errorHandler(err, 'error'));
  }

  async _closeConnection() {
    // TODO queueRouter.cleanRoutes();
    // TODO!!!! await queue.cancelConsumers();
    await this.channel.close();
    await this.connection.close();
  }

  async _errorHandler(err, type) {
    const mLogger = logger.child({file: __filename, method: 'errorHandler'});
    mLogger.warn({ err, type }, `Handling error: ${type}`);
    try {
      await this._closeConnection();
    } catch (e) {
      mLogger.warn({err: e}, 'Error tearing down previous connection');
    }
    if (this.status.isClosing === false && this.status.isConnecting === false) {
      mLogger.info('Reconnecting');
      await this.connect();
    }
  }

  async _publishRetry({ key, body }, publishOptions) {
    const retryConfig = this.extraConfig.retryConfig;
    const mLogger = logger.child({file: __filename, method: 'publishRetry' });
    for (let i = 0; i < retryConfig.retries; i++) {
      mLogger.debug('Trying for the: ' + (i + 1) + ' time');
      try {
        await queueAdapter.publish(this.channel, this.exchange, {
          key,
          body,
          config: Object.assign({}, publishOptions, defaultPublishConfig)
        });
        return;
      } catch (err) {
        mLogger.debug({ key, body, err }, 'Failed for the: ' + (i + 1) + ' time');
      }
      await delay(retryConfig.time);
    }
    mLogger.error('Failed after:' + retryConfig.retries + ' times');
    throw new Error('Failed after: ' + retryConfig.retries + ' times');
  }

};