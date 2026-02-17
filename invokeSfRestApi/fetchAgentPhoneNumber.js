const SCVLoggingUtil = require("./SCVLoggingUtil");

async function fetchAgentPhoneNumber(event) {
    // TODO: Implement the logic for fetching the agent phone number from contactID
    // console.log("event details:");
    // console.log(event.Details?.ContactData?.ContactId);
    // console.log(event);
    return {
        success: true,
        outboundPhoneNumber: "",
      };
}

module.exports = {
    fetchAgentPhoneNumber,
};