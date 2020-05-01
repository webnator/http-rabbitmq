'use strict';

function makeService() {
  let routes = [];

  return {
    /**
     * Registers a new route for handling queue messages
     * @param {Object} route - The route object
     * @param {Object} route.topic - The name of the topic to listen to
     * @param {Object} route.handler - The function to handle the message
     */
    route(route) {
      if (route.topic && route.handler) {
        routes.push(route);
      } else {
        throw new Error('KO Error while registering route: Wrong route object. Object: ' + JSON.stringify(route));
      }
    },

    cleanRoutes() {
      routes = [];
    },

    /**
     * Obtains all routes
     * @returns {Array} - Array of route objects
     */
    getRoutes() {
      return routes;
    }
  };
}

module.exports = makeService;
