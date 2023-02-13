const SCVLoggingUtil = require("./SCVLoggingUtil");
const api = require("./telephonyIntegrationApi");
const config = require("./config");
const utils = require("./utils");

exports.handler = async (event) => {
  SCVLoggingUtil.debug({
    category: "invokeTelephonyIntegrationApi.handler.handler",
    message: "Received event",
    context: event,
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
            type: "END_USER",
          },
        ],
      };
      SCVLoggingUtil.debug({
        category: "invokeTelephonyIntegrationApi.handler.handler",
        message: `Invoke Create VoiceCall request with ${contactId || event.Details.ContactData.ContactId}`,
        context: voiceCallFieldValues,
      });
      result = await api.createVoiceCall(voiceCallFieldValues);
      SCVLoggingUtil.debug({
        category: "invokeTelephonyIntegrationApi.handler.handler",
        message: `Response received from Create VoiceCall with ${contactId || event.Details.ContactData.ContactId}`,
        context: result,
      });
      break;
    case "updateVoiceCall":
      fieldValues.callCenterApiName = config.callCenterApiName;
      result = await api.updateVoiceCall(contactId, fieldValues);
      SCVLoggingUtil.debug({
        category: "invokeTelephonyIntegrationApi.handler.handler",
        message: `Response received from update voiceCall with ${contactId || event.Details.ContactData.ContactId}`,
        context: result,
      });
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
            type: "END_USER",
          },
        ],
      };
      if (event.Details.ContactData.Queue) {
        voiceCallFieldValues.queue = event.Details.ContactData.Queue.ARN;
      }
      SCVLoggingUtil.debug({
        category: "invokeTelephonyIntegrationApi.handler.handler",
        message: `Invoke Create TransferVC request with ${contactId || event.Details.ContactData.ContactId}`,
        context: voiceCallFieldValues,
      });
      result = await api.createVoiceCall(voiceCallFieldValues);
      SCVLoggingUtil.debug({
        category: "invokeTelephonyIntegrationApi.handler.handler",
        message: `Response received from Create TransferVC with ${contactId || event.Details.ContactData.ContactId}`,
        context: result,
      });
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
      const contactIdParam = contactId || event.Details.ContactData.ContactId;
      SCVLoggingUtil.debug({
        category: "invokeTelephonyIntegrationApi.handler.handler",
        message: `Invoke execute Omni Flow request with ${contactIdParam}`,
        context: payload,
      });
      result = await api.executeOmniFlow(contactIdParam, payload);
      SCVLoggingUtil.debug({
        category: "invokeTelephonyIntegrationApi.handler.handler",
        message: `Response received from execute Omni Flow with ${contactIdParam}`,
        context: result,
      });
      break;
    }
    case "cancelOmniFlowExecution":
      SCVLoggingUtil.debug({
        category: "invokeTelephonyIntegrationApi.handler.handler",
        message: `Invoke cancel Omni Flow request with ${contactId || event.Details.ContactData.ContactId}`,
        context: event.Details.Parameters.ContactId,
      });
      result = await api.cancelOmniFlowExecution(
        event.Details.Parameters.ContactId
      );
      SCVLoggingUtil.debug({
        category: "invokeTelephonyIntegrationApi.handler.handler",
        message: `Response received from cancel Omni Flow with ${contactId || event.Details.ContactData.ContactId}`,
        context: result,
      });
      break;
    case "sendMessage":
      fieldValues.callCenterApiName = config.callCenterApiName;
      SCVLoggingUtil.debug({
        category: "invokeTelephonyIntegrationApi.handler.handler",
        message: `Invoke sendMessage with ${contactId || event.Details.ContactData.ContactId}`,
        context: fieldValues,
      });
      result = await api.sendMessage(contactId, fieldValues);
      SCVLoggingUtil.debug({
        category: "invokeTelephonyIntegrationApi.handler.handler",
        message: `Response received for sendMessage with ${contactId || event.Details.ContactData.ContactId}`,
        context: result,
      });
      break;
    default:
      SCVLoggingUtil.warn({
        category: "invokeTelephonyIntegrationApi.handler.handler",
        eventType: "VOICECALL",
        message: `Unsupported method ${methodName}`,
        context: {},
      });
      throw new Error(`Unsupported method: ${methodName}`);
  }

  return result;
};