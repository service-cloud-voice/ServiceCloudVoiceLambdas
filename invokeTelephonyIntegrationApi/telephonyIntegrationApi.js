const SCVLoggingUtil = require("./SCVLoggingUtil");
const config = require("./config");
const utils = require("./utils");
const axiosWrapper = require("./axiosWrapper");

const generateJWTParams = {
  privateKeyParamName: config.privateKeyParamName,
  orgId: config.orgId,
  callCenterApiName: config.callCenterApiName,
  expiresIn: config.tokenValidFor
};
const vendorFQN = "amazon-connect";

/**
 * Create conversation states and records at Salesforce side to represent an Amazon Connect contact.
 *
 * @param {object} fieldValues - Metadata and data of the to-be-created VoiceCall conversation.
 * @param {string} fieldValues.callCenterApiName - API name of the CallCenter setup record to which this VoiceCall belongs.
 * @param {string} fieldValues.parentVoiceCallId - The ID of the parent VoiceCall from which the current VoiceCall was transferred.
 * @param {string} fieldValues.vendorCallKey - The vendor-specific ID of this VoiceCall.
 * @param {string} fieldValues.to - The `to` phone number of this VoiceCall.
 * @param {string} fieldValues.from - The `from` phone number of this VoiceCall.
 * @param {string} fieldValues.initiationMethod - Specifies how this VoiceCall was created. E.g., "Inbound", "Outbound", "Transfer".
 * @param {string} fieldValues.startTime - The start timestamp of this VoiceCall.
 * @param {string} fieldValues.callAttributes - JSON containing key-value pairs of attributes set in contact flow.
 * @param {array}  fieldValues.participants - The participants of this VoiceCall.
 * @param {string} fieldValues.participants[0].participantKey - The vendor-specifc unique identifier of a participant.
 *
 * @return {object} result.voiceCallRecordId - The SObject ID of the created VoiceCall record.
 * @return {object} result.errors - Field errors and record creation errors.
 */
async function createVoiceCall(fieldVals) {
  const fieldValues = fieldVals;
  const jwt = await utils.generateJWT(generateJWTParams);

  fieldValues.callCenterApiName = generateJWTParams.callCenterApiName;

  const responseVal = await axiosWrapper.scrtEndpoint
    .post("/voiceCalls", fieldValues, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
        "Telephony-Provider-Name": vendorFQN
      }
    })
    .then(response => response)
    .catch(error => {
      let context = {};
      if (error.response) {
        // The request was made and the server responded with a status code that falls out of the range of 2xx
        context = error.response.data;
      } else if (error.request) {
        // The request was made but no response was received
        context = error.request;
      } else {
        // Something happened in setting up the request that triggered an error
        context = error.message;
      }
      SCVLoggingUtil.error(
        "invokeTelephonyIntegrationApi.telephonyIntegrationApi.createVoiceCall",
        SCVLoggingUtil.EVENT_TYPE.VOICECALL,
        "Error creating VoiceCall record",
        context
      );
      throw new Error("Error creating VoiceCall record");
    });

  return responseVal.data;
}

/**
 * Update a VoiceCall record at Salesforce side.
 *
 * @param {string} contactId - The vendor-specific ID or the SObject ID of the to-be-updated VoiceCall record.
 * @param {object} fieldValues - Metadata and data of the to-be-updated VoiceCall record.
 *
 * @return {object}
 */
async function updateVoiceCall(contactId, fieldValues) {
  const jwt = await utils.generateJWT(generateJWTParams);

  const patchResponse = await axiosWrapper.scrtEndpoint
    .patch(`/voiceCalls/${contactId}`, fieldValues, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
        "Telephony-Provider-Name": vendorFQN
      }
    })
    .then(response => response)
    .catch(error => {
      let context = {};
      if (error.response) {
        // The request was made and the server responded with a status code that falls out of the range of 2xx
        context = error.response.data;
      } else if (error.request) {
        // The request was made but no response was received
        context = error.request;
      } else {
        // Something happened in setting up the request that triggered an error
        context = error.message;
      }
      SCVLoggingUtil.error(
        "invokeTelephonyIntegrationApi.telephonyIntegrationApi.updateVoiceCall",
        SCVLoggingUtil.EVENT_TYPE.VOICECALL,
        "Error updating VoiceCall record",
        context
      );
      throw new Error(`Error updating VoiceCall record.${context}`);
    });

  return patchResponse.data;
}

/**
 * Execute an Omni Flow for  a VoiceCall record at Salesforce side.
 *
 * @param {string} contactId - The vendor-specific ID or the SObject ID of the VoiceCall record for which routing instructions need to be generated by excuting the flow.
 * @param {object} payload - Contains flowDevName, fallbackQueue and any additional flowInputParameters.
 *
 * @return {object}
 */
async function executeOmniFlow(contactId, payload) {
  const jwt = await utils.generateJWT(generateJWTParams);
  const responseVal = await axiosWrapper.scrtEndpoint
    .patch(`/voiceCalls/${contactId}/omniFlow`, payload, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
        "Telephony-Provider-Name": vendorFQN
      }
    })
    .then(response => response)
    .catch(error => {
      let context = {};
      if (error.response) {
        // The request was made and the server responded with a status code that falls out of the range of 2xx
        context = error.response.data;
      } else if (error.request) {
        // The request was made but no response was received
        context = error.request;
      } else {
        // Something happened in setting up the request that triggered an error
        context = error.message;
      }
      SCVLoggingUtil.error(
        "invokeTelephonyIntegrationApi.telephonyIntegrationApi.executeOmniFlow",
        SCVLoggingUtil.EVENT_TYPE.VOICECALL,
        "Error executing Omni Flow",
        context
      );
      throw new Error("Error executing Omni Flow");
    });

  return responseVal.data;
}

/**
 * Cancel Omni Flow Execution for Voicecall
 *
 * @param {string} contactId - The vendor-specific ID or the SObject ID of the VoiceCall record for which PSR needs to be cleared.
 *
 * @return {object}
 */
async function cancelOmniFlowExecution(contactId) {
  const jwt = await utils.generateJWT(generateJWTParams);

  const responseVal = await axiosWrapper.scrtEndpoint
    .patch(`/voiceCalls/${contactId}/clearRouting`, null, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json"
      }
    })
    .then(response => response)
    .catch(error => {
      let context = {};
      if (error.response) {
        // The request was made and the server responded with a status code that falls out of the range of 2xx
        context = error.response.data;
      } else if (error.request) {
        // The request was made but no response was received
        context = error.request;
      } else {
        // Something happened in setting up the request that triggered an error
        context = error.message;
      }
      SCVLoggingUtil.error(
        "invokeTelephonyIntegrationApi.telephonyIntegrationApi.cancelOmniFlowExecution",
        SCVLoggingUtil.EVENT_TYPE.VOICECALL,
        "Error cancelling OmniFlowExecution",
        context
      );
      throw new Error("Error cancelling OmniFlowExecution");
    });

  return responseVal.data;
}

module.exports = {
  createVoiceCall,
  updateVoiceCall,
  executeOmniFlow,
  cancelOmniFlowExecution
};
