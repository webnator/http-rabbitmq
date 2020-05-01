'use strict';

const awilix = require('awilix');
const { createContainer, asFunction, asValue } = awilix;

const container = createContainer();

// Libs
const amqp = require('amqplib');
const hoek = require('hoek');
const delay = require('delay');
const pino = require('pino');

// General Services
const globalService = require('./services/global.service');
const validatorService = require('./services/validator.service');

// General
const init = require('./init');

const queue = require('./adapters/rabbitmq/queue');
const queueManager = require('./adapters/rabbitmq/queueManager');
const queueRouter = require('./adapters/rabbitmq/queueRouter');
const queueService = require('./adapters/rabbitmq/queue.service');
const queueAdapter = require('./adapters/rabbitmq/queue.adapter');

container.register({
  // Libs
  logger: asValue(pino({ level: 'info' })),
  amqp: asValue(amqp),
  hoek: asValue(hoek),
  delay: asValue(delay),

  // services
  globalService: asFunction(globalService).singleton(),
  validatorService: asFunction(validatorService).singleton(),

  // General
  init: asFunction(init).singleton(),
  queue: asFunction(queue).singleton(),
  queueManager: asFunction(queueManager).singleton(),
  queueRouter: asFunction(queueRouter).singleton(),
  queueService: asFunction(queueService).singleton(),
  queueAdapter: asFunction(queueAdapter).singleton(),

});

module.exports = container;
