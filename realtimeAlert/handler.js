const aws = require("aws-sdk");
const SCVLoggingUtil = require("./SCVLoggingUtil");

const lambda = new aws.Lambda();

function getSeverity(snsMessage) {
  let severity;
  if (snsMessage.NewStateValue === "ALARM") severity = "Critical";
  else if (snsMessage.NewStateValue === "OK") severity = "Informational";
  else severity = "Warning";
  return severity;
}

function getSnsEventPayload(snsMessage) {
  const payload = {
    Details: {
      Parameters: {
        methodName: "realtimeAlertEvent",
        Name: snsMessage.AlarmName,
        Description: snsMessage.AlarmDescription,
        Source: `Cloudwatch Alarm from account ${snsMessage.AWSAccountId}`,
        Severity: getSeverity(snsMessage),
        Payload: `${
          snsMessage.NewStateReason
        } Trigger condition: ${JSON.stringify(snsMessage.Trigger)}`,
        EventDateTime: snsMessage.StateChangeTime
          ? new Date(snsMessage.StateChangeTime).toISOString()
          : new Date().toISOString(),
      },
    },
  };
  return payload;
}

function getCloudwatchEventPayload() {
  const payload = {
    Details: {
      Parameters: {
        methodName: "realtimeAlertEvent",
        Name: "alert name goes here",
        Description: "alert description here",
        Source: "alert source goes here",
        Severity: "Warning",
        Payload: "some info",
        EventDateTime: new Date().toISOString(),
      },
    },
  };
  return payload;
}
const sendEvent = async (event) => {
  let eventPayload;
  if (event.Records && event.Records[0].EventSource === "aws:sns") {
    const snsMessage = JSON.parse(event.Records[0].Sns.Message);
    eventPayload = getSnsEventPayload(snsMessage);
  } else if (event.source === "aws.events") {
    // for lambda invocation via cloudwatch events
    eventPayload = getCloudwatchEventPayload();
  }
  const params = {
    FunctionName: process.env.INVOKE_SALESFORCE_REST_API_ARN,
    Payload: JSON.stringify(eventPayload),
  };

  SCVLoggingUtil.info({
    message: "RealTimeAlert SendEvent with params",
    context: { payload: params },
  });
  return lambda.invoke(params).promise();
};

// --------------- Main handler -----------------------
exports.handler = async (event) => {
  SCVLoggingUtil.debug({
    message: "Realtime Alert event received",
    context: { payload: event },
  });
  const result = await sendEvent(event);
  SCVLoggingUtil.info({
    message: "RealTime Alert Event response received",
    context: { payload: result },
  });
};
