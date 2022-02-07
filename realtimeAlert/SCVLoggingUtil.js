/**
 * JS logging utils class used in SCV project
 *
 */

/** Logging Level:
 *  INFO,   // For generally useful information to log
 *  WARN,   // For anything that can potentially cause application oddities
 *  ERROR,  // For any error which is fatal to the operation
 *  TRACE,  // Only when you would be "tracing" the code and trying to find one part of a function specifically
 */

/**
 * Public enum for event type.
 */
const EVENT_TYPE = {
  PERFORMANCE: "PERFORMANCE",
  TRANSCRIPTION: "TRANSCRIPTION",
  VOICECALL: "VOICECALL",
  INBOUND: "INBOUND",
  OUTBOUND: "OUTBOUND",
  TRANSFER: "TRANSFER",
  PROVISIONING: "PROVISIONING",
  MONITORING: "MONITORING"
};

/**
 * Public enum for recommended context key of performance.
 */
const PERFORMANCE_CONTEXT_KEY = {
  ORG_ID: "ORG_ID", // required
  TOTAL_RESPONSE_TIME: "TOTAL_RESPONSE_TIME",
  SELF_TIME: "SELF_TIME",
  EXTERNAL_TIME: " EXTERNAL_TIME",
  AWS_TRANSCRIPTION_TIME: "AWS_TRANSCRIPTION_TIME",
  REQUEST_TYPE: "REQUEST_TYPE",
  OPERATION_TYPE: "OPERATION_TYPE",
  RESPONSE_CODE: "RESPONSE_CODE",
  END_POINT: "END_POINT",
  CALL_OUT_SERVICE: "CALL_OUT_SERVICE"
};

/**
 * Public enum for recommended context key of transcription.
 */
const TRANSCRIPTION_CONTEXT_KEY = {
  ORG_ID: "ORG_ID", // required
  MESSAGE_ID: "MESSAGE_ID", // required
  START_TIME: "START_TIME",
  END_TIME: "END_TIME",
  END_POINT: "END_POINT",
  RESPONSE_CODE: "RESPONSE_CODE"
};

/**
 * Public enum for recommended context key of voicecall.
 */
const VOICECALL_CONTEXT_KEY = {
  ORG_ID: "ORG_ID", // required
  VOICE_CALL_ID: "VOICE_CALL_ID" // required
};

/**
 * Public enum for recommended context key of inbound.
 */
const INBOUND_CONTEXT_KEY = {
  ORG_ID: "ORG_ID", // required
  VOICE_CALL_ID: "VOICE_CALL_ID", // required
  RESPONSE_CODE: "RESPONSE_CODE",
  IVR_RELATED_CONTEXT: "IVR_RELATED_CONTEXT"
};

/**
 * Public enum for recommended context key of outbound.
 */
const OUTBOUND_CONTEXT_KEY = {
  ORG_ID: "ORG_ID", // required
  RESPONSE_CODE: "RESPONSE_CODE"
};

/**
 * Public enum for recommended context key of transfer.
 */
const TRANSFER_CONTEXT_KEY = {
  ORG_ID: "ORG_ID", // required
  VOICE_CALL_ID: "VOICE_CALL_ID",
  TRANSFER_TYPE: "TRANSFER_TYPE", // required
  RESPONSE_CODE: "RESPONSE_CODE"
};

/**
 * Public enum for recommended context key of provisioning.
 */
const PROVISIONING_CONTEXT_KEY = {
  ORG_ID: "ORG_ID", // required
  STEP_NAME: "STEP_NAME", // required
  IS_SUCCESS: "IS_SUCCESS",
  ERRORS: "ERRORS",
  NUM_RETRY: "NUM_RETRY",
  JOB_NAME: "JOB_NAME", // required
  EXTERNAL_CALLOUT_DURATION: "EXTERNAL_CALLOUT_DURATION"
};

/**
 * Helper function for padding leading zero for value < 10.
 */
function padLeft(numStr, base, chr) {
  const len = String(base || 10).length - String(numStr).length + 1;
  return len > 0 ? new Array(len).join(chr || "0") + numStr : numStr;
}

/**
 * Helper function for getting current time stamp.
 */
function getTimeStamp() {
  const d = new Date();
  return `${[d.getFullYear(), padLeft(d.getMonth()), padLeft(d.getDate())].join(
    "-"
  )} ${[
    padLeft(d.getHours()),
    padLeft(d.getMinutes()),
    padLeft(d.getSeconds())
  ].join(":")}`;
}

/**
 * Helper function for creating logging message.
 *
 * @param* *logLevel info / error / warn / trace
 * @param logCategory fully qualified function/name
 * @param eventType performance / transcription / voicecall / provisioning / inbounc / outbound / transfer
 * @param message meaningful log messages
 * @param context map of key/value pairs of all related information
 */
function createLoggingMessage(
  logLevel,
  logCategory,
  eventType,
  message,
  context
) {
  // help find and filter a cyclic reference
  const getCircularReplacer = () => {
    const seen = new WeakSet();
    return (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return undefined;
        }
      }
      return value;
    };
  };
  return (
    `${getTimeStamp()} ${logLevel.toUpperCase()} ` +
    `category: ${logCategory}, ` +
    `event_type: ${eventType}, ${message}, ${JSON.stringify(
      context,
      getCircularReplacer()
    )}`
  );
}

/**
 * Create a log line with level of INFO.
 *
 * @param logCategory fully qualified function/name
 * @param eventType performance / transcription / voicecall / provisioning / inbounc / outbound / transfer
 * @param message meaningful log messages
 * @param context map of key/value pairs of all related information (please refer to recommended context key for each EventType)
 */
function info(logCategory, eventType, message, context) {
  console.log(
    createLoggingMessage("info", logCategory, eventType, message, context)
  );
}

/**
 * Create a log line with level of ERROR.
 *
 * @param logCategory fully qualified function/name
 * @param eventType performance / transcription / voicecall / provisioning / inbounc / outbound / transfer
 * @param message meaningful log messages
 * @param context map of key/value pairs of all related information (please refer to recommended context key for each EventType)
 */
function error(logCategory, eventType, message, context) {
  console.log(
    createLoggingMessage("error", logCategory, eventType, message, context)
  );
}

/**
 * Create a log line with level of WARN.
 *
 * @param logCategory fully qualified function/name
 * @param eventType performance / transcription / voicecall / provisioning / inbounc / outbound / transfer
 * @param message meaningful log messages
 * @param context map of key/value pairs of all related information (please refer to recommended context key for each EventType)
 */
function warn(logCategory, eventType, message, context) {
  console.log(
    createLoggingMessage("warn", logCategory, eventType, message, context)
  );
}

/**
 * Create a log line with level of TRACE.
 *
 * @param logCategory fully qualified function/name
 * @param eventType performance / transcription / voicecall / provisioning / inbounc / outbound / transfer
 * @param message meaningful log messages
 * @param context map of key/value pairs of all related information (please refer to recommended context key for each EventType)
 */
function trace(logCategory, eventType, message, context) {
  console.log(
    createLoggingMessage("trace", logCategory, eventType, message, context)
  );
}

module.exports = {
  EVENT_TYPE,
  PERFORMANCE_CONTEXT_KEY,
  TRANSCRIPTION_CONTEXT_KEY,
  VOICECALL_CONTEXT_KEY,
  INBOUND_CONTEXT_KEY,
  OUTBOUND_CONTEXT_KEY,
  TRANSFER_CONTEXT_KEY,
  PROVISIONING_CONTEXT_KEY,
  info,
  error,
  warn,
  trace
};
