const aws = require("aws-sdk");
const SCVLoggingUtil = require("./SCVLoggingUtil");

const lambda = new aws.Lambda();
const utils = require("./utils");

const telephonyServiceMethods = {
  CANCEL_OMNI_FLOW : "cancelOmniFlowExecution",
  REROUTE_FLOW: "rerouteFlowExecution",
}

function invokeTelephonyServiceAPI(contactId, methodName) {
  SCVLoggingUtil.info({
    message: "HandleContactEvents Request created",
    context: { contactId: contactId },
  });
  const payload = {
    Details: {
      Parameters: {
        methodName: methodName,
        contactId: contactId,
      },
    },
  };
  const params = {
    FunctionName: process.env.INVOKE_TELEPHONY_INTEGRATION_API_ARN,
    Payload: JSON.stringify(payload),
  };
  return lambda.invoke(params).promise();
}

function processEvent(message, event, methodName) {
  const promises = [];
  SCVLoggingUtil.info({
    message: message,
    context: { contactId: event.detail.contactId, payload: event },
  });

  const promise = invokeTelephonyServiceAPI(event.detail.contactId, methodName);
  promises.push(promise);

  promise.then((response) => {
    SCVLoggingUtil.info({
      message: methodName + " response",
      context: response,
    });
  }).catch((error) => {
    SCVLoggingUtil.info({
      message: methodName + " error",
      context: error,
    });
  });
  return Promise.all(promises);
}

exports.handler = async (event) => {
  SCVLoggingUtil.debug({
    message: "HandleContactEvents event received",
    context: event,
  });

  if (utils.isDisconnectedEventForAbandonedCall(event)) {
    await processEvent("Amazon Connect Contact Disconnected Event", event, telephonyServiceMethods.CANCEL_OMNI_FLOW);
  } else if (utils.isRoutingCriteriaExpiredEventForCall(event)) {
    await processEvent("Amazon Connect Contact Routing Expired Event", event, telephonyServiceMethods.REROUTE_FLOW);
  }
};
