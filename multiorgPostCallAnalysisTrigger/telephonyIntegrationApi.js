const SCVLoggingUtil = require("./SCVLoggingUtil");
const config = require("./config");
const utils = require("./utils");
const axiosWrapper = require("./axiosWrapper");

const vendorFQN = "amazon-connect";

async function persistSignals(contactId, payload, secretConfig) {
  const generateJWTParams = {
    privateKey: secretConfig.privateKey,
    orgId: secretConfig.orgId,
    callCenterApiName: secretConfig.callCenterApiName,
    expiresIn: config.tokenValidFor,
  };

  const jwt = await utils.generateJWT(generateJWTParams);
  SCVLoggingUtil.info({
    message: "Persist Signal Request",
    context: { contactId: contactId, payload: payload },
  });

  try {
    const response = await axiosWrapper
      .getScrtEndpoint(secretConfig)
      .post(`/voiceCalls/${contactId}/postConversationEvents`, payload, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
          "Telephony-Provider-Name": vendorFQN,
        },
      });

    SCVLoggingUtil.info({
      message: `persistSignals API response received. Contact Id: ${contactId}`,
      context: { contactId: contactId, response: response.status },
    });

    return response.data;
  } catch (error) {
    SCVLoggingUtil.error({
      message: `persistSignals API request failed. Contact Id: ${contactId}`,
      context: { contactId: contactId, error: error.message },
    });
    throw error;
  }
}

module.exports = {
  persistSignals,
};