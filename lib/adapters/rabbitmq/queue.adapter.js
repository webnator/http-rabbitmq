'use strict';

const Message = require('./Message');

module.exports = ({
  logger,
  delay,
  amqp
}) => {

  async function assertQueueAndExchanges(channel, exchange, { queue, topic }) {
    const mLogger = logger.child({file: __filename, method: 'assertQueueAndExchanges'});
    mLogger.debug('Accessing');
    await channel.assertExchange(exchange.name, 'topic', exchange.config);
    const bindedQueue = await createAndBindQueue(channel, { exchangeName: exchange.name, queue, topic });
    mLogger.debug('End');
    return bindedQueue;
  }

  async function createAndBindQueue(channel, { exchangeName, queue: queueName, topic }) {
    const mLogger = logger.child({file: __filename, method: 'createAndBindQueue'});
    mLogger.debug('Accessing');
    topic = topic || queueName;
    const {queue} = await channel.assertQueue(queueName);
    await channel.bindQueue(queue, exchangeName, topic);
    mLogger.debug('End');
    return queue;
  }

  return {
    async connect(queueConfig) {
      const mLogger = logger.child({file: __filename, method: 'connect'});
      mLogger.debug('Accessing');
      let channel;
      while (true) { // eslint-disable-line no-constant-condition
        try {
          const amqpConnection = `amqp://${queueConfig.user}:${queueConfig.pass}@${queueConfig.host}:${queueConfig.port}/${queueConfig.vhost}`;
          const connection = await amqp.connect(amqpConnection);
          channel = await connection.createChannel();
          mLogger.info('Connected correctly to RabbitQueue');
          return { channel, connection };
        } catch (err) {
          mLogger.error({ err }, 'KO Retrying');
          await delay(queueConfig.reconnectionTime);
        }
      }
    },
    async publish(channel, exchange, message) {
      const mLogger = logger.child({ file: __filename, method: 'publish', target: { url: message.key, method: exchange.name, protocol: 'amqp' } });
      mLogger.info('Accessing');
      const messageObj = new Message(message.body);

      message.config.headers = Object.assign({}, message.config, { 'x-from': process.env.LOGGER_MS_NAME || 'unknown' });

      await assertQueueAndExchanges(channel, exchange, { queue: message.key, topic: message.key });

      const result = channel.publish(
        exchange.name,
        message.key,
        messageObj.getStringBufferBody(),
        message.config
      );
      if (result) {
        mLogger.info('Message was published');
      } else {
        mLogger.error('Message not published');
        throw new Error('Message not published');
      }
    },
    async consume(channel, exchange, { queue, topic, config = {}, callback}) {
      queue = queue || topic;
      const rabQueue = await assertQueueAndExchanges(channel, exchange, { queue, topic });
      return channel.consume(rabQueue, callback, config);
    },

    ack(channel, msg) {
      if (channel) {
        channel.ack(msg);
      }
    }

  };
};
