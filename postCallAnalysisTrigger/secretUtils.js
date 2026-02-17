const aws = require('aws-sdk');
const SCVLoggingUtil = require('./SCVLoggingUtil');

const secretsManager = new aws.SecretsManager();

// Configuration keys for secret data
const CONFIG_KEYS = {
    SALESFORCE_ORG_ID: 'SALESFORCE_ORG_ID',
    SCRT_ENDPOINT_BASE: 'SCRT_ENDPOINT_BASE',
    CALL_CENTER_API_NAME: 'CALL_CENTER_API_NAME'
};

/**
 * Reads a secret from AWS Secrets Manager
 * @param {string} secretName - The name of the secret to retrieve
 * @returns {Promise<Object>} Secret data as JSON object
 */
async function readSecret(secretName) {
    if (!secretName) {
        throw new Error('Secret name is required');
    }

    try {
        const secretResponse = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
        const secretData = JSON.parse(secretResponse.SecretString);

        SCVLoggingUtil.debug({
            message: 'Successfully retrieved secret',
            context: { secretName }
        });

        return secretData;
    } catch (error) {
        SCVLoggingUtil.error({
            message: 'Error reading secret from AWS Secrets Manager',
            context: { secretName, error: error.message }
        });
        throw error;
    }
}

/**
 * Gets configuration data from secrets manager
 * @param {string} secretName - The name of the secret to retrieve
 * @returns {Promise<Object>} Configuration object
 */
async function getSecretConfigs(secretName) {
    try {
        const secretData = await readSecret(secretName);

        const salesforceOrgId = secretData[CONFIG_KEYS.SALESFORCE_ORG_ID];
        const scrtEndpointBase = secretData[CONFIG_KEYS.SCRT_ENDPOINT_BASE];
        const callCenterApiName = secretData[CONFIG_KEYS.CALL_CENTER_API_NAME];

        // Build the private key parameter name from the call center API name
        const privateKeyParamName = `${callCenterApiName}-scrt-jwt-auth-private-key`;
        const privateKey = secretData[privateKeyParamName];

        if (!salesforceOrgId || !scrtEndpointBase || !callCenterApiName) {
            throw new Error('Missing required secret configuration values');
        }

        const config = {
            salesforceOrgId,
            scrtEndpointBase,
            callCenterApiName,
            privateKey
        };

        SCVLoggingUtil.debug({
            message: 'Successfully built configuration from secret',
            context: { secretName, callCenterApiName }
        });

        return config;
    } catch (error) {
        SCVLoggingUtil.error({
            message: 'Error getting secret configuration',
            context: { secretName, error: error.message }
        });
        throw error;
    }
}

module.exports = {
    getSecretConfigs,
    CONFIG_KEYS
};