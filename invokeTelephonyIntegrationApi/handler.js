const SCVLoggingUtil = require("./SCVLoggingUtil");
const api = require("./telephonyIntegrationApi");
const config = require("./config");
const utils = require("./utils");

exports.handler = async (event) => {
  SCVLoggingUtil.debug({
    message: "InvokeTelephonyIntegrationApi event received",
    context: { payload: event },
  });
  if (event["detail-type"] === "Scheduled Event") {
    return {
      statusCode: 200,
      message: "Keep Lambda Warm",
    };
  }

  let result = {};
  let voiceCallFieldValues;
  const { methodName, fieldValues, contactId } = event.Details.Parameters;
  const contactIdValue = contactId || event.Details.ContactData.ContactId;

  SCVLoggingUtil.info({
    message: `Invoke ${methodName} request with ${contactIdValue}`,
    context: { contactId: contactIdValue, payload: voiceCallFieldValues },
  });
  switch (methodName) {
    case "createVoiceCall":
      voiceCallFieldValues = {
        callCenterApiName: config.callCenterApiName,
        vendorCallKey: contactIdValue,
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
            type: "END_USER",
          },
        ],
      };

      result = await api.createVoiceCall(voiceCallFieldValues);
      break;
    case "updateVoiceCall":
      fieldValues.callCenterApiName = config.callCenterApiName;
      result = await api.updateVoiceCall(contactIdValue, fieldValues);
      break;
    case "createTransferVC":
      voiceCallFieldValues = {
        callCenterApiName: config.callCenterApiName,
        vendorCallKey: contactIdValue,
        to: event.Details.ContactData.SystemEndpoint.Address,
        from: event.Details.ContactData.CustomerEndpoint.Address,
        parentVoiceCallId: event.Details.ContactData.PreviousContactId,
        initiationMethod: "Transfer",
        startTime: new Date().toISOString(),
        callAttributes: utils.getCallAttributes(
          event.Details.ContactData.Attributes
        ),
        participants: [
          {
            participantKey: event.Details.ContactData.CustomerEndpoint.Address,
            type: "END_USER",
          },
        ],
      };
      if (event.Details.ContactData.Queue) {
        voiceCallFieldValues.queue = event.Details.ContactData.Queue.ARN;
      }
      result = await api.createVoiceCall(voiceCallFieldValues);
      break;
    case "executeOmniFlow": {
      let dialedNumberParam = fieldValues && fieldValues.dialedNumber;
      if (
        event.Details.ContactData &&
        event.Details.ContactData.SystemEndpoint
      ) {
        dialedNumberParam = event.Details.ContactData.SystemEndpoint.Address;
      }
      const payload = {
        flowDevName: event.Details.Parameters.flowDevName,
        fallbackQueue: event.Details.Parameters.fallbackQueue,
        dialedNumber: dialedNumberParam,
        flowInputParameters: utils.constructFlowInputParams(
          event.Details.Parameters
        ),
      };
      result = await api.executeOmniFlow(contactIdValue, payload);
      break;
    }
    case "cancelOmniFlowExecution":
      result = await api.cancelOmniFlowExecution(contactIdValue);
      break;
    case "sendMessage":
      fieldValues.callCenterApiName = config.callCenterApiName;
      result = await api.sendMessage(contactIdValue, fieldValues);
      break;
    default:
      SCVLoggingUtil.warn({
        message: `Unsupported method ${methodName}`,
        context: {},
      });
      throw new Error(`Unsupported method: ${methodName}`);
  }
  SCVLoggingUtil.info({
    message: `Response received from TelephonyService with ${contactIdValue}`,
    context: { contactId: contactIdValue, payload: result },
  });

  return result;
};
