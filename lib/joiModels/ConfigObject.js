'use strict';

const Joi = require('joi');
const queueConfigDefaults = require('./../config').configDefaults;

function ConfigObject() {
  return Joi.object().keys({
    host: Joi.string().required(),
    port: Joi.number().integer().greater(0).required(),
    user: Joi.string().required(),
    pass: Joi.string().required(),
    vhost: Joi.string().required(),
    prefetch: Joi.number().integer().greater(0).default(queueConfigDefaults.prefetch),
    delaySeconds: Joi.number().integer().greater(0).default(queueConfigDefaults.delaySeconds),
    reconnectionTime: Joi.number().integer().greater(0).default(queueConfigDefaults.reconnectionTime),
    exchange: Joi.string().required(),
    maxRetries: Joi.number().integer().greater(-1).default(queueConfigDefaults.maxRetries),
    timeBetweenRetries: Joi.number().integer().greater(0).default(queueConfigDefaults.timeBetweenRetries),
    errorQueue:  Joi.string().required(),
    errorTopic:  Joi.string().required(),
  });
}

module.exports = ConfigObject;
