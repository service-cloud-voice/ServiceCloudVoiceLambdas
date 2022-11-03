const aws = require("aws-sdk");
const SCVLoggingUtil = require("./SCVLoggingUtil");

const lambda = new aws.Lambda();
const utils = require("./utils");

function cancelOmniFlowExecution(contactId) {
  const payload = {
    Details: {
      Parameters: {
        methodName: "cancelOmniFlowExecution",
        ContactId: contactId,
      },
    },
  };
  const params = {
    FunctionName: process.env.INVOKE_TELEPHONY_INTEGRATION_API_ARN,
    Payload: JSON.stringify(payload),
  };

  return lambda.invoke(params).promise();
}

exports.handler = async (event) => {
  const clearPsrPromises = [];
  SCVLoggingUtil.debug({
    category: "handleContactEvent.handler",
    message: "Received event",
    context: event,
  });
  if (utils.isDisconnectedEventForAbandonedCall(event)) {
    SCVLoggingUtil.info({
      category: "handleContactEvents.handler",
      eventType: "VOICECALL",
      message: "Amazon Connect Contact Disconnected Event",
      context: event,
    });

    const clearPsrPromise = cancelOmniFlowExecution(event.detail.contactId);
    clearPsrPromises.push(clearPsrPromise);
    clearPsrPromise.then((response) => {
      SCVLoggingUtil.info({
        message: "cancelOmniFlowExecution response",
        eventType: "VOICECALL",
        category: "handleContactEventsLambda handler",
        context: response,
      });
    });
  }

  return Promise.all(clearPsrPromises);
};
