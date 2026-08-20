const jwt = require("jsonwebtoken");
const uuid = require("uuid/v1");

/**
 * Generate a JWT based on the specified parameters.
 *
 * @param {object} params
 * @param {string} params.orgId - The ID of the customer's Salesforce org.
 * @param {string} params.callCenterApiName - The API name of the Salesforce CallCenter which maps to the context Amazon Connect contact center instance.
 * @param {string} params.expiresIn - Specifies when the generated JWT will expire.
 * @param {string} params.privateKey - The private key to sign the JWT.
 *
 * @return {string} - JWT token string
 */
async function generateJWT(params) {
  const { orgId, callCenterApiName, expiresIn, privateKey } = params;

  const signOptions = {
    issuer: orgId,
    subject: callCenterApiName,
    expiresIn,
    algorithm: "RS256",
    jwtid: uuid(),
  };

  return jwt.sign({}, privateKey, signOptions);
}

/**
 * Filter call attributes to be included in API payload based on prefix and strip prefix
 *
 * @param {object} rawCallAttributes - Contact flow attributes
 *
 * @return {string} - Stringified contact flow attributes with prefix removed
 */
function getCallAttributes(rawCallAttributes) {
  const prefix = "sfdc-";
  const prefixLen = prefix.length;
  const callAttributes = {};

  Object.keys(rawCallAttributes).forEach((key) => {
    if (key.startsWith(prefix)) {
      callAttributes[key.substring(prefixLen)] = rawCallAttributes[key];
    }
  });

  return JSON.stringify(callAttributes);
}

/**
 * Filter flow input parameters to be included in API payload based on prefix and strip prefix.
 *
 * @param {object} rawFlowInputParams - Flow Input Parameters
 *
 * @return {string} - Flow Input Parameters with prefix removed
 */
function constructFlowInputParams(rawFlowInputParams) {
  const prefix = "flowInput-";
  const prefixLen = prefix.length;
  const flowInputParams = {};

  Object.keys(rawFlowInputParams).forEach((key) => {
    if (key.startsWith(prefix)) {
      flowInputParams[key.substring(prefixLen)] = rawFlowInputParams[key];
    }
  });

  return flowInputParams;
}

/**
 * Generate a unique transaction identifier.
 *
 * @return {string} - A UUID string.
 */
function generateTransactionId() {
  return uuid();
}

/**
 * Validate that a phone number is in E.164 format.
 *
 * @param {string} phoneNumber - The phone number to validate.
 *
 * @return {boolean} - True if the phone number is a valid E.164 string.
 */
function isValidE164(phoneNumber) {
  return typeof phoneNumber === "string" && /^\+[1-9]\d{1,14}$/.test(phoneNumber);
}

module.exports = {
    generateJWT,
    getCallAttributes,
    constructFlowInputParams,
    generateTransactionId,
    isValidE164,
};