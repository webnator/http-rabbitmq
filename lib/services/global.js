'use strict';

function makeService() {
  const config = {};

  return {
    getConfigValue(param) {
      return config[param];
    },

    setConfigValue(param, value) {
      config[param] = value;
      return config[param];
    },

    getConfigList() {
      return config;
    }
  };
}

module.exports = makeService;
