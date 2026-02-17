const aws = require("aws-sdk");
const SCVLoggingUtil = require("./SCVLoggingUtil");
const { retrieveFromCache } = require("./cacheUtils");
const config = require("./config");

const lambda = new aws.Lambda();
const transcribe = new aws.TranscribeService();
const s3 = new aws.S3();

const RECORDINGS_PREFIX = "voicemail_recordings/";
const TRANSCRIPTS_PREFIX = "voicemail_transcripts/";
const MAX_ROUTING_ATTEMPTS = 4;

// This Lambda requires env variables invoke_telephony_integration_api_arn and a triger bridge for S3 inserts
async function sendMessage(
  contactId,
  transcript,
  initTimestamp,
  endTimestamp,
  secretName
) {
  SCVLoggingUtil.info({
    message: "VoiceMailPackaging sendMessage Request created",
    context: { contactId: contactId },
  });

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
          secretName: secretName,
        },
      },
    },
  };
  const params = {
    FunctionName: config.invokeTelephonyIntegrationApiArn,
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
  endTime,
  secretName
) {
  SCVLoggingUtil.info({
    message: "VoiceMailPackaging updateVoiceCallRecord Request created",
    context: { contactId: contactId },
  });
  const fieldValues = isActiveCall
    ? {
        recordingLocation,
        totalRecordingDuration: duration,
        startTime,
        endTime,
        callOrigin: "Voicemail",
        isActiveCall: true,
        secretName: secretName,
      }
    : {
        secretName: secretName,
      };
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
    FunctionName: config.invokeTelephonyIntegrationApiArn,
    Payload: JSON.stringify(payload),
  };
  return lambda.invoke(params).promise();
}

async function executeOmniFlow(contactId, dialedNumber, secretName) {
  SCVLoggingUtil.info({
    message: "VoiceMailPackaging executeOmniFlow Request created",
    context: { contactId: contactId },
  });
  const payload = {
    Details: {
      Parameters: {
        methodName: "executeOmniFlow",
        fieldValues: {
          dialedNumber,
          secretName: secretName,
        },
        contactId,
      },
    },
  };
  const params = {
    FunctionName: config.invokeTelephonyIntegrationApiArn,
    Payload: JSON.stringify(payload),
  };
  return lambda.invoke(params).promise();
}

exports.handler = async (event) => {
  SCVLoggingUtil.debug({
    message: "VoiceMailPackaging event received",
    context: { payload: event },
  });
  const result = [];
  const eventRecord = event.detail;
  const bucketName = eventRecord.bucket.name;
  const key = eventRecord.object.key;
  if (!key.endsWith(".json")) {
    return Promise.resolve({ success: true });
  }
  SCVLoggingUtil.debug({ message: `Processing transcript`, context: key });
  const wavKey = key
    .replace(TRANSCRIPTS_PREFIX, RECORDINGS_PREFIX)
    .replace(".json", ".wav");
  const contactId = key.replace(TRANSCRIPTS_PREFIX, "").replace(".json", "");

  // Fetch secret name from cache using contactId
  let secretName = null;
  try {
    const cacheData = await retrieveFromCache(contactId);
    if (cacheData && cacheData.secretName) {
      secretName = cacheData.secretName;
    }
  } catch (error) {
    SCVLoggingUtil.error({
      message: "Error retrieving secret name from cache",
      context: { contactId, error: error.message },
    });
  }

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
      loadedTags.vm_endTimestamp,
      secretName
    );
    result.push(vmCreationResponse);
    SCVLoggingUtil.info({
      message: `updateVoiceCallRecord to create VM for ${contactId}`,
      context: { contactId: contactId, payload: vmCreationResponse },
    });
    // send the transcript
    const sendMessageResponse = await sendMessage(
      contactId,
      transcript,
      parseInt(loadedTags.vm_initTimestamp, 10),
      parseInt(loadedTags.vm_endTimestamp, 10),
      secretName
    );
    result.push(sendMessageResponse);
    SCVLoggingUtil.info({
      message: `sendMessage for the voiceMail transcript`,
      context: { contactId: contactId, payload: sendMessageResponse },
    });

    // route the VM (up to 4 attempts).
    let routingResponse;
    for (let i = 0; i < MAX_ROUTING_ATTEMPTS; i++) {
      await new Promise((r) =>
        setTimeout(r, config.delayBeforeRoutingVmSec * 1000)
      );
      routingResponse = await executeOmniFlow(
        contactId,
        loadedTags.vm_dialedNumber,
        secretName
      );
      SCVLoggingUtil.info({
        message: `executeOmniFlow for ${loadedTags.vm_dialedNumber}, attempt ${
          i + 1
        } out of ${MAX_ROUTING_ATTEMPTS}, delay ${
          config.delayBeforeRoutingVmSec
        } sec`,
        context: { contactId: contactId, payload: routingResponse },
      });
      if (!routingResponse.FunctionError) {
        break;
      }
    }
    result.push(routingResponse);

    // close the VM record
    const closeVmResponse = await updateVoiceCallRecord(
      contactId,
      false,
      null,
      null,
      null,
      null,
      secretName
    );
    result.push(closeVmResponse);
    SCVLoggingUtil.info({
      message: `updateVoiceCallRecord to close record`,
      context: { contactId: contactId, payload: closeVmResponse },
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
      context: { payload: result },
    });
    return result;
  } catch (err) {
    SCVLoggingUtil.error({
      message: `voiceMailPackager handler failed for contactID ${contactId}`,
      context: { payload: err },
    });
    throw err;
  }
};