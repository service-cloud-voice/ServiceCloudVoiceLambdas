const aws = require("aws-sdk");
const SCVLoggingUtil = require("./SCVLoggingUtil");
const api = require("./telephonyIntegrationApi");
const utils = require("./utils");
const signalConfig = require("./signalConfig");

const s3 = new aws.S3();

let clObject = {};
let contactId;
let instanceId;
let batchCount = 0;
let overallBatchCount = 0;

exports.handler = async (event) => {
  SCVLoggingUtil.debug({
    category: "handler.handler",
    message: "Received event",
    context: event,
  });
  // Get the post-call json file from the event
  try {
    const bucket = event.detail.bucket.name;
    const key = decodeURIComponent(event.detail.object.key.replace(/\+/g, " "));
    SCVLoggingUtil.debug({
      message: "Successfully fetched the S3 bucket name and key.",
      eventType: "SIGNALS",
      category: [],
      context: `Bucket Name: ${bucket}, Object Key: ${key}`,
    });

    if (!utils.validateS3KeyName(key)) {
      return null;
    }

    const params = {
      Bucket: bucket,
      Key: key,
    };

    const data = await s3.getObject(params).promise();
    clObject = JSON.parse(data.Body.toString("ascii"));
    SCVLoggingUtil.debug({
      message: "Successfully loaded the Contact Lens post-call .json file.",
      eventType: "SIGNALS",
      category: "Contact Lens analysis file content",
      context: clObject,
    });

    contactId = clObject.CustomerMetadata.ContactId;
    instanceId = clObject.CustomerMetadata.InstanceId;
  } catch (err) {
    const message = `Error getting basic customer metadata!`;
    SCVLoggingUtil.error({
      message:
        "Error loading Contact Lens post-call S3 bucket and file content!",
      eventType: "SIGNALS",
      category: message,
      context: err,
    });
    throw new Error(message);
  }

  // Call describeContact API to fetch contact initial start time
  const describeContactParams = {
    ContactId: contactId,
    InstanceId: instanceId,
  };
  const describeContactResponse = await utils.getAgentTimestamp(
    describeContactParams
  );
  const connectedToAgentTimestamp =
    describeContactResponse.Contact.AgentInfo.ConnectedToAgentTimestamp;
  const disconnectedTimestamp =
    describeContactResponse.Contact.DisconnectTimestamp;

  const requestSignals = [];
  const OverallAgentSentimentScore =
    clObject.ConversationCharacteristics.Sentiment.OverallSentiment.AGENT;
  const OverallCustomerSentimentScore =
    clObject.ConversationCharacteristics.Sentiment.OverallSentiment.CUSTOMER;

  if (Number.isFinite(OverallAgentSentimentScore)) {
    requestSignals.push({
      type: "IntelligenceSignal__OverallSentimentScore",
      value: OverallAgentSentimentScore.toString(),
      startTime: new Date(connectedToAgentTimestamp).getTime(),
      endTime: new Date(disconnectedTimestamp).getTime(),
      participant: "AGENT",
    });
  }

  if (Number.isFinite(OverallCustomerSentimentScore)) {
    requestSignals.push({
      type: "IntelligenceSignal__OverallSentimentScore",
      value: OverallCustomerSentimentScore.toString(),
      startTime: new Date(connectedToAgentTimestamp).getTime(),
      endTime: new Date(disconnectedTimestamp).getTime(),
      participant: "CUSTOMER",
    });
  }

  if (clObject.Transcript) {
    clObject.Transcript.forEach((transcriptPayload) => {
      const startTime =
        new Date(connectedToAgentTimestamp).getTime() +
        transcriptPayload.BeginOffsetMillis;
      const endTime =
        new Date(connectedToAgentTimestamp).getTime() +
        transcriptPayload.EndOffsetMillis;
      requestSignals.push({
        type: signalConfig.type,
        value: utils
          .sentimentNormalizer(transcriptPayload.Sentiment)
          .toString(),
        startTime,
        endTime,
        participant: transcriptPayload.ParticipantId
      });
    });
  }

  // sanity check
  if (requestSignals.length === 0) {
    SCVLoggingUtil.info({
      category: "handler.handler",
      message: `No signals are identified in the Contact Lens post call analysis file, stop and return here.`,
    });
    return null;
  }

  // slice requestPayload into multiple chunks
  const signalRequestBatches = utils.sliceIntoChunks(requestSignals, 25);
  overallBatchCount = signalRequestBatches.length;
  SCVLoggingUtil.info({
    category: "handler.handler",
    message: `Preparing to send ${overallBatchCount} batches to Salesforce Service Cloud Voice.`,
    eventType: [],
    context: [],
  });

  // start with the 1st batch
  for (const signalRequestBatch of signalRequestBatches) {
    batchCount += 1;
    const requestPayload = {};
    requestPayload.service = signalConfig.service;
    requestPayload.events = signalRequestBatch;

    SCVLoggingUtil.info({
      category: "handler.handler",
      message: `Invoked the persistSignals API with contactId ${contactId}. Processing batch ${batchCount} of ${overallBatchCount}.`,
      eventType: [],
      context: [],
    });
    await api.persistSignals(contactId, requestPayload);
  }

  return { result: "Success" };
};

// Util functions mainly used for testing purpose
exports.getCurrentBatchCount = () => batchCount;

exports.getOverallBatchCount = () => overallBatchCount;
