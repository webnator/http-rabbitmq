'use strict';

const queueLibrary = require('../lib/index');

async function testMe() {
  const queue = await queueLibrary({
    queueConfig: {
      host: 'localhost',
      port: 5779,
      user: 'rabb1tAdm1n',
      pass: 'testAdm1n!',
      vhost: '/',
      prefetch: 1,
      delaySeconds: 500,
      reconnectionTime: 5000,
      exchange: 'test_exchange',
      maxRetries: 5,
      timeBetweenRetries: 500,
      errorQueue: 'error',
      errorTopic: 'error.test',
    }
  });

  await queue.publish('test', 'WALLA!');
  await queue.publishHTTP('test', {
    headers: { auth: true },
    payload: { name: 'Williams' },
    query: { new: true, limit: 5, test: 'yes' }
  });

  await queue.close();
}

testMe();
