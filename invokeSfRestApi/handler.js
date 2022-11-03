const flatten = require("flat");
const SCVLoggingUtil = require("./SCVLoggingUtil");
const api = require("./sfRestApi");
const queryEngine = require("./queryEngine");
const utils = require("./utils");
const SFSPhoneCallFlow = require("./SFSPhoneCallFlow");

// --------------- Events -----------------------

// invoked by invoking lambda through amazon connect
async function dispatchQuery(soql, event) {
  const parameters = event.Details.Parameters;
  const queryResult = await queryEngine.invokeQuery(soql, parameters);
  return flatten(queryResult);
}

async function dispatchSearch(sosl) {
  const searchResult = await api.searchRecord(sosl);
  return flatten(searchResult);
}

// --------------- Main handler -----------------------
exports.handler = async (event) => {
  let result = {};
  const { methodName, objectApiName, recordId, soql, sosl } =
    event.Details.Parameters;

  SCVLoggingUtil.debug({
    category: "invokeSfRestApi.handler.handler",
    message: "Received event",
    context: event,
  });
  switch (methodName) {
    case "createRecord":
      result = await api.createRecord(
        utils.formatObjectApiName(objectApiName),
        utils.getSObjectFieldValuesFromConnectLambdaParams(
          event.Details.Parameters
        )
      );
      break;
    case "updateRecord":
      result = await api.updateRecord(
        utils.formatObjectApiName(objectApiName),
        recordId,
        utils.getSObjectFieldValuesFromConnectLambdaParams(
          event.Details.Parameters
        )
      );
      break;
    case "queryRecord": {
      result = dispatchQuery(soql, event);
      break;
    }
    case "searchRecord": {
      result = dispatchSearch(sosl);
      break;
    }
    case "realtimeAlertEvent": {
      result = await api.sendRealtimeAlertEvent(
        utils.getRealtimeAlertEventFieldValuesFromConnectLambdaParams(
          event.Details.Parameters
        )
      );
      break;
    }
    case "SFSPhoneCallFlowQuery": {
      const res = await SFSPhoneCallFlow.entryPoint(event);
      result = flatten(res);
      break;
    }
    default: {
      SCVLoggingUtil.warn({
        category: "invokeSfRestApi.handler.handler",
        eventType: "VOICECALL",
        message: "Unsupported method",
        context: {},
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
