'use strict';

const config = require('./config');

function makeService(deps) {
  const {
    QueueManager,
    GlobalService,
  } = deps;

  function setExchangeOptions(exchangeOptions) {
    GlobalService.setConfigValue(config.exchangeConfigVariable, Object.assign({}, config.defaultExchangeConfig, exchangeOptions));
  }

  function setConsumeQueueOptions(consumeQueueOptions) {
    GlobalService.setConfigValue(config.queueConsumeConfigVariable, Object.assign({}, config.defaultQueueConsumeConfig, consumeQueueOptions));
  }

  function setPublisherOptions(publisherOptions) {
    GlobalService.setConfigValue(config.publisherConfigVariable, Object.assign({}, config.defaultPublisherConfig, publisherOptions));
  }

  function setRetryOptions(retryOptions) {
    GlobalService.setConfigValue(config.retryConfigVariable, Object.assign({}, config.retryPolicy, retryOptions));
  }

  return {
    async start(routeFile) {
      QueueManager.startRoutes(routeFile);
      await QueueManager.connect();
      return QueueManager;
    },

    setQueueOptions(queueOptions) {
      GlobalService.setConfigValue(config.configVariable, Object.assign({}, config.configDefaults, queueOptions));
    },

    setExtraOptions(extraOptions) {
      extraOptions = extraOptions || {};
      setExchangeOptions(extraOptions.exchangeOptions);
      setConsumeQueueOptions(extraOptions.queueOptions);
      setPublisherOptions(extraOptions.publisherOptions);
      setRetryOptions(extraOptions.retryOptions);
    }
  };
}

module.exports = makeService;
