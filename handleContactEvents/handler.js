const aws = require("aws-sdk");
const SCVLoggingUtil = require("./SCVLoggingUtil");

const lambda = new aws.Lambda();
const utils = require("./utils");

function cancelOmniFlowExecution(contactId) {
  const payload = {
    Details: {
      Parameters: {
        methodName: "cancelOmniFlowExecution",
        ContactId: contactId
      }
    }
  };
  const params = {
    FunctionName: process.env.INVOKE_TELEPHONY_INTEGRATION_API_ARN,
    Payload: JSON.stringify(payload)
  };

  return lambda.invoke(params).promise();
}

exports.handler = async event => {
  const clearPsrPromises = [];
  if (utils.isDisconnectedEventForAbandonedCall(event)) {
    SCVLoggingUtil.info(
      "handleContactEvents.handler",
      SCVLoggingUtil.EVENT_TYPE.VOICECALL,
      "Amazon Connect Contact Disconnected Event",
      event
    );

    const clearPsrPromise = cancelOmniFlowExecution(event.detail.contactId);
    clearPsrPromises.push(clearPsrPromise);
    clearPsrPromise.then(response => {
      SCVLoggingUtil.info(
        "cancelOmniFlowExecution response",
        SCVLoggingUtil.EVENT_TYPE.VOICECALL,
        "handleContactEventsLambda handler",
        response
      );
    });
  }

  return Promise.all(clearPsrPromises);
};
