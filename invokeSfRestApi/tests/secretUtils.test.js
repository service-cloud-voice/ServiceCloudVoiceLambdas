const aws = require('aws-sdk');
const secretUtils = require('../secretUtils');
const SCVLoggingUtil = require('../SCVLoggingUtil');

// Mock AWS SDK
jest.mock('aws-sdk', () => {
  const getSecretValueMock = jest.fn();
  const updateSecretMock = jest.fn();

  return {
    SecretsManager: jest.fn(() => ({
      getSecretValue: getSecretValueMock,
      updateSecret: updateSecretMock,
    })),
  };
});

// Mock SCVLoggingUtil
jest.mock('../SCVLoggingUtil');

describe('secretUtils', () => {
  let secretsManager;
  let getSecretValueMock;
  let updateSecretMock;

  beforeEach(() => {
    jest.clearAllMocks();
    secretsManager = new aws.SecretsManager();
    getSecretValueMock = secretsManager.getSecretValue;
    updateSecretMock = secretsManager.updateSecret;
  });

  describe('readSecret', () => {
    it('should successfully read and parse a JSON secret', async () => {
      const secretName = 'test-secret';
      const secretValue = {
        CALL_CENTER_API_NAME: 'TestApi',
        SALESFORCE_ORG_ID: 'test-org-id'
      };

      getSecretValueMock.mockReturnValue({
        promise: () => Promise.resolve({
          SecretString: JSON.stringify(secretValue)
        })
      });

      const result = await secretUtils.readSecret(secretName);

      expect(getSecretValueMock).toHaveBeenCalledWith({ SecretId: secretName });
      expect(result).toEqual(secretValue);
    });

    it('should throw error when secret name is not provided', async () => {
      await expect(secretUtils.readSecret()).rejects.toThrow('Failed to get secret undefined: Secret name must be provided to readSecret');
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Secret name must be provided to readSecret',
        context: {},
      });
    });

    it('should throw error when secret name is empty string', async () => {
      await expect(secretUtils.readSecret('')).rejects.toThrow('Failed to get secret : Secret name must be provided to readSecret');
    });

    it('should throw error when secret contains binary data', async () => {
      const secretName = 'test-secret';

      getSecretValueMock.mockReturnValue({
        promise: () => Promise.resolve({
          SecretBinary: Buffer.from('binary-data')
        })
      });

      await expect(secretUtils.readSecret(secretName)).rejects.toThrow('Failed to get secret test-secret: SecretBinary is not supported');
    });

    it('should throw error when secret string is not valid JSON', async () => {
      const secretName = 'test-secret';

      getSecretValueMock.mockReturnValue({
        promise: () => Promise.resolve({
          SecretString: 'invalid-json'
        })
      });

      await expect(secretUtils.readSecret(secretName)).rejects.toThrow();
    });

    it('should throw error when secret string is not an object', async () => {
      const secretName = 'test-secret';

      getSecretValueMock.mockReturnValue({
        promise: () => Promise.resolve({
          SecretString: '"string-value"'
        })
      });

      await expect(secretUtils.readSecret(secretName)).rejects.toThrow('Failed to get secret test-secret: SecretString is not a valid JSON object');
    });

    it('should throw error when secret string is null', async () => {
      const secretName = 'test-secret';

      getSecretValueMock.mockReturnValue({
        promise: () => Promise.resolve({
          SecretString: 'null'
        })
      });

      await expect(secretUtils.readSecret(secretName)).rejects.toThrow('Failed to get secret test-secret: SecretString is not a valid JSON object');
    });

    it('should throw error when secret is not found', async () => {
      const secretName = 'test-secret';

      getSecretValueMock.mockReturnValue({
        promise: () => Promise.resolve({})
      });

      await expect(secretUtils.readSecret(secretName)).rejects.toThrow('Failed to get secret test-secret: Secret not found');
    });

    it('should throw error when AWS Secrets Manager call fails', async () => {
      const secretName = 'test-secret';
      const awsError = new Error('AWS service error');

      getSecretValueMock.mockReturnValue({
        promise: () => Promise.reject(awsError)
      });

      await expect(secretUtils.readSecret(secretName)).rejects.toThrow('Failed to get secret test-secret: AWS service error');
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Error reading secret from Secrets Manager: test-secret',
        context: { error: awsError },
      });
    });
  });

  describe('updateSecret', () => {
    it('should successfully update a secret', async () => {
      const secretName = 'test-secret';
      const secretValue = {
        CALL_CENTER_API_NAME: 'UpdatedApi',
        SALESFORCE_ORG_ID: 'updated-org-id'
      };
      const updateResult = { ARN: 'arn:aws:secretsmanager:region:account:secret:test-secret' };

      updateSecretMock.mockReturnValue({
        promise: () => Promise.resolve(updateResult)
      });

      const result = await secretUtils.updateSecret(secretName, secretValue);

      expect(updateSecretMock).toHaveBeenCalledWith({
        SecretId: secretName,
        SecretString: JSON.stringify(secretValue)
      });
      expect(result).toEqual(updateResult);
      expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
        message: 'Secret test-secret updated successfully',
        context: { secretName },
      });
    });

    it('should throw error when secret name is not provided', async () => {
      const secretValue = { key: 'value' };

      await expect(secretUtils.updateSecret(undefined, secretValue)).rejects.toThrow('Failed to update secret undefined: Secret name must be provided to updateSecret');
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Secret name must be provided to updateSecret',
        context: {},
      });
    });

    it('should throw error when secret name is empty string', async () => {
      const secretValue = { key: 'value' };

      await expect(secretUtils.updateSecret('', secretValue)).rejects.toThrow('Failed to update secret : Secret name must be provided to updateSecret');
    });

    it('should throw error when secret value is not provided', async () => {
      const secretName = 'test-secret';

      await expect(secretUtils.updateSecret(secretName)).rejects.toThrow('Failed to update secret test-secret: Secret value must be a non-null object');
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Secret value must be a non-null object',
        context: {},
      });
    });

    it('should throw error when secret value is null', async () => {
      const secretName = 'test-secret';

      await expect(secretUtils.updateSecret(secretName, null)).rejects.toThrow('Failed to update secret test-secret: Secret value must be a non-null object');
    });

    it('should throw error when secret value is not an object', async () => {
      const secretName = 'test-secret';

      await expect(secretUtils.updateSecret(secretName, 'string-value')).rejects.toThrow('Failed to update secret test-secret: Secret value must be a non-null object');
    });

    it('should throw error when AWS Secrets Manager update fails', async () => {
      const secretName = 'test-secret';
      const secretValue = { key: 'value' };
      const awsError = new Error('AWS update error');

      updateSecretMock.mockReturnValue({
        promise: () => Promise.reject(awsError)
      });

      await expect(secretUtils.updateSecret(secretName, secretValue)).rejects.toThrow('Failed to update secret test-secret: AWS update error');
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Error updating secret in Secrets Manager: test-secret',
        context: { error: awsError },
      });
    });
  });

  describe('getSecretConfigs', () => {
    it('should successfully extract configs from secret', async () => {
      const secretName = 'test-secret';
      const callCenterApiName = 'TestApi';
      const secretValue = {
        CALL_CENTER_API_NAME: callCenterApiName,
        SALESFORCE_REST_API_ENDPOINT_BASE: 'https://api.salesforce.com',
        SALESFORCE_AUTH_ENDPOINT: 'https://login.salesforce.com',
        [`${callCenterApiName}-salesforce-rest-api-auth-consumer-key`]: 'consumer-key',
        [`${callCenterApiName}-salesforce-rest-api-auth-private-key`]: 'private-key',
        [`${callCenterApiName}-salesforce-rest-api-audience`]: 'audience',
        [`${callCenterApiName}-salesforce-rest-api-subject`]: 'subject'
      };

      getSecretValueMock.mockReturnValue({
        promise: () => Promise.resolve({
          SecretString: JSON.stringify(secretValue)
        })
      });

      const result = await secretUtils.getSecretConfigs(secretName);

      expect(result).toEqual({
        callCenterApiName: callCenterApiName,
        baseURL: 'https://api.salesforce.com',
        authEndpoint: 'https://login.salesforce.com',
        consumerKey: 'consumer-key',
        privateKey: 'private-key',
        audience: 'audience',
        subject: 'subject'
      });
    });

    it('should handle missing optional config values', async () => {
      const secretName = 'test-secret';
      const callCenterApiName = 'TestApi';
      const secretValue = {
        CALL_CENTER_API_NAME: callCenterApiName,
        // Missing other values
      };

      getSecretValueMock.mockReturnValue({
        promise: () => Promise.resolve({
          SecretString: JSON.stringify(secretValue)
        })
      });

      const result = await secretUtils.getSecretConfigs(secretName);

      expect(result).toEqual({
        callCenterApiName: callCenterApiName,
        baseURL: undefined,
        authEndpoint: undefined,
        consumerKey: undefined,
        privateKey: undefined,
        audience: undefined,
        subject: undefined
      });
    });

    it('should propagate errors from readSecret', async () => {
      const secretName = 'test-secret';
      const awsError = new Error('AWS service error');

      getSecretValueMock.mockReturnValue({
        promise: () => Promise.reject(awsError)
      });

      await expect(secretUtils.getSecretConfigs(secretName)).rejects.toThrow('Failed to get secret test-secret: AWS service error');
    });
  });
});