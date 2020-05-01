'use strict';

process.env.QUEUE_LOG_PAYLOAD = 'true';

const tape = require('tape');
const queueLib = require('../lib/index');
const config = require('./config');

const test_routes = { test1: 'test.test1', error_test: 'test.errorSync' };
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
      handler: (req, reply) => {
        return Promise.resolve()
          .then(() => implementation(req))
          .then(() => reply({}).code(responseCode));
      }
    });
    // Sync handler without reply
    server.route({
      topic: test_routes.error_test,
      handler: (req) => {
        return implementation(req);
      }
    });
    // Error queue handler
    server.route({
      queue: config.queueConfig.errorQueue,
      topic: config.queueConfig.errorTopic,
      handler: (req, reply) => {
        return Promise.resolve()
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
  const { publish, close } = await queueLib.create({queueConfig: config.queueConfig, routes: router});
  t.equal(typeof publish, 'function', 'publish Should be a function');
  t.equal(publish.length, 2, 'Should receive 2 parameters');

  myPublish = publish;
  myClose = close;
  t.end();
});

tape('Should handle correctly a handler error', async(t) => {
  const test_msg = 'My test message';
  routeConfig.handler((req) => {
    t.equal(req.queueMessage, test_msg, 'Should be equal to ' + test_msg);
    t.end();
    throw new Error('Handler errored');
  });

  myPublish(test_routes.error_test, test_msg);
});

tape('Should publish and receive the message if it is a string', async(t) => {
  const test_msg = 'My test message';
  routeConfig.handler((req) => {
    t.equal(req.queueMessage, test_msg, 'Should be equal to ' + test_msg);
    t.end();
    return Promise.resolve();
  });

  myPublish(test_routes.test1, test_msg);
});

tape('Should publish a null and handle it correctly', async(t) => {
  const test_msg = null;
  routeConfig.handler((req) => {
    t.equal(req.queueMessage, undefined, 'Should be undefined');
    t.end();
    return Promise.resolve();
  });

  myPublish(test_routes.test1, test_msg);
});

tape('Should publish and receive a message that contains the message if it is a JSON', async(t) => {
  const test_msg = { payload: 'test', headers: { a: 1, b: '2', c: 'ABC'} };
  routeConfig.handler((req) => {
    t.equal(req.payload, test_msg.payload, 'Should be equal to ' + test_msg.payload);
    t.equal(req.headers.a, test_msg.headers.a, 'Should be equal to ' + test_msg.headers.a);
    t.equal(req.headers.b, test_msg.headers.b, 'Should be equal to ' + test_msg.headers.b);
    t.equal(req.headers.c, test_msg.headers.c, 'Should be equal to ' + test_msg.headers.c);
    t.end();
    return Promise.resolve();
  });

  myPublish(test_routes.test1, test_msg);
});

tape('Should publish and receive a JSON adding the trace id to the headers', async(t) => {
  const test_msg = { payload: 'test', params: { a: 1, b: '2', c: 'ABC'} };
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
  const test_msg = { payload: 'test', params: { a: 1, b: '2', c: 'ABC'} };
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

tape('Teardown', async (t) => {
  await myClose();
  t.end();
});
