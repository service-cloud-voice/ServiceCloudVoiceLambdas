const SCVLoggingUtil = require("./SCVLoggingUtil");
const sfRestApi = require("./sfRestApi");

async function processFetchUploadIdsStatus(event) {
  const uploadIds = event.uploadIds.join();
  SCVLoggingUtil.debug({
    message: `Payload for connect api`,
    context: { uploadIds },
  });
  const result = await sfRestApi.invokeSfRestApiFetchUploadIdsStatus(uploadIds);
  SCVLoggingUtil.info({
    message: `FetchUploadIdsStatus result`,
    context: { payload: result },
  });
  return result;
}

module.exports = {
  processFetchUploadIdsStatus,
};
