const SCVLoggingUtil = require("./SCVLoggingUtil");
const config = require("./config");
const utils = require("./utils");
const axiosWrapper = require("./axiosWrapper");

const vendorFQN = "amazon-connect";

async function persistSignals(contactId, payload) {
  const jwt = await utils.generateJWT();
  const scrtEndpoint = await axiosWrapper.getScrtEndpoint();

  SCVLoggingUtil.info({
    message: "Persist Signal Request",
    context: { contactId: contactId, payload: payload },
  });

  await scrtEndpoint
    .post(`/voiceCalls/${contactId}/postConversationEvents`, payload, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
        "Telephony-Provider-Name": vendorFQN,
      },
    })
    .then((response) => {
      SCVLoggingUtil.info({
        message: "Successfully sent Persist signals",
        context: { contactId: contactId, payload: response },
      });
    })
    .catch((error) => {
      SCVLoggingUtil.error({
        message: "Error sending Persist signals",
        context: error,
      });
    });
}

module.exports = {
  persistSignals,
};
