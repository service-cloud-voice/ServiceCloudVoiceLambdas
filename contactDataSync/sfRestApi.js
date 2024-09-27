const SCVLoggingUtil = require("./SCVLoggingUtil");
const config = require("./config");
const awsUtils = require("./awsUtils");

async function invokeSfRestApiUploadTranscript(contactIdPayloadBatch) {
  const sfRestApiRequestPayload = {
    Details: {
      Parameters: {
        methodName: "uploadTranscript",
        contactIdsPayloadMap: JSON.stringify(
          Array.from(contactIdPayloadBatch.entries())
        ),
      },
    },
  };
  const params = {
    FunctionName: config.invokeSfRestApiArn,
    Payload: JSON.stringify(sfRestApiRequestPayload),
  };

  SCVLoggingUtil.debug({
    message: "Invoking sfRestApi with params",
    context: { payload: params },
  });
  return await awsUtils.invokeLambdaFunction(params);
}

async function invokeSfRestApiFetchUploadIdsStatus(uploadIds) {
  const sfRestApiRequestPayload = {
    Details: {
      Parameters: {
        methodName: "fetchUploadIdsStatus",
        uploadIds,
      },
    },
  };
  const params = {
    FunctionName: config.invokeSfRestApiArn,
    Payload: JSON.stringify(sfRestApiRequestPayload),
  };

  SCVLoggingUtil.debug({
    message: "Invoking sfRestApi with params",
    context: { payload: params },
  });
  return await awsUtils.invokeLambdaFunction(params);
}

module.exports = {
  invokeSfRestApiUploadTranscript,
  invokeSfRestApiFetchUploadIdsStatus,
};
