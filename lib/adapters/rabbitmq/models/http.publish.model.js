'use strict';

module.exports = (payload, headers, query, params) => ({
  headers: headers || {},
  payload: payload || {},
  query: query || {},
  params: params || {}
});
