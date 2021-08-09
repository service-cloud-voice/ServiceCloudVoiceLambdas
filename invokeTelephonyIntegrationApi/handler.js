const SCVLoggingUtil = require("./SCVLoggingUtil");
const api = require("./telephonyIntegrationApi");
const config = require("./config");
const utils = require("./utils");

exports.handler = async event => {
  if (event["detail-type"] === "Scheduled Event") {
    return {
      statusCode: 200,
      message: "Keep Lambda Warm"
    };
  }

  let result = {};
  let voiceCallFieldValues;
  const { methodName, fieldValues, contactId } = event.Details.Parameters;

  switch (methodName) {
    case "createVoiceCall":
      voiceCallFieldValues = {
        callCenterApiName: config.callCenterApiName,
        vendorCallKey: event.Details.ContactData.ContactId,
        to: event.Details.ContactData.SystemEndpoint.Address,
        from: event.Details.ContactData.CustomerEndpoint.Address,
        initiationMethod: "Inbound",
        startTime: new Date().toISOString(),
        callAttributes: utils.getCallAttributes(
          event.Details.ContactData.Attributes
        ),
        participants: [
          {
            participantKey: event.Details.ContactData.CustomerEndpoint.Address,
            type: "END_USER"
          }
        ]
      };
      result = await api.createVoiceCall(voiceCallFieldValues);
      break;
    case "updateVoiceCall":
      fieldValues.callCenterApiName = config.callCenterApiName;
      result = await api.updateVoiceCall(contactId, fieldValues);
      break;
    case "createTransferVC":
      voiceCallFieldValues = {
        callCenterApiName: config.callCenterApiName,
        vendorCallKey: event.Details.ContactData.ContactId,
        to: event.Details.ContactData.SystemEndpoint.Address,
        from: event.Details.ContactData.CustomerEndpoint.Address,
        parentVoiceCallId: event.Details.ContactData.PreviousContactId,
        initiationMethod: "Transfer",
        startTime: new Date().toISOString(),
        participants: [
          {
            participantKey: event.Details.ContactData.CustomerEndpoint.Address,
            type: "END_USER"
          }
        ]
      };
      result = await api.createVoiceCall(voiceCallFieldValues);
      break;
    case "executeOmniFlow": {
      const payload = {
        flowDevName: event.Details.Parameters.flowDevName,
        fallbackQueue: event.Details.Parameters.fallbackQueue,
        flowInputParameters: utils.constructFlowInputParams(
          event.Details.Parameters
        )
      };
      result = await api.executeOmniFlow(
        event.Details.ContactData.ContactId,
        payload
      );
      break;
    }
    case "cancelOmniFlowExecution":
      result = await api.cancelOmniFlowExecution(
        event.Details.ContactData.ContactId
      );
      break;
    default:
      SCVLoggingUtil.warn(
        "invokeTelephonyIntegrationApi.handler.handler",
        SCVLoggingUtil.EVENT_TYPE.VOICECALL,
        "Unsupported method",
        {}
      );
      throw new Error(`Unsupported method: ${methodName}`);
  }

  return result;
};
