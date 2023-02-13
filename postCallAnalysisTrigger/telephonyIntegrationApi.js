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

async function persistSignals(contactId, payload) {
  const jwt = await utils.generateJWT(generateJWTParams);
  SCVLoggingUtil.debug({
    category: "postCallAnalysisTrigger.telephonyIntegrationApi.persistSignals",
    message: "jwt token",
    context: jwt,
  });
  await axiosWrapper.scrtEndpoint.post(
    `/voiceCalls/${contactId}/postConversationEvents`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
        "Telephony-Provider-Name": vendorFQN,
      },
    }
  );
}

module.exports = {
  persistSignals,
};
