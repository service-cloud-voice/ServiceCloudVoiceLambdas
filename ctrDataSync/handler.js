const aws = require("aws-sdk");
const SCVLoggingUtil = require("./SCVLoggingUtil");

const lambda = new aws.Lambda();
const utils = require("./utils");

function updateVoiceCallRecord(voiceCall) {
  SCVLoggingUtil.info({
    message: "CTR/updateVoiceCallRecord Request created",
    context: { contactId: voiceCall.contactId },
  });
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
  if (ctrRecord?.Attributes?.NoSync === 'true') {
    SCVLoggingUtil.info({
      message: "NoSync attribute set to True, so skipping voice call update",
      context: ctrRecord.Attributes,
    });
    return false;
  }
  return (
    ["INBOUND", "OUTBOUND", "TRANSFER", "CALLBACK", "API"].includes(
      ctrRecord.InitiationMethod
    ) &&
    ctrRecord.ContactId &&
    // if the call is a voicemail, no need to process it since the packager lambda will update the voicecall record
    !(
      ctrRecord.Attributes &&
      ctrRecord.Attributes.vm_flag &&
      ctrRecord.Recordings
    )
  );
}

exports.handler = async (event) => {
  const promises = [];
  SCVLoggingUtil.debug({
    message: "CTRDataSync event received",
    context: event,
  });
  event.Records.forEach((record) => {
    const ctr = utils.parseData(record.kinesis.data);
    if (shouldProcessCtr(ctr)) {
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
          message: "updateVoiceCallRecord response",
          context: response,
        });
      });
    } else {
      SCVLoggingUtil.error({
        message: "Encountered Non supported CTR Events: failing fast",
        context: {},
      });
    }
  });

  return Promise.all(promises);
};

exports.shouldProcessCtr = shouldProcessCtr;
