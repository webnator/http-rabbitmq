'use strict';

const config = require('./config');
const Message = require('./Message');

function makeService(deps) {
  const {
    amqp,
    hoek,
    GlobalService,
    delayLib,
    logger
  } = deps;

  let queueConfig, amqpConnection, exchangeConfig, queueConsumeConfig, publisherConfig, retryConfig;
  let consumers = [];

  function setConnectionConfig() {
    queueConfig = GlobalService.getConfigValue(config.configVariable);
    hoek.assert(queueConfig, 'Queue Configuration not defined');
    amqpConnection = 'amqp://' + queueConfig.user + ':' + queueConfig.pass + '@' + queueConfig.host + ':' + queueConfig.port + '/' + queueConfig.vhost;
    exchangeConfig = GlobalService.getConfigValue(config.exchangeConfigVariable);
    queueConsumeConfig = GlobalService.getConfigValue(config.queueConsumeConfigVariable);
    publisherConfig = GlobalService.getConfigValue(config.publisherConfigVariable);
    retryConfig = GlobalService.getConfigValue(config.retryConfigVariable);
  }

  let connection, channel;

  /**
   * Asserts the exchanges and queues in rabbit
   * @param {String} queue - The key of the queue to be asserted and binded
   * @param {String} topic - The topic of the queue to be asserted and binded
   * @returns {Promise<*>}
   */
  async function assertQueueAndExchanges(queue, topic) {
    const mLogger = logger.child({file: __filename, method: 'assertQueueAndExchanges'});
    mLogger.debug('Accessing');
    await channel.assertExchange(queueConfig.exchange, 'topic', exchangeConfig);
    await channel.assertExchange(queueConfig.exchange + '_delayed', 'x-delayed-message', Object.assign({}, exchangeConfig, {
      arguments: {'x-delayed-type': 'topic'}
    }));
    const bindedQueue = await createAndBindQueue(queue, topic);
    mLogger.debug('End');
    return bindedQueue;
  }

  /**
   * Creates a queue and bings a topic to it. If the topic is not defined, binds it to the same name of the queue
   * @param {String} queueKey - The queue name
   * @param {String} [topic] - The topic to bind. Optional, if it's not defined topic is the same as queue
   * @returns {Promise<*>}
   */
  async function createAndBindQueue(queueKey, topic) {
    const mLogger = logger.child({file: __filename, method: 'createAndBindQueue'});
    mLogger.debug('Accessing');
    topic = topic || queueKey;
    const {queue} = await channel.assertQueue(queueKey);
    await channel.bindQueue(queue, queueConfig.exchange, topic);
    await channel.bindQueue(queue, queueConfig.exchange + '_delayed', topic);
    mLogger.debug('End');
    return queue;
  }

  /**
   * Formats a HTTP request
   * @param {Object} payload - The object of payload
   * @param {Object} headers - The object of headers
   * @param {Object} query - The object of query
   * @param {Object} params - The object of params
   * @returns {{headers: *|{}, payload: *|{}, query: *|{}, params: *|{}}}
   */
  function createHTTPRequest(payload, headers, query, params) {
    return {
      headers: headers || {},
      payload: payload || {},
      query: query || {},
      params: params || {}
    };
  }

  return {
    get connection() {
      return connection;
    },

    get channel() {
      return channel;
    },

    createAndBindQueue,
    async connect() {
      const mLogger = logger.child({file: __filename, method: 'connect'});
      mLogger.debug('Accessing');
      setConnectionConfig();
      // TODO check if the connection and channel exist and are alive, and if so, return them
      // Else
      // TODO set a max connection retry
      while (true) { // eslint-disable-line no-constant-condition
        try {
          connection = await amqp.connect(amqpConnection);
          channel = await connection.createChannel();
          mLogger.info('Connected correctly to RabbitQueue');
          return;
        } catch (err) {
          mLogger.error({err}, 'KO Retrying');
          await delayLib(queueConfig.reconnectionTime);
        }
      }
    },

    async consume(queue, topic, callback) {
      queue = queue || topic;
      const rabQueue = await assertQueueAndExchanges(queue, topic);
      let consumer = await channel.consume(rabQueue, callback, queueConsumeConfig);
      consumers.push(consumer);
    },

    ack(msg) {
      if (channel) {
        channel.ack(msg);
      }
    },

    async publish({ key, msg, delay, traceId }) {
      const mLogger = logger.child({file: __filename, method: 'publish', traceId});
      mLogger.info('Accessing');
      const message = new Message(msg);

      let exchange = queueConfig.exchange;
      let publishConfig = publisherConfig;
      if (delay && parseInt(delay) > 0) {
        exchange = queueConfig.exchange + '_delayed';
        publishConfig = Object.assign({}, publishConfig, {headers: {'x-delay': parseInt(delay)}});
      }
      publishConfig.headers = Object.assign({}, publishConfig.headers, {'x-from': process.env.LOGGER_MS_NAME || 'unknown'});

      const reqLogger = logger.child({
        file: __filename,
        method: 'publish',
        traceId,
        target: {
          url: key,
          method: exchange,
          protocol: 'amqp',
        }
      });
      if (process.env.QUEUE_LOG_PAYLOAD && JSON.parse(process.env.QUEUE_LOG_PAYLOAD)) {
        reqLogger.debug({payload: msg}, 'Start publishing message');
      } else {
        reqLogger.debug('Start publishing message');
      }

      await assertQueueAndExchanges(key, key);

      const result = channel.publish(
        exchange,
        key,
        message.getStringBufferBody(),
        publishConfig
      );
      if (result) {
        reqLogger.info('Message was published');
      } else {
        reqLogger.error('Message not published');
        throw new Error('Message not published');
      }
    },

    async publishToErrorQueue(msg, responseData) {
      if (responseData instanceof Error) {
        msg.response = responseData.message;
      } else {
        msg.response = responseData;
      }

      await createAndBindQueue(queueConfig.errorQueue, queueConfig.errorTopic);
      return this.publish({ key: queueConfig.errorTopic, msg });
    },

    async publishRetry({ key, msg, delay, traceId }) {
      const mLogger = logger.child({file: __filename, method: 'publishRetry', traceId});
      let continue_flag = false;
      for (let i = 0; i < retryConfig.retries; i++) {
        mLogger.debug('Trying for the: ' + (i + 1) + ' time');
        continue_flag = false;
        await this.publish({key, msg, delay, traceId}).catch((err) => {
          mLogger.debug({ key, msg, err }, 'Failed for the: ' + (i + 1) + ' time');
          continue_flag = true;
        });
        if (continue_flag === false) {
          return;
        }
        await delayLib(retryConfig.time);
      }
      mLogger.error('Failed after:' + retryConfig.retries + ' times');
      throw new Error('Failed after: ' + retryConfig.retries + ' times');
    },

    publishHTTPToTopic(key, { payload, headers, query, params, traceId }) {
      let msg = createHTTPRequest(payload, headers, query, params);
      return this.publishToTopic({ key, msg, traceId });
    },

    publishDelayedHTTPToTopic(key, { payload, headers, query, params, traceId }, delay) {
      let msg = createHTTPRequest(payload, headers, query, params);
      return this.publishToTopic({ key, msg, delay, traceId });
    },

    publishToTopic({ key, msg, delay, traceId }) {
      return this.publishRetry({ key, msg, delay, traceId });
    },

    async cancelConsumers() {
      for (let i = 0; i < consumers.length; i++) {
        const consumer = consumers[i];
        try {
          await await channel.cancel(consumer.consumerTag);
        } catch (e) {
          throw new Error(e);
        }

      }
      consumers = [];
    }
  };
}

module.exports = makeService;