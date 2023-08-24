const aws = require("aws-sdk");
const SCVLoggingUtil = require("./SCVLoggingUtil");

const lambda = new aws.Lambda();
const utils = require("./utils");

function cancelOmniFlowExecution(contactId) {
  SCVLoggingUtil.info({
    message: "HandleContactEvents Request created",
    context: { contactId: contactId },
  });
  const payload = {
    Details: {
      Parameters: {
        methodName: "cancelOmniFlowExecution",
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

exports.handler = async (event) => {
  const clearPsrPromises = [];
  SCVLoggingUtil.debug({
    message: "HandleContactEvents event received",
    context: event,
  });
  if (utils.isDisconnectedEventForAbandonedCall(event)) {
    SCVLoggingUtil.info({
      message: "Amazon Connect Contact Disconnected Event",
      context: { contactId: event.detail.contactId, payload: event },
    });

    const clearPsrPromise = cancelOmniFlowExecution(event.detail.contactId);
    clearPsrPromises.push(clearPsrPromise);
    clearPsrPromise.then((response) => {
      SCVLoggingUtil.info({
        message: "cancelOmniFlowExecution response",
        context: response,
      });
    });
  }

  return Promise.all(clearPsrPromises);
};
