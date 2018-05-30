'use strict';

const Joi = require('joi');
const ConfigModel = require('./../joiModels/ConfigObject');

function makeService() {
  return {
    validateSchema(object, schema) {
      return Joi.validate(object, schema);
    },
    validateConfigSchema(object) {
      return this.validateSchema(object, new ConfigModel());
    },
  };
}

module.exports = makeService;
