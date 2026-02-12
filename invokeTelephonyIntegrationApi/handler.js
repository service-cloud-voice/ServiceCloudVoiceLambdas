const SCVLoggingUtil = require("./SCVLoggingUtil");
const api = require("./telephonyIntegrationApi");
const secretUtils = require("./secretUtils");
const cacheUtils = require("./cacheUtils");
const utils = require("./utils");
const config = require("./config");

const WEBRTC_DEFAULT = "WebRTC_Default";

function getWebRTCAttributeValue(attributeValue, endPoint) {
  if (attributeValue) {
    return attributeValue;
  }
  else if (endPoint && endPoint.Address) {
    return endPoint.Address;
  }
  else {
    return WEBRTC_DEFAULT;
  }
}

function getCallTypeSpecificAttributes(event) {
  let callSubtype, from, to;

  if (event.Details.ContactData.SegmentAttributes['connect:Subtype'].ValueString === 'connect:WebRTC') {
    callSubtype = "WebRTC";
  }
  else{
    callSubtype = "PSTN";
  }

  if (callSubtype === "WebRTC") {
    from = getWebRTCAttributeValue(event.Details.ContactData.Attributes.WebRTC_From, event.Details.ContactData.CustomerEndpoint);
    to = getWebRTCAttributeValue(event.Details.ContactData.Attributes.WebRTC_To, event.Details.ContactData.SystemEndpoint);
  }
  else {
    from = event.Details.ContactData.CustomerEndpoint.Address;
    to = event.Details.ContactData.SystemEndpoint.Address;
  }

  return {
    to, from, callSubtype
  };
}

