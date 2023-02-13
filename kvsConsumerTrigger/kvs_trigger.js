/** ********************************************************************************************************************
 *  Lambda function to trigger real time transcription service in Java                                                *
 ********************************************************************************************************************* */

const AWS = require("aws-sdk");
const SCVLoggingUtil = require("./SCVLoggingUtil");

AWS.config.correctClockSkew = true;
const lambda = new AWS.Lambda();

function buildResponse() {
  return {
    // Async Java lambda is trigger, return "Success" for now
    lambdaResult: "Success",
  };
}

exports.handler = (event, context, callback) => {
  SCVLoggingUtil.debug({
    category: "kvs_trigger.handler",
    message: "Received event",
    context: event,
  });

  let payload = {};
  let languageCodeSelected = "en-US";

  if (
    typeof event.Details.ContactData.Attributes.languageCode !== "undefined" &&
    event.Details.ContactData.Attributes.languageCode !== null
  ) {
    languageCodeSelected = event.Details.ContactData.Attributes.languageCode;
  }

  payload = {
    streamARN: event.Details.ContactData.MediaStreams.Customer.Audio.StreamARN,
    startFragmentNum:
      event.Details.ContactData.MediaStreams.Customer.Audio.StartFragmentNumber,
    audioStartTimestamp:
      event.Details.ContactData.MediaStreams.Customer.Audio.StartTimestamp,
    customerPhoneNumber: event.Details.ContactData.CustomerEndpoint.Address,
    voiceCallId: event.Details.ContactData.ContactId,
    languageCode: languageCodeSelected,
    // These default to true for backwards compatability purposes
    streamAudioFromCustomer:
      event.Details.ContactData.Attributes.streamAudioFromCustomer !== "false",
    streamAudioToCustomer:
      event.Details.ContactData.Attributes.streamAudioToCustomer !== "false",
    instanceARN: event.Details.ContactData.InstanceARN,
    engine: event.Details.Parameters.engine || "standard", // valid inputs are "standard" (default) and "medical"
  };

  const vocabularyName = event.Details.Parameters.vocabularyName || null;
  const vocabularyFilterName =
    event.Details.Parameters.vocabularyFilterName || null;
  const vocabularyFilterMethod =
    event.Details.Parameters.vocabularyFilterMethod || null;
  const specialty = event.Details.Parameters.specialty || null;

  if (vocabularyName !== null) {
    payload.vocabularyName = vocabularyName;
  }

  if (vocabularyFilterName !== null) {
    payload.vocabularyFilterName = vocabularyFilterName;
  }

  if (vocabularyFilterMethod !== null) {
    payload.vocabularyFilterMethod = vocabularyFilterMethod;
  }

  if (specialty !== null) {
    payload.specialty = specialty; // for use with medical transcription
  }

  const params = {
    // not passing in a ClientContext
    FunctionName: process.env.INVOKE_KVS_TRANSCRIBER_ARN,
    // InvocationType is RequestResponse by default
    // LogType is not set so we won't get the last 4K of logs from the invoked function
    // Qualifier is not set so we use $LATEST
    InvokeArgs: JSON.stringify(payload),
  };
  SCVLoggingUtil.debug({
    category: "kvs_trigger.handler",
    message: "Invoke lambda with params",
    context: params,
  });
  lambda.invokeAsync(params, (err) => {
    if (err) {
      throw err;
    } else if (callback) callback(null, buildResponse());
    else
      SCVLoggingUtil.info({
        category: "kvs_trigger.handler",
        eventType: "TRANSCRIPTION",
        message: "nothing to callback so letting it go",
      });
  });

  callback(null, buildResponse());
};
