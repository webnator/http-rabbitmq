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
        console.log(new Date()); //eslint-disable-line no-console
        return reply({}).code(200);
      }
    });
  };
  const { publish } = await queueLib.create({queueConfig: config.queueConfig, routes: router});


  while (true) { //eslint-disable-line no-constant-condition
    try {
      await publish(topic, logger, { payload: 'test me 1'});
    } catch (e) {
      console.log('Cant publish yet'); //eslint-disable-line no-console
    }

    await delay(1000);
  }
}

publishSomething();

