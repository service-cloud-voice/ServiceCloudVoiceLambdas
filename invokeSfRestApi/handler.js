const flatten = require("flat");
const SCVLoggingUtil = require("./SCVLoggingUtil");
const api = require("./sfRestApi");
const queryEngine = require("./queryEngine");
const utils = require("./utils");
const SFSPhoneCallFlow = require("./SFSPhoneCallFlow");
const { fetchOutboundPhoneNumber } = require("./fetchOutboundPhoneNumber");
const { fetchAgentPhoneNumber } = require("./fetchAgentPhoneNumber");
const { fetchDefaultVoicemailGreetingUrl } = require("./fetchDefaultVoicemailGreetingUrl");
const config = require("./config");

// --------------- Events -----------------------

// invoked by invoking lambda through amazon connect
async function dispatchQuery(soql, event, secretName, accessTokenSecretName) {
  const parameters = event.Details.Parameters;
  const queryResult = await queryEngine.invokeQuery(soql, parameters, secretName, accessTokenSecretName);
  return flatten(queryResult);
}

async function dispatchSearch(sosl, secretName, accessTokenSecretName) {
  const searchResult = await api.searchRecord(sosl, secretName, accessTokenSecretName);
  return flatten(searchResult);
}

// --------------- Main handler -----------------------
exports.handler = async (event) => {
  let result = {};
  const { methodName, objectApiName, recordId, soql, sosl } =
    event.Details.Parameters;

  const secretName = event.Details.Parameters.secretName || event.Details.ContactData?.Attributes?.secretName || config.secretName;
  const accessTokenSecretName = event.Details.Parameters.accessTokenSecretName || event.Details.ContactData?.Attributes?.accessTokenSecretName || config.accessTokenSecretName;

  SCVLoggingUtil.debug({
    message: "InvokeSFRestApi event received",
    context: event,
  });
  switch (methodName) {
    case "createRecord":
      result = await api.createRecord(
        utils.formatObjectApiName(objectApiName),
        utils.getSObjectFieldValuesFromConnectLambdaParams(
          event.Details.Parameters
        ),
        secretName,
        accessTokenSecretName
      );
      break;
    case "updateRecord":
      result = await api.updateRecord(
        utils.formatObjectApiName(objectApiName),
        recordId,
        utils.getSObjectFieldValuesFromConnectLambdaParams(
          event.Details.Parameters
        ),
        secretName,
        accessTokenSecretName
      );
      break;
    case "queryRecord": {
      result = dispatchQuery(soql, event, secretName, accessTokenSecretName);
      break;
    }
    case "searchRecord": {
      result = dispatchSearch(sosl, secretName, accessTokenSecretName);
      break;
    }
    case "uploadTranscript": {
      result = await api.uploadTranscript(
        event.Details.Parameters.contactIdsPayloadMap,
        secretName,
        accessTokenSecretName
      );
      break;
    }
    case "fetchUploadIdsStatus": {
      result = await api.fetchUploadIdsStatus(
        event.Details.Parameters.uploadIds,
        secretName,
        accessTokenSecretName
      );
      break;
    }
    case "realtimeAlertEvent": {
      result = await api.sendRealtimeAlertEvent(
        utils.getRealtimeAlertEventFieldValuesFromConnectLambdaParams(
          event.Details.Parameters
        ),
        secretName,
        accessTokenSecretName
      );
      break;
    }
    case "SFSPhoneCallFlowQuery": {
      const res = await SFSPhoneCallFlow.entryPoint(event, secretName, accessTokenSecretName);
      result = flatten(res);
      break;
    }
    case "fetchOutboundPhoneNumber": {
      result = await fetchOutboundPhoneNumber(event, secretName, accessTokenSecretName);
      break;
    }
    case "fetchAgentPhoneNumber": {
      result = await fetchAgentPhoneNumber(event);
      break;
    }
    case "fetchDefaultVoicemailGreetingUrl": {
      result = await fetchDefaultVoicemailGreetingUrl(event, secretName, accessTokenSecretName);
      break;
    }
    default: {
      SCVLoggingUtil.warn({
        message: "Unsupported method",
        context: { payload: event },
      });
      throw new Error(`Unsupported method: ${methodName}`);
    }
  }

  if (result.success === false) {
    throw new Error(result.errorMessage);
  } else {
    return result;
  }
};
