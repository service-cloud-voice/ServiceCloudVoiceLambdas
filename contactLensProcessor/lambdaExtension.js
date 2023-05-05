const axios = require("axios");

const aws_session_token = process.env.AWS_SESSION_TOKEN;

// AWS Lambda Extension Ports
const ports = {
  SSM_LAMBDA_EXTENSION_PORT: 2773,
};

async function executeExtension(url, port, requestParams) {
  const awsLambdaExtensionClient = axios.create({
    baseURL: `http://localhost:${port}`,
    timeout: 2000,
    headers: {
      "x-aws-parameters-secrets-token": aws_session_token,
    },
  });
  const lambdaExtensionResponse = await awsLambdaExtensionClient.get(url, {
    params: requestParams,
  });
  return lambdaExtensionResponse;
}

async function readSSMParameter(paramName) {
  const encodedParamName = encodeURIComponent(paramName);
  const ssmURL = `/systemsmanager/parameters/get`;
  const requestParams = {
    name: encodedParamName,
    withDecryption: true,
  };
  const ssmExtensionResponse = await executeExtension(
    ssmURL,
    ports.SSM_LAMBDA_EXTENSION_PORT,
    requestParams
  );
  return ssmExtensionResponse.data.Parameter.Value;
}

module.exports = {
  readSSMParameter,
};
