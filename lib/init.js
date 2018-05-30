'use strict';

function makeService(deps) {
  const {
    QueueService,
    ValidatorService,
    logger,
    QueueManager
  } = deps;

  return {
    /**
     * Set the initial configuration for the library
     * @param {Object} queueConfig - The queue configuration object
     * @param {Object} [extraOptions] - The extra options for library configuration
     * @param {Object} [extraOptions.exchangeOptions] - The exchange configuration object that overrides the defaults
     * @param {Object} [extraOptions.queueOptions] - The consumerQueue configuration object that overrides the defaults
     * @param {Object} [extraOptions.publisherOptions] - The publisher configuration object that overrides the defaults
     * @param {Object} [extraOptions.retryOptions] - The publishing retry policy options that overrides the defaults
     * @param {Object} routes - The file with all routes declared
     */
    async create({queueConfig, extraOptions, routes}) {
      let configValidation = ValidatorService.validateConfigSchema(queueConfig);
      if(configValidation.error !== null) { throw 'Bad configuration object: ' + JSON.stringify(configValidation.error.details); }

      QueueService.setQueueOptions(configValidation.value);
      QueueService.setExtraOptions(extraOptions);

      const qm = await QueueService.start(routes);
      logger.info('Queue library initialized correctly');

      return {
        publish: (key, msg) => qm.getQueue().publishToTopic({ key, msg }),
        publishHTTP: (key, msg) => qm.getQueue().publishHTTPToTopic(key, msg),
        publishDelayedHTTP: (key, msg, delay) => qm.getQueue().publishDelayedHTTPToTopic(key, msg, delay),
        setQueueOptions: (queueOptions) => QueueService.setQueueOptions(queueOptions),
        closeConnection: () => qm.close(),
        queueManager: QueueManager
      };
    }
  };
}

module.exports = makeService;
