const aws = require("aws-sdk");
const SCVLoggingUtil = require("./SCVLoggingUtil");
const { retrieveFromCache } = require("./cacheUtils");
const secretUtils = require("./secretUtils");
const config = require("./config");

const lambda = new aws.Lambda();
const utils = require("./utils");

const telephonyServiceMethods = {
  CANCEL_OMNI_FLOW: "cancelOmniFlowExecution",
  REROUTE_FLOW: "rerouteFlowExecution",
};

function invokeTelephonyServiceAPI(contactId, methodName, secretData) {
  SCVLoggingUtil.info({
    message: "MultiorgHandleContactEvents Request created",
    context: { contactId: contactId },
  });

  const payload = {
    Details: {
      Parameters: {
        methodName: methodName,
        contactId: contactId,
        fieldValues: {
          secretName: secretData?.secretName || null,
        },
      },
    },
  };

  const params = {
    FunctionName: config.invokeTelephonyIntegrationApiArn,
    Payload: JSON.stringify(payload),
  };
  return lambda.invoke(params).promise();
}

async function processEvent(message, event, methodName) {
  const promises = [];
  const contactId = event.detail.contactId;

  SCVLoggingUtil.info({
    message: message,
    context: { contactId: contactId, payload: event },
  });

  // Fetch secret name from cache using contactId
  let secretData = null;
  let secretConfigs = null;

  try {
    const cacheData = await retrieveFromCache(contactId);
    if (cacheData && cacheData.secretName) {
      secretData = cacheData;
      SCVLoggingUtil.debug({
        message: "Secret name retrieved from cache",
        context: { contactId, secretName: cacheData.secretName },
      });

      // Read actual secret data from AWS Secrets Manager
      try {
        secretConfigs = await secretUtils.getSecretConfigs(cacheData.secretName);
        SCVLoggingUtil.debug({
          message: "Secret data retrieved from Secrets Manager",
          context: { contactId, secretName: cacheData.secretName },
        });
      } catch (secretError) {
        SCVLoggingUtil.error({
          message: "Error reading secret from Secrets Manager",
          context: { contactId, secretName: cacheData.secretName, error: secretError.message },
        });
        // Continue processing - let downstream function handle the error
      }
    } else {
      SCVLoggingUtil.error({
        message: "No secretName found in cache for ContactId",
        context: { contactId },
      });
      // Continue processing - let downstream function handle the error
    }
  } catch (error) {
    SCVLoggingUtil.error({
      message: "Error retrieving secret name from cache",
      context: { contactId, error: error.message },
    });
    // Continue processing - let downstream function handle the error
  }

  // Include secret name in the data passed to invokeTelephonyServiceAPI
  const enhancedSecretData = secretData ? {
    ...secretData,
    configs: secretConfigs
  } : null;

  const promise = invokeTelephonyServiceAPI(contactId, methodName, enhancedSecretData);
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
    message: "MultiorgHandleContactEvents event received",
    context: event,
  });

  if (utils.isDisconnectedEventForAbandonedCall(event)) {
    await processEvent(
      "Amazon Connect Contact Disconnected Event",
      event,
      telephonyServiceMethods.CANCEL_OMNI_FLOW
    );
  } else if (utils.isRoutingCriteriaExpiredEventForCall(event)) {
    await processEvent(
      "Amazon Connect Contact Routing Expired Event",
      event,
      telephonyServiceMethods.REROUTE_FLOW
    );
  }
};