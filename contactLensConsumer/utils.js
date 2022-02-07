const jwt = require("jsonwebtoken");
const SSM = require("aws-sdk/clients/ssm");
const uuid = require("uuid/v1");
const SCVLoggingUtil = require("./SCVLoggingUtil");

function buildSendMessagePayload(transcript, approximateArrivalTimestamp) {
  const payload = {};
  const arrivalTimeMillis = approximateArrivalTimestamp * 1000;
  payload.messageId = transcript.Id;
  payload.startTime =
    arrivalTimeMillis -
    (transcript.EndOffsetMillis - transcript.BeginOffsetMillis);
  payload.endTime = arrivalTimeMillis;
  payload.content = transcript.Content;

  if (transcript.ParticipantRole === "AGENT") {
    payload.participantId = "VIRTUAL_AGENT";
    payload.senderType = "VIRTUAL_AGENT";
  } else {
    payload.participantId = "END_USER";
    payload.senderType = "END_USER";
  }

  return payload;
}

async function getSSMParameterValue(paramName, withDecryption) {
  return new Promise(resolve => {
    const ssm = new SSM();
    const query = {
      Names: [paramName],
      WithDecryption: withDecryption
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
    jwtid: uuid()
  };

  return jwt.sign({}, privateKey, signOptions);
}

function logEventReceived(eventType) {
  if (
    eventType === "STARTED" ||
    eventType === "SEGMENTS" ||
    eventType === "COMPLETED"
  ) {
    SCVLoggingUtil.info(
      "contactLensConsumer.handler",
      SCVLoggingUtil.EVENT_TYPE.TRANSCRIPTION,
      `ContactLensConsumer received ${eventType} event`,
      {}
    );
  } else if (eventType === "FAILED") {
    SCVLoggingUtil.error(
      "contactLensConsumer.handler",
      SCVLoggingUtil.EVENT_TYPE.TRANSCRIPTION,
      `ContactLensConsumer received ${eventType} event`,
      {}
    );
  } else {
    SCVLoggingUtil.warn(
      "contactLensConsumer.handler",
      SCVLoggingUtil.EVENT_TYPE.TRANSCRIPTION,
      "ContactLensConsumer received unknown event",
      { eventType }
    );
  }
}

module.exports = {
  buildSendMessagePayload,
  generateJWT,
  getSSMParameterValue,
  logEventReceived
};
