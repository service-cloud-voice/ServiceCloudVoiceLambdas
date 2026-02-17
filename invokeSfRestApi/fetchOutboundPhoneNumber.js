const queryEngine = require("./queryEngine");
const SCVLoggingUtil = require("./SCVLoggingUtil");
const secretUtils = require("./secretUtils");

function getAgentARN(event) {
  if (event.Details.Parameters.agentARN) {
    return event.Details.Parameters.agentARN;
  } else {
    return null;
  }
}

async function fetchOutboundPhoneNumber(event, secretName, accessTokenSecretName) {
  const agentARN = getAgentARN(event);
  if (!agentARN) {
    SCVLoggingUtil.error({
      message: "Couldn't find agentARN in event details parameters",
      context: { payload: event },
    });
    return {
      success: true,
    };
  }

  const outboundPhoneNumber = await getMessagingPlatformKey(agentARN, secretName, accessTokenSecretName);
  if (!outboundPhoneNumber) {
    SCVLoggingUtil.error({
      message: "Couldn't find outbound phone number from messaging channel.",
      context: { payload: { agentARN } },
    });
    return {
      success: true,
    };
  }

  return {
    success: true,
    outboundPhoneNumber,
  };
}

function getSerializableError(error) {
  if (error && error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return error;
}

async function getMessagingPlatformKey(agentARN, secretName, accessTokenSecretName) {
  const configs = await secretUtils.getSecretConfigs(secretName);
  const qry = `SELECT MessagingPlatformKey
                    FROM MessagingChannel
                    WHERE MessageType='Voice'
                      AND IsActive = true
                      AND Id in
                          (SELECT ChannelId
                           FROM ContactCenterChannel
                           WHERE ContactCenterChannel.ContactCenter.InternalName='${configs.callCenterApiName}')
                      AND SessionHandlerId in
                          (SELECT ReferenceRecordId
                           FROM CallCenterRoutingMap
                           WHERE ExternalId='${agentARN}'
                           )
                    LIMIT 1`;

  let results;
  try {
    results = await queryEngine.invokeQuery(qry, {
      methodName: "queryRecord",
    }, secretName, accessTokenSecretName);
    if (results && results.success === false) {
      SCVLoggingUtil.error({
        message:
          "Error in querying messaging channel to find outbound phone number.",
        context: { payload: { results: results, qry: qry } },
      });
    }
  } catch (e) {
    SCVLoggingUtil.error({
      message:
        "Couldn't query messaging channel to find outbound phone number.",
      context: {
        payload: {
          qry: qry,
          error: getSerializableError(e),
        },
      },
    });
  }

  return results && results.MessagingPlatformKey
    ? results.MessagingPlatformKey
    : null;
}

module.exports = {
  fetchOutboundPhoneNumber,
};
