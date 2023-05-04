const SCVLoggingUtil = require("./SCVLoggingUtil");
const config = require("./config");
const utils = require("./utils");
const axiosWrapper = require("./axiosWrapper");

const generateJWTParams = {
  privateKeyParamName: config.privateKeyParamName,
  orgId: config.orgId,
  callCenterApiName: config.callCenterApiName,
  expiresIn: config.tokenValidFor,
};
const vendorFQN = "amazon-connect";

function handleError(error, functionName, eventType, errorMessage) {
  let context = {};
  if (error.response) {
    // The request was made and the server responded with a status code that is not 2**
    context = error.response.data;
  } else if (error.request) {
    // The request was made but no response was received
    context = error.request;
  } else {
    // Something happened in setting up the request that triggered an error
    context = error.message;
  }
  SCVLoggingUtil.error(functionName, eventType, errorMessage, context);
}

async function sendMessage(contactId, payload) {
  const jwt = await utils.generateJWT(generateJWTParams);
  const responseVal = await axiosWrapper.scrtEndpoint
    .post(`/voiceCalls/${contactId}/messages`, payload, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
        "Telephony-Provider-Name": vendorFQN,
      },
    })
    .then((response) => {
      SCVLoggingUtil.info({
        category: "contactLensProcessor.sendMessage",
        eventType: "TRANSCRIPTION",
        message: "Successfully sent transcript",
        context: { response: response },
      });
    })
    .catch((error) => {
      handleError(
        error,
        "contactLensProcessor.sendMessage",
        "TRANSCRIPTION",
        "Error sending transcript"
      );
      // Do not throw error; failing lambda execution will keep Kinesis records in stream
    });
  return { data: { result: "Success" } };
}

async function sendMessagesInBulk(payload) {
  const jwt = await utils.generateJWT(generateJWTParams);
  const responseVal = await axiosWrapper.scrtEndpoint
    .post(`/voiceCalls/messages`, payload, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
        "Telephony-Provider-Name": vendorFQN,
      },
    })
    .then((response) => {
      SCVLoggingUtil.info({
        category: "contactLensProcessor.sendMessagesInBulk",
        eventType: "TRANSCRIPTION",
        message: "Successfully sent bulk transcripts",
        context: { response: response },
      });
    })
    .catch((error) => {
      handleError(
        error,
        "contactLensProcessor.sendMessagesInBulk",
        "TRANSCRIPTION",
        "Error sending transcripts in bulk"
      );
      
      if (error.response.status === 429) {
        return { data: { result: "Error" } };
      }
    });
  return { data: { result: "Success" } };
}

async function sendRealtimeConversationEvents(contactId, payload) {
  const jwt = await utils.generateJWT(generateJWTParams);

  const responseVal = await axiosWrapper.scrtEndpoint
    .post(`/voiceCalls/${contactId}/realtimeConversationEvents`, payload, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
    })
    .then((response) => {
      SCVLoggingUtil.info({
        category: "contactLensProcessor.sendRealtimeConversationEvents",
        eventType: "INTELLIGENCESIGNALS",
        message: "Successfully sent realtime conversation events",
        context: { totalEvents: payload.events.length },
      });
    })
    .catch((error) => {
      handleError(
        error,
        "contactLensProcessor.sendRealtimeConversationEvents",
        SCVLoggingUtil.EVENT_TYPE.INTELLIGENCESIGNALS,
        "Error sending realtime conversationevents"
      );
      // Do not throw error; failing lambda execution will keep Kinesis records in stream
    });

 return { data: { result: "Success" } };
}


module.exports = {
  sendMessage,
  sendMessagesInBulk,
  sendRealtimeConversationEvents,
};
