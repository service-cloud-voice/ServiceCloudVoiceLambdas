const axios = require("axios");
const logger = require("axios-logger");
const config = require("./config");

const apiEndpoint = axios.create({
  baseURL: config.salesforceRestApiEndpointBase,
});
const authEndpoint = axios.create({
  baseURL: config.salesforceAuthEndpoint,
});

if (process.env.LOG_LEVEL === "debug") {
  apiEndpoint.interceptors.request.use(
    logger.requestLogger,
    logger.errorLogger
  );
  apiEndpoint.interceptors.response.use(
    logger.responseLogger,
    logger.errorLogger
  );

  authEndpoint.interceptors.request.use(
    logger.requestLogger,
    logger.errorLogger
  );
  authEndpoint.interceptors.response.use(
    logger.responseLogger,
    logger.errorLogger
  );
}

module.exports = {
  apiEndpoint,
  authEndpoint,
};
