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

async function sendMessagesInBulk(payload) {
  SCVLoggingUtil.info({
    message: "Creating sendMessagesInBulk request",
    context: { payload: payload },
  });
  const jwt = await utils.generateJWT(generateJWTParams);
  await axiosWrapper.scrtEndpoint
    .post(`/voiceCalls/messages`, payload, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
        "Telephony-Provider-Name": vendorFQN,
      },
    })
    .then((response) => {
      SCVLoggingUtil.info({
        message: "Successfully sent bulk transcripts",
        context: {
          payload: {
            statusText: response.statusText,
            statusCode: response.statusCode,
          },
        },
      });
    })
    .catch((error) => {
      SCVLoggingUtil.error({
        message: "Error sending transcripts in bulk",
        context: error,
      });

      if (error.response.status === 429) {
        return { data: { result: "Error" } };
      }
    });
  return { data: { result: "Success" } };
}

async function sendRealtimeConversationEvents(contactId, payload) {
  SCVLoggingUtil.info({
    message: "Creating sendRealtimeConversationEvents request",
    context: { contactId: contactId },
  });
  const jwt = await utils.generateJWT(generateJWTParams);

  await axiosWrapper.scrtEndpoint
    .post(`/voiceCalls/${contactId}/realtimeConversationEvents`, payload, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
        "Telephony-Provider-Name": vendorFQN,
      },
    })
    .then((response) => {
      SCVLoggingUtil.info({
        message: "Successfully sent realtimeConversationEvents",
        context: {
          payload: {
            statusText: response.statusText,
            statusCode: response.statusCode,
          },
        },
      });
    })
    .catch((error) => {
      SCVLoggingUtil.error({
        message: "Error sending realtime conversationevents",
        context: error,
      });
      // Do not throw error; failing lambda execution will keep Kinesis records in stream
    });

  return { data: { result: "Success" } };
}

module.exports = {
  sendMessagesInBulk,
  sendRealtimeConversationEvents,
};
