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
const GlobalService = require('./services/global');
const ValidatorService = require('./services/Validator');

// General
const init = require('./init');
const Queue = require('./Queue');
const QueueManager = require('./QueueManager');
const QueueRouter = require('./QueueRouter');
const QueueService = require('./QueueService');

container.register({
  // Libs
  logger: asValue(pino({ level: 'info' })),
  amqp: asValue(amqp),
  hoek: asValue(hoek),
  delayLib: asValue(delay),

  // services
  GlobalService: asFunction(GlobalService).singleton(),
  ValidatorService: asFunction(ValidatorService).singleton(),

  // General
  init: asFunction(init).singleton(),
  Queue: asFunction(Queue).singleton(),
  QueueManager: asFunction(QueueManager).singleton(),
  QueueRouter: asFunction(QueueRouter).singleton(),
  QueueService: asFunction(QueueService).singleton(),

});

module.exports = container;
