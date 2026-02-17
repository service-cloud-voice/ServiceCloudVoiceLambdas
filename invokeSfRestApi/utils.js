const jwt = require("jsonwebtoken");
const uuid = require("uuid/v1");
const config = require("./config");
const axiosWrapper = require("./axiosWrapper");
const secretUtils = require("./secretUtils");

function generateJWT(payload, expiresIn, privateKey) {
  const options = {
    algorithm: "RS256",
    expiresIn,
    jwtid: uuid(),
  };

  return jwt.sign(payload, privateKey, options);
}

async function getAccessToken(configs, accessTokenSecretName, refresh) {
  const callCenterApiName = configs.callCenterApiName;
  const consumerKey = configs.consumerKey;
  const privateKey = configs.privateKey;
  const aud = configs.audience;
  const sub = configs.subject;

  const accessTokenSecret = await secretUtils.readSecret(accessTokenSecretName);
  const accessToken = accessTokenSecret[callCenterApiName + "-salesforce-rest-api-access-token"];

  if (!accessToken || refresh) {
    // Obtain a new access token.
    const generatedJwt = generateJWT(
      {
        iss: consumerKey,
        sub,
        aud,
      },
      config.tokenValidFor,
      privateKey
    );
    const response = await axiosWrapper.authEndpoint.post(
        configs.authEndpoint,
      `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${generatedJwt}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    accessTokenSecret[callCenterApiName + "-salesforce-rest-api-access-token"] = response.data.access_token;
    await secretUtils.updateSecret(accessTokenSecretName, accessTokenSecret);

    return response.data.access_token;
  }

  return accessToken;
}

function formatObjectApiName(objectApiName) {
  const firstChar = objectApiName.substring(0, 1);
  const remainingStr = objectApiName.substring(1);

  return `${firstChar.toUpperCase()}${remainingStr.toLowerCase()}`;
}

const NON_FIELD_NAMES = ["methodName", "objectApiName", "recordId", "secretName", "accessTokenSecretName"];

function getSObjectFieldValuesFromConnectLambdaParams(params) {
  const fieldValues = {};

  Object.entries(params).forEach((entry) => {
    const key = entry[0];

    if (NON_FIELD_NAMES.includes(key)) {
      return;
    }

    fieldValues[key] = entry[1];
  });

  return fieldValues;
}

function getRealtimeAlertEventFieldValuesFromConnectLambdaParams(params) {
  const fieldValues = {};
  Object.entries(params).forEach((entry) => {
    const key = entry[0];
    if (key !== "methodName" && key !== "secretName" && key !== "accessTokenSecretName") {
      fieldValues[key] = entry[1];
    }
  });
  return fieldValues;
}

module.exports = {
  generateJWT,
  getAccessToken,
  formatObjectApiName,
  getSObjectFieldValuesFromConnectLambdaParams,
  getRealtimeAlertEventFieldValuesFromConnectLambdaParams,
};
