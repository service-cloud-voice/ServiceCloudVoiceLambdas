const aws = require('aws-sdk');
const SCVLoggingUtil = require('./SCVLoggingUtil');

const secretsManager = new aws.SecretsManager();

/**
 * Reads a secret value from AWS Secrets Manager.
 * @param {string} secretName - The name or ARN of the secret
 * @returns {Promise<Object|null>} Hash map of secret values, or null if not found/error
 */
async function readSecret(secretName) {
  if (!secretName) {
    const errMsg = 'Secret name must be provided to readSecret';
    SCVLoggingUtil.error({
      message: errMsg,
      context: {},
    });
    throw new Error(`Failed to get secret ${secretName}: ${errMsg}`);
  }
  try {
    const data = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
    if ('SecretString' in data) {
      try {
        return JSON.parse(data.SecretString);
      } catch (e) {
        throw new Error(`Failed to get secret ${secretName}: ${e.message}`);
      }
    } else if ('SecretBinary' in data) {
      // If secret is binary, throw error
      throw new Error(`Failed to get secret ${secretName}: SecretBinary is not supported`);
    }
    throw new Error(`Failed to get secret ${secretName}: Secret not found`);
  } catch (err) {
    SCVLoggingUtil.error({
      message: `Error reading secret from Secrets Manager: ${secretName}`,
      context: { error: err },
    });
    throw new Error(`Failed to get secret ${secretName}: ${err.message}`);
  }
}

/**
 * Writes a plain text value to a secret in AWS Secrets Manager.
 * @param {string} secretName - The name or ARN of the secret
 * @param {string} secretValue - The plain text value to store
 * @returns {Promise<void>}
 */
async function writeSecret(secretName, secretValue) {
  if (!secretName) {
    const errMsg = 'Secret name must be provided to writeSecret';
    SCVLoggingUtil.error({
      message: errMsg,
      context: {},
    });
    throw new Error(`Failed to write secret ${secretName}: ${errMsg}`);
  }

  if (typeof secretValue !== 'string' || !secretValue) {
    const errMsg = 'Secret value must be a non-empty string';
    SCVLoggingUtil.error({
      message: errMsg,
      context: { secretName },
    });
    throw new Error(`Failed to write secret ${secretName}: ${errMsg}`);
  }

  try {
    await secretsManager.updateSecret({
      SecretId: secretName,
      SecretString: secretValue
    }).promise();
    SCVLoggingUtil.info({
      message: `Successfully updated secret: ${secretName}`,
      context: { secretName },
    });
  } catch (err) {
    SCVLoggingUtil.error({
      message: `Error writing secret to Secrets Manager: ${secretName}`,
      context: { error: err },
    });
    throw new Error(`Failed to write secret ${secretName}: ${err.message}`);
  }
}

module.exports = {
  readSecret,
  writeSecret
};
