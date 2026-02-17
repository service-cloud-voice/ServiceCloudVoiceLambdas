const axios = require("axios");
const axiosRetry = require("axios-retry");
const logger = require("axios-logger");
const config = require("./config");
const secretUtils = require("./secretUtils");
const SCVLoggingUtil = require("./SCVLoggingUtil");

let scrtEndpoint = null;

async function getScrtEndpoint() {
    if (scrtEndpoint) return scrtEndpoint;

    const configData = await secretUtils.getSecretConfigs(config.secretName);
    scrtEndpoint = axios.create({
        baseURL: configData.scrtEndpointBase,
});

if (config.logLevel === "debug") {
  scrtEndpoint.interceptors.request.use(
    logger.requestLogger,
    logger.errorLogger
  );
  scrtEndpoint.interceptors.response.use(
    logger.responseLogger,
    logger.errorLogger
  );
}

// Retry Config
axiosRetry(scrtEndpoint, {
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

    return scrtEndpoint;
}

module.exports = {
    getScrtEndpoint,
};
