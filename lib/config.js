'use strict';
// TODO rename to config defaults
module.exports = {
  methodName: 'QUEUE',
  defaults: {
    exchangeConfig: {
      durable: true,
    },
    consumeConfig: {
      noAck: false,
    },
    publishConfig: {
      persistent: true,
    },
    retryConfig: {
      retries: 10,
      time: 100,
    },
    generalConfig: {
      prefetch: 1,
      delaySeconds: 3000,
      reconnectionTime: 2000,
      maxRetries: 5,
      timeBetweenRetries: 3000,
    }
  },

  logPrefix: '[http-queue]',
};
