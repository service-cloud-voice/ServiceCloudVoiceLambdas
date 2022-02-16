const utils = require("./utils");
const axiosWrapper = require("./axiosWrapper");

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
    errorMessage
  };
}

async function sendRequest(method, url, data, headersVal) {
  let accessToken;
  const headers = headersVal || {};

  try {
    accessToken = await utils.getAccessToken();
    headers.Authorization = `Bearer ${accessToken}`;

    return await axiosWrapper.apiEndpoint({ method, url, data, headers });
  } catch (e) {
    if (e.response && e.response.status === 401) {
      // Obtain a new access token since the cached one already expired.
      accessToken = await utils.getAccessToken(true);
      headers.Authorization = `Bearer ${accessToken}`;

      return axiosWrapper.apiEndpoint({ method, url, data, headers });
    }

    throw e;
  }
}

async function createRecord(objectApiName, fieldValues) {
  try {
    const response = await sendRequest(
      "post",
      `/sobjects/${objectApiName}`,
      fieldValues,
      { "Content-Type": "application/json" }
    );

    return {
      success: response.data.success,
      recordId: response.data.id
    };
  } catch (e) {
    return buildError(e);
  }
}

async function updateRecord(objectApiName, recordId, fieldValues) {
  try {
    const response = await sendRequest(
      "patch",
      `/sobjects/${objectApiName}/${recordId}`,
      fieldValues,
      { "Content-Type": "application/json" }
    );

    if (response.data === "") {
      return {
        success: true
      };
    }
    return {
      success: false
    };
  } catch (e) {
    return buildError(e);
  }
}

async function sendRealtimeAlertEvent(fieldValues) {
  try {
    const response = await sendRequest(
      "post",
      "/sobjects/RealtimeAlertEvent",
      fieldValues,
      { "Content-Type": "application/json"}
    );

    return {
      success: response.data.success,
      id: response.data.id,
      // successful response will also have error object with  "statusCode" : "OPERATION_ENQUEUED" and message with GUID
      // https://developer.salesforce.com/docs/atlas.en-us.platform_events.meta/platform_events/platform_events_publish_api.htm
      errors: response.data.errors
    };
  } catch (e) {
    return buildError(e);
  }
}

async function queryRecord(soql) {
  try {
    const response = await sendRequest(
      "get",
      `/query/?q=${encodeURIComponent(soql)}`
    );

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

async function searchRecord(sosl) {
  try {
    const response = await sendRequest(
      "get",
      `/search/?q=${encodeURIComponent(sosl)}`
    );

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
  sendRealtimeAlertEvent
};
