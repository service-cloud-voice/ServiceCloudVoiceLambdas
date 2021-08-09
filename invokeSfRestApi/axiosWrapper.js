const axios = require("axios");
const logger = require("axios-logger");
const config = require("./config");

const apiEndpoint = axios.create({
  baseURL: config.salesforceRestApiEndpointBase
});
apiEndpoint.interceptors.request.use(logger.requestLogger, logger.errorLogger);
apiEndpoint.interceptors.response.use(
  logger.responseLogger,
  logger.errorLogger
);

const authEndpoint = axios.create({
  baseURL: config.salesforceAuthEndpoint
});
authEndpoint.interceptors.request.use(logger.requestLogger, logger.errorLogger);
authEndpoint.interceptors.response.use(
  logger.responseLogger,
  logger.errorLogger
);

module.exports = {
  apiEndpoint,
  authEndpoint
};
