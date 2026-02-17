const SCVLoggingUtil = require("./SCVLoggingUtil");
const config = require("./config");
const awsUtils = require("./awsUtils");

async function invokeSfRestApiUploadTranscript(contactIdPayloadBatch, secretNameStr, accessTokenSecretNameStr) {
  const sfRestApiRequestPayload = {
    Details: {
      Parameters: {
        methodName: "uploadTranscript",
        secretName: secretNameStr,
        accessTokenSecretName: accessTokenSecretNameStr,
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

async function invokeSfRestApiFetchUploadIdsStatus(uploadIds, secretNameStr, accessTokenSecretNameStr) {
  const sfRestApiRequestPayload = {
    Details: {
      Parameters: {
        methodName: "fetchUploadIdsStatus",
        secretName: secretNameStr,
        accessTokenSecretName: accessTokenSecretNameStr,
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