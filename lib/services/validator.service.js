'use strict';

const joi = require('joi');
const rabbitConfigSchema = require('./../schemas/rabbitConfig.schema');

module.exports = () => ({
  validateSchema(object, schema) {
    return joi.validate(object, schema);
  },
  validateConfigSchema(object) {
    return this.validateSchema(object, rabbitConfigSchema());
  }
});
