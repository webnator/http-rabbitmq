'use strict';

const tape = require('tape');
const queueLib = require('./../lib/index');
const config = require('./config');

const test_routes = { test1: 'test.test2' };
const makeRouterWithHandler = () => {
  let implementation;
  let errImplementation = () => {};
  let responseCode = 200;
  let errResponseCode = 200;
  const handler = (fn) => implementation = fn;
  const errorHandler = (fn) => errImplementation = fn;
  const status = (code) => responseCode = code;
  const errorStatus = (code) => errResponseCode = code;
  const router = (server) => {
    server.route({
      topic: test_routes.test1,
      handler: async (req, reply) => {
        Promise.resolve()
          .then(() => implementation(req))
          .then(() => reply({}).code(responseCode));
      }
    });
    // Error queue handler
    server.route({
      queue: config.queueConfig.errorQueue,
      topic: config.queueConfig.errorTopic,
      handler: async (req, reply) => {
        Promise.resolve()
          .then(() => errImplementation(req))
          .then(() => reply({}).code(errResponseCode));
      }
    });
  };
  return [{handler, status, errorHandler, errorStatus}, router];
};

const [routeConfig, router] = makeRouterWithHandler();

let myPublish, myClose;

tape('Set up', async (t) => {
  const { publishHTTP, closeConnection } = await queueLib.create({ queueConfig: config.queueConfig, routes: router});
  t.equal(typeof publishHTTP, 'function', 'publishHTTP Should be a function');
  t.equal(publishHTTP.length, 2, 'Should receive 2 parameters');

  myPublish = publishHTTP;
  myClose = closeConnection;
  t.end();
});

tape('Should publish and receive the message as a HTTP object', async(t) => {
  const test_msg = {
    payload: { email: 'test-1@test.com', password: '123' },
    params: { userUuid: '123124-14124-124-124' }
  };
  routeConfig.handler((req) => {
    t.deepLooseEqual(req.payload, test_msg.payload, 'Should be equal to ' + test_msg.payload);
    t.deepLooseEqual(req.params, test_msg.params, 'Should be equal to ' + test_msg.params);
    t.end();
    return Promise.resolve();
  });

  myPublish(test_routes.test1, test_msg);
});


tape('Should send to the error queue if a 4XX error is received', async(t) => {
  t.plan(2);
  const test_msg = {
    payload: { email: 'test-1-fail@test.com', password: 'XXX' },
    params: { userUuid: '123124-14124-124-124' }
  };
  routeConfig.status(400);
  routeConfig.handler(() => {
    t.pass();
    return Promise.resolve();
  });
  routeConfig.errorHandler(() => {
    t.pass();
    return Promise.resolve();
  });

  myPublish(test_routes.test1, test_msg);
});

tape('Should send to the error queue if a weird error is received (8XX)', async(t) => {
  t.plan(2);
  const test_msg = {
    payload: { email: 'test-1-fail@test.com', password: 'XXX' },
    params: { userUuid: '123124-14124-124-124' }
  };
  routeConfig.status(800);
  routeConfig.handler(() => {
    t.pass();
    return Promise.resolve();
  });
  routeConfig.errorHandler(() => {
    t.pass();
    return Promise.resolve();
  });

  myPublish(test_routes.test1, test_msg);
});

tape('Should retry X times and then send to the error queue if a 5XX error is received', async(t) => {
  const retryTimes = config.queueConfig.maxRetries;
  t.plan(retryTimes + 2);
  const test_msg = {
    payload: { email: 'test-1@test.com', password: '123' },
    params: { userUuid: '123124-14124-124-124' }
  };
  routeConfig.status(500);
  routeConfig.handler(() => {
    t.pass('Handling message correctly');
    return Promise.resolve();
  });
  routeConfig.errorHandler(() => {
    t.pass('Hnadling error queue');
    return Promise.resolve();
  });

  myPublish(test_routes.test1, test_msg);
});

tape('Teardown', async (t) => {
  await myClose();
  t.end();
});