function getParticipantKey(event, callSubtype) {
  if (callSubtype === "WebRTC") {
    return WEBRTC_DEFAULT;
  }
  return event.Details.ContactData.CustomerEndpoint.Address;
}

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
  const callOrigin = event.Details.ContactData?.Attributes?.callOrigin || "";

  // Extract secret name from call attributes with precedence over environment variable
  const secretNameFromAttributes = event.Details.ContactData?.Attributes?.secretName ||  event.Details.Parameters?.fieldValues?.secretName  || null;
  const accessSecretNameFromAttributes = event.Details.ContactData?.Attributes?.accessSecretName ||  event.Details.Parameters?.fieldValues?.accessSecretName || null;

  SCVLoggingUtil.debug({
    message: `Invoke ${methodName} request with ${contactIdValue}`,
    context: {
      contactId: contactIdValue,
      payload: fieldValues,
      methodName: methodName,
      secretSource: secretNameFromAttributes ? 'callAttributes' : 'environment',
      accessSecretSource: accessSecretNameFromAttributes ? 'callAttributes' : 'environment'
    },
  });

  // Determine the resolved secret name used (attributes takes precedence over environment)
  const resolvedSecretName = secretNameFromAttributes || config.secretName;
  if (!resolvedSecretName) {
    throw new Error('Secret name not provided in call attributes or SECRET_NAME environment variable');
  }

  // Get configuration from secret with proper key resolution
  const configData =
    (await secretUtils.getSecretConfigs(resolvedSecretName)) || {};

  switch (methodName) {
    case "createVoiceCall":
      let callTypeSpecificAttributes= getCallTypeSpecificAttributes(event);
      voiceCallFieldValues = {
        callCenterApiName: configData.callCenterApiName,
        vendorCallKey: contactIdValue,
        to: callTypeSpecificAttributes.to,
        from: callTypeSpecificAttributes.from,
        initiationMethod: "Inbound",
        startTime: new Date().toISOString(),
        callSubtype: callTypeSpecificAttributes.callSubtype,
        callAttributes: utils.getCallAttributes(
          event.Details.ContactData.Attributes
        ),
        participants: [
          {
            participantKey: getParticipantKey(event, callTypeSpecificAttributes.callSubtype),
            type: "END_USER",
          },
        ],
      };
      if (callOrigin) {
        voiceCallFieldValues.callOrigin = callOrigin;
      }
      SCVLoggingUtil.debug({
        message: `Invoke ${methodName} request with ${contactIdValue}`,
        context: { contactId: contactIdValue, payload: voiceCallFieldValues },
      });
      result = await api.createVoiceCall(voiceCallFieldValues, configData);

      break;
    case "updateVoiceCall":
      fieldValues.callCenterApiName = configData.callCenterApiName;
      result = await api.updateVoiceCall(contactIdValue, fieldValues, configData);
      break;
    case "createTransferVC":
      voiceCallFieldValues = {
        callCenterApiName: configData.callCenterApiName,
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
      if (callOrigin) {
        voiceCallFieldValues.callOrigin = callOrigin;
      }
      if (event.Details.ContactData.Queue) {
        voiceCallFieldValues.queue = event.Details.ContactData.Queue.ARN;
      }
      result = await api.createVoiceCall(voiceCallFieldValues, configData);
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
        transferTarget: event.Details.Parameters.transferTarget,
        dialedNumber: dialedNumberParam,
        flowInputParameters: utils.constructFlowInputParams(
          event.Details.Parameters
        ),
      };
      result = await api.executeOmniFlow(contactIdValue, payload, configData);
      break;
    }
    case "cancelOmniFlowExecution":
      result = await api.cancelOmniFlowExecution(contactIdValue, configData);
      break;
    case "rerouteFlowExecution":
      result = await api.rerouteFlowExecution(contactIdValue, configData);
      break;
    case "sendMessage":
      fieldValues.callCenterApiName = configData.callCenterApiName;
      result = await api.sendMessage(contactIdValue, fieldValues, configData);
      break;
    case "callbackExecution":
      const payload = {
        callbackNumber: event.Details.Parameters.customerCallbackNumber
      };
      result = await api.callbackExecution(contactIdValue, payload, configData);
      break;
    case "routeVoiceCall":
      const routePayload = {
        routingTarget: event.Details.Parameters.routingTarget,
        fallbackQueue: event.Details.Parameters.fallbackQueue,
        flowInputParameters: utils.constructFlowInputParams(
          event.Details.Parameters
        ),
      };
      result = await api.routeVoiceCall(contactIdValue, routePayload, configData);
      break;
    case "updateCache":
      const cacheData = {
        contactId: contactIdValue,
        secretName: secretNameFromAttributes,
        timestamp: new Date().toISOString(),
      };
      const updated = await cacheUtils.storeInCache(contactIdValue, cacheData);
      if (!updated) {
        result = {
          statusCode: 500,
          message: "Failed to update cache",
          contactId: contactIdValue
        };
        SCVLoggingUtil.error({
          message: `Failed to update cache for contact ${contactIdValue}`,
          context: { contactId: contactIdValue, payload: cacheData }
        });
      } 
      else {
        result = {
          statusCode: 200,
          message: "Cache updated successfully",
          contactId: contactIdValue
        };
      }
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

  // Store contact ID mapping in S3 after VoiceCall creation (when secretName is provided in call attributes)
  if(secretNameFromAttributes && (methodName === "createVoiceCall" || methodName === "createTransferVC")) {
    const cacheData = {
      contactId: contactIdValue,
      secretName: secretNameFromAttributes,
      timestamp: new Date().toISOString(),
      accessSecretName: accessSecretNameFromAttributes,
      voiceCallId: result.voiceCallId
    };
    await cacheUtils.storeInCache(contactIdValue, cacheData);

    SCVLoggingUtil.debug({
      message: `Cache data stored for contact ${contactIdValue}`,
      context: {
        contactId: contactIdValue,
        voiceCallId: result.voiceCallId,
        secretName: secretNameFromAttributes,
        accessSecretName: accessSecretNameFromAttributes
      }
    });
  }

  return result;
};
