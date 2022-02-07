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

async function sendMessage(contactId, payload) {
  const jwt = await utils.generateJWT(generateJWTParams);

  const responseVal = await axiosWrapper.scrtEndpoint
    .post(`/voiceCalls/${contactId}/messages`, payload, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
        "Telephony-Provider-Name": vendorFQN
      }
    })
    .then(response => {
      SCVLoggingUtil.info(
        "contactLensConsumer.sendMessage",
        SCVLoggingUtil.EVENT_TYPE.TRANSCRIPTION,
        "Successfully sent transcript",
        { messageId: payload.messageId }
      );
      return response;
    })
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
        "contactLensConsumer.sendMessage",
        SCVLoggingUtil.EVENT_TYPE.TRANSCRIPTION,
        "Error sending transcript",
        context
      );
      // Do not throw error; failing lambda execution will keep Kinesis records in stream
      return { data: { result: "Error" } };
    });

  return responseVal.data;
}

module.exports = {
  sendMessage
};
