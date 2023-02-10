const jwt = require("jsonwebtoken");
const SSM = require("aws-sdk/clients/ssm");
const uuid = require("uuid/v1");
const SCVLoggingUtil = require("./SCVLoggingUtil");
const signalConfig = require("./signalConfig");

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

  SCVLoggingUtil.debug({
    message: "Send Message payload",
    eventType: "TRANSCRIPTION",
    context: payload,
    category: "contactLensConsumer.utils.buildSendMessagePayload",
  });
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

  SCVLoggingUtil.debug({
    message: "Send Realtime Conversation Events payload",
    eventType: "INTELLIGENCESIGNALS",
    context: payload,
    category: "contactLensConsumer.utils.buildSendRealtimeConversationEventsPayload",
  });
  return payload;
}

async function getSSMParameterValue(paramName, withDecryption) {
  return new Promise((resolve) => {
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
  });
}

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

  SCVLoggingUtil.debug({
    message: `JWT SignOptions ${signOptions}`,
    context: {},
    category: "contactLensConsumer.utils.generateJWT",
  });
  return jwt.sign({}, privateKey, signOptions);
}

function logEventReceived(eventType) {
  if (
    eventType === "STARTED" ||
    eventType === "SEGMENTS" ||
    eventType === "COMPLETED"
  ) {
    SCVLoggingUtil.info({
      message: `ContactLensConsumer received ${eventType} event`,
      eventType: "TRANSCRIPTION",
      context: {},
      category: "contactLensConsumer.utils.logEventReceived",
    });
  } else if (eventType === "FAILED") {
    SCVLoggingUtil.error({
      message: `ContactLensConsumer received ${eventType} event`,
      eventType: "TRANSCRIPTION",
      context: {},
      category: "contactLensConsumer.utils.logEventReceived",
    });
  } else {
    SCVLoggingUtil.warn({
      message: `ContactLensConsumer received unknown event`,
      eventType: "TRANSCRIPTION",
      context: eventType,
      category: "contactLensConsumer.utils.logEventReceived",
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
