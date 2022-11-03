const aws = require("aws-sdk");
const SCVLoggingUtil = require("./SCVLoggingUtil");

const lambda = new aws.Lambda();
const transcribe = new aws.TranscribeService();
const s3 = new aws.S3();

const INVOKE_TELEPHONY_INTEGRATION_API_ARN =
  process.env.invoke_telephony_integration_api_arn;
const RECORDINGS_PREFIX = "voicemail_recordings/";
const TRANSCRIPTS_PREFIX = "voicemail_transcripts/";

// This Lambda requires env variables invoke_telephony_integration_api_arn and a triger bridge for S3 inserts
async function sendMessage(contactId, transcript, initTimestamp, endTimestamp) {
  const payload = {
    Details: {
      Parameters: {
        methodName: "sendMessage",
        contactId,
        fieldValues: {
          messageId: contactId,
          startTime: initTimestamp,
          endTime: endTimestamp,
          content: transcript,
          participantId: "END_USER",
          senderType: "END_USER",
        },
      },
    },
  };
  const params = {
    FunctionName: INVOKE_TELEPHONY_INTEGRATION_API_ARN,
    Payload: JSON.stringify(payload),
  };
  return lambda.invoke(params).promise();
}

async function updateVoiceCallRecord(
  contactId,
  isActiveCall,
  recordingLocation,
  duration,
  startTime,
  endTime
) {
  const fieldValues = isActiveCall
    ? {
        recordingLocation,
        totalRecordingDuration: duration,
        startTime,
        endTime,
        callOrigin: "Voicemail",
        isActiveCall: true,
      }
    : {};
  const payload = {
    Details: {
      Parameters: {
        methodName: "updateVoiceCall",
        fieldValues,
        contactId,
      },
    },
  };
  const params = {
    FunctionName: INVOKE_TELEPHONY_INTEGRATION_API_ARN,
    Payload: JSON.stringify(payload),
  };
  return lambda.invoke(params).promise();
}

async function executeOmniFlow(contactId, dialedNumber) {
  const payload = {
    Details: {
      Parameters: {
        methodName: "executeOmniFlow",
        fieldValues: { dialedNumber },
        contactId,
      },
    },
  };
  const params = {
    FunctionName: INVOKE_TELEPHONY_INTEGRATION_API_ARN,
    Payload: JSON.stringify(payload),
  };
  return lambda.invoke(params).promise();
}

exports.handler = async (event) => {
  SCVLoggingUtil.debug({
    category: "voiceMailPackaging.handler.handler",
    message: "Received event",
    context: event,
  });
  const result = [];
  const eventRecord = event.detail;
  const bucketName = eventRecord.bucket.name;
  const key = eventRecord.object.key;
  if (!key.endsWith(".json")) {
    return Promise.resolve({ success: true });
  }
  SCVLoggingUtil.info(`Processing transcript`, key);
  const wavKey = key
    .replace(TRANSCRIPTS_PREFIX, RECORDINGS_PREFIX)
    .replace(".json", ".wav");
  const contactId = key.replace(TRANSCRIPTS_PREFIX, "").replace(".json", "");
  try {
    // get the tags in the wav file that are needed to update the VM voiceCall and execute Omni flow
    const { TagSet } = await s3
      .getObjectTagging({
        Bucket: bucketName,
        Key: wavKey,
      })
      .promise();
    const loadedTags = {};
    TagSet.forEach((i) => {
      loadedTags[i.Key] = i.Value;
    });

    // Get the transcript file content
    const s3Data = await s3
      .getObject({
        Bucket: bucketName,
        Key: key,
      })
      .promise();

    const fileContent = JSON.parse(s3Data.Body.toString("utf-8"));
    const transcript = fileContent.results.transcripts[0].transcript;

    // First, update the voiceCall to convert it to a Voicemail and to leave the conversation going so we could send the transcript.
    // update duration, start and end time
    const vmCreationResponse = await updateVoiceCallRecord(
      contactId,
      true,
      loadedTags.vm_recordingUrl,
      parseInt(loadedTags.vm_duration, 10),
      loadedTags.vm_initTimestamp,
      loadedTags.vm_endTimestamp
    );
    result.push(vmCreationResponse);
    SCVLoggingUtil.info({
      message: `updateVoiceCallRecord to create VM for ${contactId}`,
      context: vmCreationResponse,
    });
    // send the transcript
    const sendMessageResponse = await sendMessage(
      contactId,
      transcript,
      parseInt(loadedTags.vm_initTimestamp, 10),
      parseInt(loadedTags.vm_endTimestamp, 10)
    );
    result.push(sendMessageResponse);
    SCVLoggingUtil.info({
      message: `sendMessage`,
      context: sendMessageResponse,
    });

    // route the VM
    const routingResponse = await executeOmniFlow(
      contactId,
      loadedTags.vm_dialedNumber
    );
    result.push(routingResponse);
    SCVLoggingUtil.info({
      message: `executeOmniFlow for ${loadedTags.vm_dialedNumber}`,
      context: routingResponse,
    });
    // close the VM record
    const closeVmResponse = await updateVoiceCallRecord(contactId);
    result.push(closeVmResponse);
    SCVLoggingUtil.info({
      message: `updateVoiceCallRecord to close record`,
      context: closeVmResponse,
    });
    // Finally, delete the transcription job
    result.push(
      await transcribe
        .deleteTranscriptionJob({
          TranscriptionJobName: contactId,
        })
        .promise()
    );

    SCVLoggingUtil.info({
      message: `voiceMailPackager handler completed successfully`,
    });
    return result;
  } catch (e) {
    SCVLoggingUtil.error({
      message: `voiceMailPackager handler failed for contactID ${contactId}`,
      context: e,
    });
    throw e;
  }
};
