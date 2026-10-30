const utils = require("./utils");
const axiosWrapper = require("./axiosWrapper");
const SCVLoggingUtil = require("./SCVLoggingUtil");
const { Readable } = require("stream");
const FormData = require("form-data");
const secretUtils = require("./secretUtils");

function buildError(e) {
  const status = e.response ? e.response.status : 500;
  const statusText = e.response ? e.response.statusText : e.code;
  let errorCode;
  let errorMessage;
  if (e.response) {
    errorCode =
      e.response.data && e.response.data.length > 0
        ? e.response.data[0].errorCode
        : e.response.data.error;
    errorMessage =
      e.response.data && e.response.data.length > 0
        ? e.response.data[0].message
        : e.response.data.error_description;
  } else {
    errorCode = e.code;
    errorMessage = e.reason;
  }
  return {
    success: false,
    status,
    statusText,
    errorCode,
    errorMessage,
  };
}

async function sendRequest(secretName, accessTokenSecretName, method, url, data, headersVal) {
  let accessToken;
  const headers = headersVal || {};
  const configs = await secretUtils.getSecretConfigs(secretName);
  const baseURL = configs.baseURL;

  try {
    accessToken = await utils.getAccessToken(configs, accessTokenSecretName);
    headers.Authorization = `Bearer ${accessToken}`;

    return await axiosWrapper.apiEndpoint({ method, baseURL, url, data, headers });
  } catch (e) {
    if (e.response && e.response.status === 401) {
      // Obtain a new access token since the cached one already expired.
      accessToken = await utils.getAccessToken(configs, accessTokenSecretName, true);
      headers.Authorization = `Bearer ${accessToken}`;

      return await axiosWrapper.apiEndpoint({ method, baseURL, url, data, headers });
    }

    throw e;
  }
}

async function createRecord(objectApiName, fieldValues, secretName, accessTokenSecretName) {
  try {
    const response = await sendRequest(
      secretName,
      accessTokenSecretName,
      "post",
      `/sobjects/${objectApiName}`,
      fieldValues,
      { "Content-Type": "application/json" }
    );
    SCVLoggingUtil.debug({
      category: "sfRestApi.createRecord",
      message: "create Record response",
      context: response,
    });
    return {
      success: response.data.success,
      recordId: response.data.id,
    };
  } catch (e) {
    return buildError(e);
  }
}

async function updateRecord(objectApiName, recordId, fieldValues, secretName, accessTokenSecretName) {
  try {
    const response = await sendRequest(
      secretName,
      accessTokenSecretName,
      "patch",
      `/sobjects/${objectApiName}/${recordId}`,
      fieldValues,
      { "Content-Type": "application/json" }
    );
    SCVLoggingUtil.debug({
      category: "sfRestApi.updateRecord",
      message: "update Record response",
      context: response,
    });
    // Salesforce returns 204 No Content on a successful PATCH.
    // axios throws on non-2xx, so reaching here always means success.
    return { success: true };
  } catch (e) {
    return buildError(e);
  }
}

async function sendRealtimeAlertEvent(fieldValues, secretName, accessTokenSecretName) {
  try {
    const response = await sendRequest(
      secretName,
      accessTokenSecretName,
      "post",
      "/sobjects/RealtimeAlertEvent",
      fieldValues,
      { "Content-Type": "application/json" }
    );

    return {
      success: response.data.success,
      id: response.data.id,
      // successful response will also have error object with  "statusCode" : "OPERATION_ENQUEUED" and message with GUID
      // https://developer.salesforce.com/docs/atlas.en-us.platform_events.meta/platform_events/platform_events_publish_api.htm
      errors: response.data.errors,
    };
  } catch (e) {
    return buildError(e);
  }
}

async function uploadTranscript(contactIdsPayloadMap, secretName, accessTokenSecretName) {
  try {
    const formData = new FormData();
    const headers = Object.assign(
      {
        Accept: "application/json",
      },
      formData.getHeaders()
    );
    //filename required for multipart upload
    //https://developer.salesforce.com/docs/atlas.en-us.248.0.voice_developer_guide.meta/voice_developer_guide/voice_connect_overview.htm
    var readable = [];
    const cIdMap = new Map(JSON.parse(contactIdsPayloadMap));
    let i = 0;
    SCVLoggingUtil.debug({
      category: "sfRestApi.uploadTranscript",
      message: `Send uploadTranscript for contactIdsPayloadMap  size ${cIdMap.size}`,
    });
    for (const entry of cIdMap.entries()) {
      readable[i] = Readable.from(entry[1]);
      formData.append(entry[0], readable[i], { filename: "transcripts.txt" });
      i++;
    }
    const response = await sendRequest(
      secretName,
      accessTokenSecretName,
      "post",
      "connect/conversations/upload",
      formData,
      headers
    );
    SCVLoggingUtil.debug({
      category: "sfRestApi.uploadTranscript",
      message: "Response from  connect/conversations/upload ",
      context: JSON.stringify(response.data),
    });
    return response.data;
  } catch (e) {
    return buildError(e);
  }
}

async function fetchUploadIdsStatus(uploadIds, secretName, accessTokenSecretName) {
  SCVLoggingUtil.debug({
    category: "sfRestApi.fetchUploadIdsStatus",
    message: "Send fetchUploadIdsStatus",
    context: uploadIds,
  });
  try {
    const response = await sendRequest(
      secretName,
      accessTokenSecretName,
      "get",
      `connect/conversations/upload?uploadIds=${encodeURIComponent(uploadIds)}`
    );
    SCVLoggingUtil.debug({
      category: "sfRestApi.uploadTranscript",
      message: "Response from connect/conversations/upload",
      context: JSON.stringify(response.data),
    });
    return response.data;
  } catch (e) {
    return buildError(e);
  }
}

async function queryRecord(soql, secretName, accessTokenSecretName) {
  try {
    const response = await sendRequest(
      secretName,
      accessTokenSecretName,
      "get",
      `/query/?q=${encodeURIComponent(soql)}`
    );
    SCVLoggingUtil.debug({
      category: "sfRestApi.queryRecord",
      message: "query Record response",
      context: response,
    });
    if (response.data.totalSize === 0) {
      return {};
    }
    const result = response.data.records[0];
    delete result.attributes;
    return result;
  } catch (e) {
    return buildError(e);
  }
}

async function searchRecord(sosl, secretName, accessTokenSecretName) {
  try {
    const response = await sendRequest(
      secretName,
      accessTokenSecretName,
      "get",
      `/search/?q=${encodeURIComponent(sosl)}`
    );
    SCVLoggingUtil.debug({
      category: "sfRestApi.searchRecord",
      message: "search Record response",
      context: response,
    });
    if (response.data.searchRecords.length === 0) {
      return {};
    }
    return response.data.searchRecords[0];
  } catch (e) {
    return buildError(e);
  }
}

module.exports = {
  createRecord,
  updateRecord,
  queryRecord,
  searchRecord,
  sendRealtimeAlertEvent,
  uploadTranscript,
  fetchUploadIdsStatus,
};
