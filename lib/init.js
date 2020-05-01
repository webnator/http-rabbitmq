'use strict';

module.exports = ({
  queueService,
  validatorService,
  logger
}) => async ({ queueConfig, extraOptions }) => {
  const { value: config, error } = validatorService.validateConfigSchema(queueConfig);
  if (error !== null) { throw 'Bad configuration object: ' + JSON.stringify(error.details); }

  const queue = new queueService(config, extraOptions);
  await queue.connect();

  logger.info('Queue library initialized correctly');

  return {
    publish: (key, message, opts) => queue.publishToTopic({ key, body: message }, opts),
    publishHTTP: (key, message, opts) => queue.publishHTTPToTopic(key, message, opts),
    register: (routes) => queue.register(routes),
    // initialize: (topics) => qm.getQueue().initializeTopics(topics),
    close: () => queue.close(),
  };
};

// /**
//  * Set the initial configuration for the library
//  * @param {Object} queueConfig - The queue configuration object
//  * @param {Object} [extraOptions] - The extra options for library configuration
//  * @param {Object} [extraOptions.exchangeOptions] - The exchange configuration object that overrides the defaults
//  * @param {Object} [extraOptions.queueOptions] - The consumerQueue configuration object that overrides the defaults
//  * @param {Object} [extraOptions.publisherOptions] - The publisher configuration object that overrides the defaults
//  * @param {Object} [extraOptions.retryOptions] - The publishing retry policy options that overrides the defaults
//  * @param {Object} routes - The file with all routes declared
//  */
// async create({ queueConfig, extraOptions, routes }) {
//   const { value: config, error } = validatorService.validateConfigSchema(queueConfig);
//   if (error !== null) { throw 'Bad configuration object: ' + JSON.stringify(error.details); }

//   queueService.setQueueOptions(config);
//   queueService.setExtraOptions(extraOptions);

//   const qm = await queueService.start(routes);
//   logger.info('Queue library initialized correctly');

//   return {
//     publish: (key, msg) => qm.getQueue().publishToTopic({ key, msg }),
//     publishHTTP: (key, msg) => qm.getQueue().publishHTTPToTopic(key, msg),
//     close: () => qm.close()
//   };
// },

/**
 * Set the initial configuration for the library
 * @param {Object} queueConfig - The queue configuration object
 * @param {Object} [extraOptions] - The extra options for library configuration
 * @param {Object} [extraOptions.retryOptions] - The publishing retry policy options that overrides the defaults
 */

/*
routes = [
  {
    queue: optional string (for rabbitmq only)
    topic: string required
    handler: func required
    opts: object, depends on adapter
      * rabbitMQ
        exchangeOptions
        queueOptions
        publisherOptions
      * PubSub
        TBD
      * SQS
        TBD
  }
]
*/
// async register(routes) {
//   logger.info('Registering routes', { topics: routes.map(route => route.topic) });

//   await Promise.all(routes.map(route =>
//     subscriptionService.registerTopic(route).catch(err => {
//       logger.error('Error registering handler for topic', { topic: route.topic, error: err.message });
//       // For now we'll kill the process to make sure messages don't get stalled, we need to revisit this soon
//       process.exit(1);
//     }))
//   );

//   logger.info('Finished registering routes', { topics: routes.map(route => route.topic) });
// },

// async initializeTopics(topics) {
//   logger.info('Initializing topics', { topics });

//   await Promise.all(topics.map(topic =>
//     pubSubService.createTopicIfNotExists(topic).catch(err =>
//       logger.error('Error initializing topic', { topic, error: err.message })
//     ))
//   );
//   logger.info('Finished initializing topics', { topics });
// }
