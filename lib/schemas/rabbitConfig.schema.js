'use strict';

const joi = require('joi');
const configDefaults = require('../config').defaults.generalConfig;

module.exports = () => joi.object().keys({
  host: joi.string().required(),
  port: joi.number().integer().greater(0).required(),
  user: joi.string().required(),
  pass: joi.string().required(),
  vhost: joi.string().required(),
  prefetch: joi.number().integer().greater(0).default(configDefaults.prefetch),
  delaySeconds: joi.number().integer().greater(0).default(configDefaults.delaySeconds),
  reconnectionTime: joi.number().integer().greater(0).default(configDefaults.reconnectionTime),
  exchange: joi.string().required(),
  maxRetries: joi.number().integer().greater(-1).default(configDefaults.maxRetries),
  timeBetweenRetries: joi.number().integer().greater(0).default(configDefaults.timeBetweenRetries),
  errorQueue:  joi.string().required(),
  errorTopic:  joi.string().required(),
});
