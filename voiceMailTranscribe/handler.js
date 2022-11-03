const AWS = require("aws-sdk");
const SCVLoggingUtil = require("./SCVLoggingUtil");

const transcribe = new AWS.TranscribeService();
const s3 = new AWS.S3();
const RECORDINGS_PREFIX = "voicemail_recordings/";
const TRANSCRIPTS_PREFIX = "voicemail_transcripts/";

// This Lambda requires an event bridge to s3 recordings bucket
exports.handler = async (event) => {
  SCVLoggingUtil.debug({
    category: "voiceMailTranscribe.handler.handler",
    message: "Received event",
    context: event,
  });
  const eventRecord = event.detail;
  const bucketName = eventRecord.bucket.name;
  const key = eventRecord.object.key;
  const contactId = key.replace(RECORDINGS_PREFIX, "").replace(".wav", "");
  const fileUri = `s3://${bucketName}/${key}`;
  const loadedTags = {};
  try {
    const { TagSet } = await s3
      .getObjectTagging({
        Bucket: bucketName,
        Key: key,
      })
      .promise();
    TagSet.forEach((i) => {
      loadedTags[i.Key] = i.Value;
    });
  } catch (e) {
    SCVLoggingUtil.error({
      message: `Failed to extract tags from object`,
      context: e,
    });
    return;
  }
  const config = {
    TranscriptionJobName: contactId,
    LanguageCode: loadedTags.vm_lang || "en-US",
    MediaFormat: "wav",
    Media: {
      MediaFileUri: fileUri,
    },
    OutputBucketName: bucketName,
    OutputKey: `${TRANSCRIPTS_PREFIX}${contactId}.json`,
  };
  SCVLoggingUtil.info({ message: `Start trabscribing job`, context: config });
  return transcribe
    .startTranscriptionJob(config)
    .promise()
    .then(() => {
      SCVLoggingUtil.info({
        message: `voiceMailTranscribe handler completed successfuly`,
      });
    })
    .catch((e) => {
      SCVLoggingUtil.error({
        messge: `voiceMailTranscribe handler failed`,
        context: e,
      });
    });
};
