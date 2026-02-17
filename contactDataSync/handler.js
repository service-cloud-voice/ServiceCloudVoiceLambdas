const SCVLoggingUtil = require("./SCVLoggingUtil");
const config = require("./config");
const transcriptUploader = require("./transcriptUploader");
const fetchUploadIdsStatus = require("./fetchUploadIdsStatus");
const supportedOperations = ["uploadTranscript", "fetchUploadIdsStatus"];
const MAX_BATCH_SIZE = 10;

exports.handler = async function (event, context) {
  SCVLoggingUtil.info({
    message: "ContactDataSync event received",
    context: { payload: event },
  });
  /* Sample input request
  {
    "operation": "uploadTranscript",
    "secretName": "callCenterApiName-salesforce-secret", // org. secret name is at the top payload level, and customer needs to make sure all the contactIds in this payload are for one org. for this corresponding org.'s secret
    "accessTokenSecretName": "callCenterApiName-salesforce-access-token-secret",
    "payload": [
      {
        "contactId": "8c6258f0-66fa-4137-a61f-68311bb6d300",
        "relatedRecords": [
          "0LQSB000001m5RR"
        ]
      },
      {
        "contactId": "0e900fcd-6b3b-4445-8769-b32429eb3537",
        "relatedRecords": [
          "0LQSB000001m1RQ"
        ]
      }
    ]
  }

  {
  "operation": "fetchUploadIdsStatus",
  "secretName": "callCenterApiName-salesforce-secret",
  "accessTokenSecretName": "callCenterApiName-salesforce-access-token-secret",
  "uploadIds": [
    "f230e3d9-6c0f-3909-a0a8-1b78c634bbde",
    "68279b80-a394-3228-b99b-c60f02ff8227"
  ]
  }
  */
  const secretName = event.secretName || config.secretName;
  const accessTokenSecretName = event.accessTokenSecretName || config.accessTokenSecretName;

  switch (event.operation) {
    case "uploadTranscript": {
      const { uploadSuccess, uploadResult } =
        validateUploadTranscriptRequest(event);
      if (uploadSuccess) {
        const awsAccountId = context.invokedFunctionArn.split(":")[4];
        return await transcriptUploader.processTranscript(
          awsAccountId,
          event.payload,
          secretName,
          accessTokenSecretName
        );
      }
      return uploadResult;
    }
    case "fetchUploadIdsStatus": {
      const { fetchSuccess, fetchResult } =
        validateFetchUploadIdsStatusRequest(event);
      if (fetchSuccess) {
        return await fetchUploadIdsStatus.processFetchUploadIdsStatus(event, secretName, accessTokenSecretName);
      }
      return fetchResult;
    }
    default:
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: `Unsupported operation:${
            event.operation
          }.Supported operations:${supportedOperations.join()}`,
        }),
      };
  }
};

function validateFetchUploadIdsStatusRequest(event) {
  let fetchResult;
  let fetchSuccess = true;
  if (!("uploadIds" in event) || event.uploadIds.length === 0) {
    fetchSuccess = false;
    fetchResult = {
      statusCode: 400,
      body: JSON.stringify({
        error:
          "Malformed request missing uploadIds or empty uploadIds in the request.",
      }),
    };
  }
  return { fetchSuccess, fetchResult };
}

function validateUploadTranscriptRequest(event) {
  let uploadResult;
  let uploadSuccess = true;
  if (!("payload" in event) || event.payload.length === 0) {
    uploadSuccess = false;
    uploadResult = {
      statusCode: 400,
      body: JSON.stringify({
        error:
          "Malformed request missing payload or empty payload in the request.",
      }),
    };
  } else if (event.payload.length > config.maxContactIds) {
    uploadSuccess = false;
    uploadResult = {
      statusCode: 400,
      body: JSON.stringify({
        error: `Max supported contactIds in a request is ${config.maxContactIds}`,
      }),
    };
  }
  if (config.batchSize > MAX_BATCH_SIZE) {
    uploadSuccess = false;
    uploadResult = {
      statusCode: 400,
      body: JSON.stringify({
        error: `Configure batch size ${config.batchSize} cannot be more that ${MAX_BATCH_SIZE} `,
      }),
    };
  }
  return { uploadSuccess, uploadResult };
}