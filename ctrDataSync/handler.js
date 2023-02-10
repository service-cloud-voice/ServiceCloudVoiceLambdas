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
        contactId: voiceCall.contactId,
      },
    },
  };

  const params = {
    FunctionName: process.env.INVOKE_TELEPHONY_INTEGRATION_API_ARN,
    Payload: JSON.stringify(payload),
  };

  return lambda.invoke(params).promise();
}

function shouldProcessCtr(ctrRecord) {
  return (
    ctrRecord.InitiationMethod === "INBOUND" ||
    ctrRecord.InitiationMethod === "OUTBOUND" ||
    ctrRecord.InitiationMethod === "TRANSFER" ||
    ctrRecord.InitiationMethod === "CALLBACK" ||
    ctrRecord.InitiationMethod === "API"
  );
}

exports.handler = async (event) => {
  const promises = [];
  SCVLoggingUtil.debug({
    category: "ctrDataSync.handler",
    message: "Received event",
    context: event,
  });
  event.Records.forEach((record) => {
    const ctr = utils.parseData(record.kinesis.data);
    if (shouldProcessCtr(ctr)) {
      const isVM = ctr.Attributes && ctr.Attributes.vm_flag;
      // if the ctr data sync has the Voicemail flag, no need to process it since the packager lambda will update the voicecall record
      if (ctr.ContactId && !isVM) {
        const voiceCall = utils.transformCTR(ctr);
        SCVLoggingUtil.debug({
          category: "ctrDataSync.handler",
          message: "Transformed CTR to voice call",
          context: voiceCall,
        });
        const updatePromise = updateVoiceCallRecord(voiceCall);

        promises.push(updatePromise);

        updatePromise.then((response) => {
          SCVLoggingUtil.info({
            category: "CTRSyncLambda handler",
            eventType: "VOICECALL",
            message: "updateVoiceCallRecord response",
            context: response,
          });
        });
      }
    } else {
      SCVLoggingUtil.error({
        category: "updateVoiceCallRecord response",
        eventType: "VOICECALL",
        message: "Encountered Non supported CTR Events: failing fast",
        context: {},
      });
    }
  });

  return Promise.all(promises);
};
