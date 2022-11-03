const axios = require("axios");
const config = require("./config");
const SCVLoggingUtil = require("./SCVLoggingUtil");

const scrtEndpoint = axios.create({
  baseURL: config.scrtEndpointBase,
});

scrtEndpoint.interceptors.request.use(
  (x) => {
    SCVLoggingUtil.debug({
      category: "",
      message: x,
      context: [],
      eventType: "SCV_REQUEST",
    });
    return x;
  },
  (err) => {
    SCVLoggingUtil.error({
      category: "",
      message: err,
      context: [],
      eventType: "SCV_REQUEST_ERROR",
    });
    return err;
  }
);

scrtEndpoint.interceptors.response.use(
  (x) => {
    SCVLoggingUtil.debug({
      category: "",
      message: x,
      context: [],
      eventType: "SCV_RESPONSE",
    });
    return x;
  },
  (err) => {
    SCVLoggingUtil.error({
      category: "",
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
