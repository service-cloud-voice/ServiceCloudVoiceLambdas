const jwt = require("jsonwebtoken");
const SSM = require("aws-sdk/clients/ssm");
const uuid = require("uuid/v1");
const SCVLoggingUtil = require("./SCVLoggingUtil");
const config = require("./config");
const signalConfig = require("./signalConfig");
const lambdaExtension = require("./lambdaExtension");

function buildSendMessagePayload(transcript, approximateArrivalTimestamp) {
  const payload = {};
  const arrivalTimeMillis = approximateArrivalTimestamp * 1000;
  payload.messageId = transcript.Id;
  payload.startTime =
    arrivalTimeMillis -
    (transcript.EndOffsetMillis - transcript.BeginOffsetMillis);
  payload.endTime = arrivalTimeMillis;
  payload.content = transcript.PartialContent;

  if (transcript.ParticipantRole === "AGENT") {
    payload.participantId = "VIRTUAL_AGENT";
    payload.senderType = "VIRTUAL_AGENT";
  } else {
    payload.participantId = "END_USER";
    payload.senderType = "END_USER";
  }
  return payload;
}

function buildSendRealtimeConversationEventsPayload(categories) {
  const matchedCategories = categories.MatchedCategories;
  const events = [];
  for (let i = 0; i < matchedCategories.length; i += 1) {
    const event = {};
    event.type = signalConfig.category;
    event.value = matchedCategories[i];
    event.startTime = Date.now();

    const categoryDetails =
      categories.MatchedDetails[matchedCategories[i]].PointsOfInterest;
    if (categoryDetails && categoryDetails.length > 0) {
      event.details = categoryDetails[0];
    }
    events.push(event);
  }
  const payload = {};
  payload.service = signalConfig.service;
  payload.events = events;
  payload.persist = false;
  return payload;
}

async function getSSMParameterValue(paramName, withDecryption) {
  return new Promise((resolve) => {
    var useLambdaExtensions =
      String(config.useSSMLambdaExtension).toLowerCase() === "true";
    if (!useLambdaExtensions) {
      const ssm = new SSM();
      const query = {
        Names: [paramName],
        WithDecryption: withDecryption,
      };

      ssm.getParameters(query, (err, data) => {
        let paramValue = null;

        if (!err && data && data.Parameters && data.Parameters.length) {
          paramValue = data.Parameters[0].Value;
        }
        resolve(paramValue);
      });
    } else {
      resolve(lambdaExtension.readSSMParameter(paramName));
    }
  });
}

/**
 * Generate a JWT based on the specified parameters.
 *
 * @param {object} params
 * @param {string} params.privateKeyParamName - The name of the parameter for storing the certificate prviate key in AWS Paramter Store.
 * @param {string} params.orgId - The ID of the customer's Salesforce org.
 * @param {string} params.callCenterApiName - The API name of the Salesforce CallCenter which maps to the context Amazon Connect contact center instance.
 * @param {string} params.expiresIn - Specifies when the generated JWT will expire.
 *
 * @return {string} - JWT token string
 */
async function generateJWT(params) {
  const { privateKeyParamName, orgId, callCenterApiName, expiresIn } = params;
  const privateKey = await getSSMParameterValue(privateKeyParamName, true);

  const signOptions = {
    issuer: orgId,
    subject: callCenterApiName,
    expiresIn,
    algorithm: "RS256",
    jwtid: uuid(),
  };

  return jwt.sign({}, privateKey, signOptions);
}

function logEventReceived(eventType, contactId) {
  if (
    eventType === "STARTED" ||
    eventType === "SEGMENTS" ||
    eventType === "COMPLETED"
  ) {
    SCVLoggingUtil.debug({
      message: `ContactLensConsumer received ${eventType} event`,
      context: { contactId: contactId, payload: eventType },
    });
  } else if (eventType === "FAILED") {
    SCVLoggingUtil.error({
      message: `ContactLensConsumer received ${eventType} event`,
      context: { contactId: contactId, payload: eventType },
    });
  } else {
    SCVLoggingUtil.warn({
      message: `ContactLensConsumer received unknown event`,
      context: { contactId: contactId, payload: eventType },
    });
  }
}

function parseData(data) {
  const payload = Buffer.from(data, "base64").toString("utf8");
  return JSON.parse(payload);
}

module.exports = {
  buildSendMessagePayload,
  buildSendRealtimeConversationEventsPayload,
  generateJWT,
  getSSMParameterValue,
  logEventReceived,
  parseData,
};
