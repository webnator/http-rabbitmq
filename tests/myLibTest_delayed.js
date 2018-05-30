'use strict';

const queueLib = require('./../lib/index');
const config = require('./config');
const logger = require('pino');

const delay = require('delay');

const topic = 'test.reconnect';

async function publishSomething() {
  const router = (server) => {
    server.route({
      topic: topic,
      handler: async (req, reply) => {
        await delay(15000);
        console.log(new Date()); //eslint-disable-line no-console
        return reply({}).code(200);
      }
    });
  };
  const { publish } = await queueLib.create(config.queueConfig, {}, router, logger, config.logger_middleware);

  for (let i = 0; i < 1000; i++) { //eslint-disable-line no-constant-condition
    try {
      await publish(topic, logger, { payload: 'test me 1'});
    } catch (e) {
      console.log('Cant publish yet'); //eslint-disable-line no-console
    }
  }
}

publishSomething();

