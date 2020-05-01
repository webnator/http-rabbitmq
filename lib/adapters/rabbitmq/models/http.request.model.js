'use strict';

module.exports = (topic, method, message) => {
  let request = {};
  try {
    request = Object.assign({}, JSON.parse(message.content.toString()));
  } catch (err) {
    request = Object.assign({}, { queueMessage: message.content.toString() });
  }

  const raw = Object.assign({}, request);

  request.payload = request.payload || {};
  request.headers = request.headers || {};
  request.method = method;
  request.path = topic;
  request.info = { received: Date.now() };

  return { request, raw };
};
