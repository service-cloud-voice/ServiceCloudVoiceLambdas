const axios = require("axios");
const axiosRetry = require("axios-retry");
const config = require("./config");
const SCVLoggingUtil = require("./SCVLoggingUtil");

const scrtEndpoint = axios.create({
  baseURL: config.scrtEndpointBase,
});

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
      category: "axiosWrapper.axiosRetry",
      message: `Retrying a failed request with error: ${error}. Retry count: ${retryCount} (maximum is 3)`,
    });
  },
});

scrtEndpoint.interceptors.request.use(
  (x) => {
    SCVLoggingUtil.info({
      category: "telephonyIntegrationApi.persistSignals",
      message: x,
      context: [],
      eventType: "SCV_REQUEST",
    });
    return x;
  },
  (err) => {
    SCVLoggingUtil.error({
      category: "telephonyIntegrationApi.persistSignals",
      message: err,
      context: [],
      eventType: "SCV_REQUEST_ERROR",
    });
    return err;
  }
);

scrtEndpoint.interceptors.response.use(
  (x) => {
    SCVLoggingUtil.info({
      category: "telephonyIntegrationApi.persistSignals",
      message: x,
      context: [],
      eventType: "SCV_RESPONSE",
    });
    return x;
  },
  (err) => {
    SCVLoggingUtil.error({
      category: "telephonyIntegrationApi.persistSignals",
      message: err,
      context: [],
      eventType: "SCV_RESPONSE_ERROR",
    });
    return err;
  }
);

module.exports = {
  scrtEndpoint,
};
