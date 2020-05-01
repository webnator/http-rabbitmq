'use strict';

const config = require('../../config');

function makeService(deps) {
  const {
    queueManager,
    globalService,
  } = deps;

  function setExchangeOptions(exchangeOptions) {
    globalService.setConfigValue(config.exchangeConfigVariable, Object.assign({}, config.defaultExchangeConfig, exchangeOptions));
  }

  function setConsumeQueueOptions(consumeQueueOptions) {
    globalService.setConfigValue(config.queueConsumeConfigVariable, Object.assign({}, config.defaultQueueConsumeConfig, consumeQueueOptions));
  }

  function setPublisherOptions(publisherOptions) {
    globalService.setConfigValue(config.publisherConfigVariable, Object.assign({}, config.defaultPublisherConfig, publisherOptions));
  }

  function setRetryOptions(retryOptions) {
    globalService.setConfigValue(config.retryConfigVariable, Object.assign({}, config.retryPolicy, retryOptions));
  }

  return {
    async start(routeFile) {
      queueManager.startRoutes(routeFile);
      await queueManager.connect();
      return queueManager;
    },

    setQueueOptions(queueOptions) {
      globalService.setConfigValue(config.configVariable, Object.assign({}, config.configDefaults, queueOptions));
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
