const jwt = require("jsonwebtoken");
const SSM = require("aws-sdk/clients/ssm");
const uuid = require("uuid/v1");
const config = require("./config");
const axiosWrapper = require("./axiosWrapper");

async function getSSMParameters(paramNames, withDecryption) {
  return new Promise((resolve) => {
    const ssm = new SSM();
    const query = {
      Names: paramNames,
      WithDecryption: withDecryption,
    };

    ssm.getParameters(query, (err, data) => {
      let params = [];

      if (!err && data && data.Parameters && data.Parameters.length) {
        params = data.Parameters;
      }
      resolve(params);
    });
  });
}

function putSSMParameter(name, value) {
  const ssm = new SSM();
  const param = {
    Name: name,
    Value: value,
    Tier: "Standard",
    Type: "SecureString",
    Overwrite: true,
  };

  ssm.putParameter(param, () => {});
}

function generateJWT(payload, expiresIn, privateKey) {
  const options = {
    algorithm: "RS256",
    expiresIn,
    jwtid: uuid(),
  };

  return jwt.sign(payload, privateKey, options);
}

async function getAccessToken(refresh) {
  const ssmParams = await getSSMParameters(
    [
      config.consumerKeyParamName,
      config.privateKeyParamName,
      config.accessTokenParamName,
      config.audienceParamName,
      config.subjectParamName,
    ],
    true
  );
  const consumerKey = ssmParams.filter(
    (p) => p.Name === config.consumerKeyParamName
  )[0].Value;
  const privateKey = ssmParams.filter(
    (p) => p.Name === config.privateKeyParamName
  )[0].Value;
  const accessTokenParam = ssmParams.filter(
    (p) => p.Name === config.accessTokenParamName
  )[0];
  const aud = ssmParams.filter((p) => p.Name === config.audienceParamName)[0]
    .Value;
  const sub = ssmParams.filter((p) => p.Name === config.subjectParamName)[0]
    .Value;

  if (!accessTokenParam || refresh) {
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
      "",
      `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${generatedJwt}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    putSSMParameter(config.accessTokenParamName, response.data.access_token);

    return response.data.access_token;
  }

  return accessTokenParam.Value;
}

function formatObjectApiName(objectApiName) {
  const firstChar = objectApiName.substring(0, 1);
  const remainingStr = objectApiName.substring(1);

  return `${firstChar.toUpperCase()}${remainingStr.toLowerCase()}`;
}

const NON_FIELD_NAMES = ["methodName", "objectApiName", "recordId"];

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
    if (key !== "methodName") {
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
