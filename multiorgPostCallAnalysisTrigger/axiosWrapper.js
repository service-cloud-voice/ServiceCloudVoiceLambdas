const axios = require("axios");
const axiosRetry = require("axios-retry");
const logger = require("axios-logger");
const config = require("./config");
const SCVLoggingUtil = require("./SCVLoggingUtil");

/**
 * Create axios instance with dynamic endpoint configuration
 * @param {object} configData - Configuration containing scrtEndpointBase
 * @returns {object} Configured axios instance
 */
function getScrtEndpoint(configData) {
  const instance = axios.create({
    baseURL: configData.scrtEndpointBase,
  });

  if (config.logLevel === "debug") {
    instance.interceptors.request.use(
        logger.requestLogger,
        logger.errorLogger
    );
    instance.interceptors.response.use(
      logger.responseLogger,
      logger.errorLogger
    );
  }

  // Configure retry logic
  axiosRetry(instance, {
    retries: 3,
    shouldResetTimeout: true,
    retryDelay: (retryCount) => retryCount * 1000,
    retryCondition: (error) => {
      // retried for rate limiting & server-side 5xx exception
      const errorCode = error.response.status;
      return errorCode === 429 || errorCode >= 500;
    },
    onRetry: (retryCount, error) => {
      // for metrics logging purpose
      SCVLoggingUtil.debug({
        message: `Retrying a failed request with error. Retry count: ${retryCount} (maximum is 3)`,
        context: { payload: error },
      });
    },
  });

  return instance;
}

module.exports = {
  getScrtEndpoint,
};