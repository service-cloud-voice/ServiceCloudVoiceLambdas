const SCVLoggingUtil = require("./SCVLoggingUtil");
const sfRestApi = require("./sfRestApi");

async function processFetchUploadIdsStatus(event, secretName, accessTokenSecretName) {
  const uploadIds = event.uploadIds.join();
  SCVLoggingUtil.debug({
    message: `Payload for connect api`,
    context: { uploadIds },
  });
  const result = await sfRestApi.invokeSfRestApiFetchUploadIdsStatus(uploadIds, secretName, accessTokenSecretName);
  SCVLoggingUtil.info({
    message: `FetchUploadIdsStatus result`,
    context: { payload: result },
  });
  return result;
}

module.exports = {
  processFetchUploadIdsStatus,
};