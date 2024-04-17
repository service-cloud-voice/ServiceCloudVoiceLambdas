const jwt = require("jsonwebtoken");
const SSM = require("aws-sdk/clients/ssm");
const uuid = require("uuid/v1");

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

module.exports = {
  getSSMParameterValue,
  generateJWT,
  getCallAttributes,
  constructFlowInputParams,
};
