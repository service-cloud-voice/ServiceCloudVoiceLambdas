const aws = require('aws-sdk');
const config = require('./config');
const SCVLoggingUtil = require('./SCVLoggingUtil');

const secretsManager = new aws.SecretsManager();

// Configuration keys for secret data
const CONFIG_KEYS = {
    SALESFORCE_ORG_ID: 'SALESFORCE_ORG_ID',
    SCRT_ENDPOINT_BASE: 'SCRT_ENDPOINT_BASE',
    CALL_CENTER_API_NAME: 'CALL_CENTER_API_NAME'
};

/**
 * Generic function to read a secret from AWS Secrets Manager
 * @param {string} secretName - The name of the secret to retrieve
 * @returns {Promise<Object>} Parsed secret data
 */
async function readSecret(secretName) {
    if (!secretName) {
        throw new Error('Secret name is required');
    }

    try {
        const secretResponse = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
        return JSON.parse(secretResponse.SecretString);
    } catch (error) {
        SCVLoggingUtil.error({
            message: 'Error reading secret from AWS Secrets Manager',
            context: { secretName, error: error.message }
        });
        throw error;
    }
}

/**
 * Gets configuration data by reading and parsing secrets specific to multiorgHandleContactEvents
 * @param {string} secretName - The name of the secret to retrieve
 * @returns {Promise<Object>} Configuration object built from secret data
 */
async function getSecretConfigs(secretName) {
    try {
        // Read secret data using generic function
        const secretData = await readSecret(secretName);

        // Build configuration from secret data (specific to this lambda)
        const orgId = secretData[CONFIG_KEYS.SALESFORCE_ORG_ID];
        const endpointBase = secretData[CONFIG_KEYS.SCRT_ENDPOINT_BASE];
        const callCenterApiName = secretData[CONFIG_KEYS.CALL_CENTER_API_NAME];

        const privateKeyParam = `${callCenterApiName}-scrt-jwt-auth-private-key`;
        const privateKey = secretData[privateKeyParam];

        const configData = {
            audience: config.audience,
            orgId: orgId,
            scrtEndpointBase: endpointBase,
            callCenterApiName,
            privateKey,
            tokenValidFor: config.tokenValidFor
        };

        return configData;
    } catch (error) {
        SCVLoggingUtil.error({
            message: 'Error getting config from secret',
            context: { secretName, error: error.message }
        });
        throw error;
    }
}

module.exports = {
    readSecret,
    getSecretConfigs,
    CONFIG_KEYS
};