const aws = require("aws-sdk");
const SCVLoggingUtil = require("./SCVLoggingUtil");

const lambda = new aws.Lambda();
const utils = require("./utils");

function updateVoiceCallRecord(voiceCall) {
  const payload = {
    Details: {
      Parameters: {
        methodName: "updateVoiceCall",
        fieldValues: voiceCall.fields,
        contactId: voiceCall.contactId
      }
    }
  };

  const params = {
    FunctionName: process.env.INVOKE_TELEPHONY_INTEGRATION_API_ARN,
    Payload: JSON.stringify(payload)
  };

  return lambda.invoke(params).promise();
}

exports.handler = async event => {
  const promises = [];

  event.Records.forEach(record => {
    const ctr = utils.parseData(record.kinesis.data);

    if (ctr.ContactId) {
      const voiceCall = utils.transformCTR(ctr);
      const updatePromise = updateVoiceCallRecord(voiceCall);

      promises.push(updatePromise);

      updatePromise.then(response => {
        SCVLoggingUtil.info(
          "updateVoiceCallRecord response",
          SCVLoggingUtil.EVENT_TYPE.VOICECALL,
          "CTRSyncLambda handler",
          response
        );
      });
    }
  });

  return Promise.all(promises);
};
