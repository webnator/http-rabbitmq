'use strict';

module.exports = {
  configVariable: 'queueConfig',
  loggerConfigVariable: 'loggerConfig',
  exchangeConfigVariable: 'exchangeConfig',
  queueConsumeConfigVariable: 'queueConsumeConfig',
  publisherConfigVariable: 'publisherConfig',
  retryConfigVariable: 'retryConfig',
  methodName: 'QUEUE',
  defaultExchangeConfig: {
    durable: true
  },
  defaultQueueConsumeConfig: {
    noAck: false
  },
  defaultPublisherConfig: {
    persistent: true
  },
  retryPolicy: {
    retries: 10,
    time: 100
  },
  logPrefix: '[Queue Library]',
  configDefaults: {
    prefetch: 1,
    delaySeconds: 3000,
    reconnectionTime: 2000,
    maxRetries: 5,
    timeBetweenRetries: 3000
  }
};
