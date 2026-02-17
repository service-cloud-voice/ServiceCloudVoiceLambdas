/**
 * JS logging utils class used in SCV project
 *
 */

/** Logging Level:
 *  INFO,   // For generally useful information to log
 *  WARN,   // For anything that can potentially cause application oddities
 *  ERROR,  // For any error which is fatal to the operation
 *  DEBUG,  // Only when you would be "debugging" the code and trying to find one part of a function specifically
 */

const winston = require("winston");

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.prettyPrint(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

const noContext = "NO_CONTEXT";
const noMessage = "NO_MESSAGE";

/**
 * Create a log line with level of INFO
 * @param logLine Object containing message, context, evenType and context to log
 */
function info(logLine) {
  const logline = buildLog(logLine);
  logger.info(logline);
}

/**
 * Create a log line with level of DEBUG
 * @param logLine Object containing message, context, evenType and context to log
 */
function debug(logLine) {
  const logline = buildLog(logLine);
  logger.debug(logline);
}

/**
 * Create a log line with level of WARN
 * @param logLine Object containing message, context, evenType and context to log
 */
function warn(logLine) {
  const logline = buildLog(logLine);
  logger.warn(logline);
}

/**
 * Create a log line with level of ERROR
 * @param logLine Object containing message, context, evenType and context to log
 */
function error(logLine) {
  const logline = buildLog(logLine);
  logger.error(logline);
}

/**
 * Create a log line with level of ERROR
 * @param logLine Object containing message, context, evenType and context to log
 */
function buildLog(logLine) {
  const log = {
    context: logLine.context || noContext,
    message: logLine.message || noMessage,
    category: "VoiceMailPackaging",
  };
  return log;
}

module.exports = {
  error,
  warn,
  info,
  debug,
};