module.exports = {
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
    delayed: false
  }
};