const SCVLoggingUtil = require("./SCVLoggingUtil");
const awsUtil = require("./awsUtils");
const sfRestApi = require("./sfRestApi");
const config = require("./config");

async function fetchTranscriptFromCLFile(params, contactIdRelatedRecordMap) {
  const data = await awsUtil.getS3Object(params);
  const clObject = JSON.parse(data.Body.toString("ascii"));
  SCVLoggingUtil.debug({
    message: "Successfully loaded the Contact Lens post-call json file.",
    context: { payload: clObject },
  });
  const convTranscriptEntries = await awsUtil.getTranscript(
    clObject,
    contactIdRelatedRecordMap
  );
  SCVLoggingUtil.debug({
    message: "Successfully got transcripts from Contact Lens json file",
    context: { payload: convTranscriptEntries },
  });
  return convTranscriptEntries;
}

async function processTranscript(awsAccountId, eventPayload, secretName, accessTokenSecretName) {
  const bucketName = config.s3BucketTenantResources;
  const transcriptResults = [];

  const contactIdRelatedRecordMap = eventPayload.reduce((map, obj) => {
    map[obj.contactId] = obj.relatedRecords;
    return map;
  }, new Map());

  const contactLensS3Path = await awsUtil.getContactLensS3Path(
    bucketName,
    eventPayload,
    config.connectInstanceId
  );

  SCVLoggingUtil.info({
    message: `Found ${contactLensS3Path.length} Contact lens files from S3 to process`,
    context: { payload: contactLensS3Path },
  });

  let contactIdPayloadBatch = new Map();
  for (let i = 0; i < contactLensS3Path.length; i++) {
    const key = contactLensS3Path[i];
    const params = {
      Bucket: bucketName,
      Key: key,
    };

    const convTranscriptEntries = await fetchTranscriptFromCLFile(
      params,
      contactIdRelatedRecordMap
    );

    if (convTranscriptEntries.length === 0) {
      SCVLoggingUtil.info({
        message: `No transcripts found in the Contact Lens post call analysis file.`,
        context: { payload: key },
      });
    } else {
      const convConnectUploadPayloadJsonHeader = JSON.stringify({
        type: "conversation",
        payload: {
          conversationId: convTranscriptEntries[0].payload.conversationId,
        },
      });
      const convConnectUploadPayloadJsonEntries = convTranscriptEntries
        .map((entry) => JSON.stringify(entry))
        .join("\n");
      const requestPayload =
        convConnectUploadPayloadJsonHeader +
        "\n" +
        convConnectUploadPayloadJsonEntries;

      contactIdPayloadBatch.set(
        convTranscriptEntries[0].payload.conversationId,
        requestPayload
      );
      if (contactIdPayloadBatch.size >= config.batchSize) {
        SCVLoggingUtil.info({
          message: `Invoking SfRestApi for batch ${
            i % config.batchSize
          } with size ${contactIdPayloadBatch.size}`,
        });
        const result = await sfRestApi.invokeSfRestApiUploadTranscript(
          contactIdPayloadBatch,
          secretName,
          accessTokenSecretName
        );
        transcriptResults.push(result);
        contactIdPayloadBatch = new Map();
      }
    }
  }
  if (contactIdPayloadBatch.size > 0) {
    SCVLoggingUtil.info({
      message: `Invoking SfRestApi for last batch with size ${contactIdPayloadBatch.size}`,
    });
    const result = await sfRestApi.invokeSfRestApiUploadTranscript(
      contactIdPayloadBatch,
      secretName,
      accessTokenSecretName
    );
    transcriptResults.push(result);
  }
  SCVLoggingUtil.info({
    message: "Result for transcript uploader",
    context: { payload: transcriptResults },
  });
  return transcriptResults;
}

module.exports = {
  processTranscript,
};