const axios = require("axios");
const logger = require("axios-logger");
const config = require("./config");

const scrtEndpoint = axios.create({
  baseURL: config.scrtEndpointBase
});
scrtEndpoint.interceptors.request.use(logger.requestLogger, logger.errorLogger);
scrtEndpoint.interceptors.response.use(
  logger.responseLogger,
  logger.errorLogger
);

module.exports = {
  scrtEndpoint
};
