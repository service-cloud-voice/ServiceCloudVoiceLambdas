// Mock AWS SDK
const mockSecretsManager = {
  getSecretValue: jest.fn(),
  updateSecret: jest.fn()
};

jest.mock('aws-sdk', () => ({
  SecretsManager: jest.fn(() => mockSecretsManager)
}));

// Mock SCVLoggingUtil
jest.mock('../SCVLoggingUtil', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const { readSecret, writeSecret } = require('../secretUtils');
const SCVLoggingUtil = require('../SCVLoggingUtil');

describe('secretUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('readSecret', () => {
    it('should successfully read a JSON secret', async () => {
      const secretName = 'test-secret';
      const secretData = { key1: 'value1', key2: 'value2' };

      mockSecretsManager.getSecretValue.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          SecretString: JSON.stringify(secretData)
        })
      });

      const result = await readSecret(secretName);

      expect(result).toEqual(secretData);
      expect(mockSecretsManager.getSecretValue).toHaveBeenCalledWith({
        SecretId: secretName
      });
    });

    it('should throw error when secret name is not provided', async () => {
      await expect(readSecret()).rejects.toThrow('Failed to get secret undefined: Secret name must be provided to readSecret');
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Secret name must be provided to readSecret',
        context: {}
      });
    });

    it('should throw error when secret name is empty string', async () => {
      await expect(readSecret('')).rejects.toThrow('Failed to get secret : Secret name must be provided to readSecret');
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Secret name must be provided to readSecret',
        context: {}
      });
    });

    it('should throw error when SecretString contains invalid JSON', async () => {
      const secretName = 'test-secret';

      mockSecretsManager.getSecretValue.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          SecretString: 'invalid-json'
        })
      });

      await expect(readSecret(secretName)).rejects.toThrow('Failed to get secret test-secret:');
    });

    it('should throw error when secret contains SecretBinary', async () => {
      const secretName = 'test-secret';

      mockSecretsManager.getSecretValue.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          SecretBinary: Buffer.from('binary-data')
        })
      });

      await expect(readSecret(secretName)).rejects.toThrow('Failed to get secret test-secret: SecretBinary is not supported');
    });

    it('should throw error when secret is not found', async () => {
      const secretName = 'test-secret';

      mockSecretsManager.getSecretValue.mockReturnValue({
        promise: jest.fn().mockResolvedValue({})
      });

      await expect(readSecret(secretName)).rejects.toThrow('Failed to get secret test-secret: Secret not found');
    });

    it('should handle AWS SDK errors', async () => {
      const secretName = 'test-secret';
      const awsError = new Error('AWS error');

      mockSecretsManager.getSecretValue.mockReturnValue({
        promise: jest.fn().mockRejectedValue(awsError)
      });

      await expect(readSecret(secretName)).rejects.toThrow('Failed to get secret test-secret: AWS error');
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Error reading secret from Secrets Manager: test-secret',
        context: { error: awsError }
      });
    });
  });

  describe('writeSecret', () => {
    it('should successfully write a secret', async () => {
      const secretName = 'test-secret';
      const secretValue = { key1: 'value1', key2: 'value2' };

      mockSecretsManager.updateSecret.mockReturnValue({
        promise: jest.fn().mockResolvedValue({})
      });

      await writeSecret(secretName, secretValue);

      expect(mockSecretsManager.updateSecret).toHaveBeenCalledWith({
        SecretId: secretName,
        SecretString: JSON.stringify(secretValue)
      });
      expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
        message: `Successfully updated secret: ${secretName}`,
        context: { secretName }
      });
    });

    it('should throw error when secret name is not provided', async () => {
      const secretValue = { key1: 'value1' };

      await expect(writeSecret(undefined, secretValue)).rejects.toThrow('Failed to write secret undefined: Secret name must be provided to writeSecret');
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Secret name must be provided to writeSecret',
        context: {}
      });
    });

    it('should throw error when secret name is empty string', async () => {
      const secretValue = { key1: 'value1' };

      await expect(writeSecret('', secretValue)).rejects.toThrow('Failed to write secret : Secret name must be provided to writeSecret');
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Secret name must be provided to writeSecret',
        context: {}
      });
    });

    it('should throw error when secret value is not provided', async () => {
      const secretName = 'test-secret';

      await expect(writeSecret(secretName)).rejects.toThrow('Failed to write secret test-secret: Secret value must be a valid object');
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Secret value must be a valid object',
        context: { secretName }
      });
    });

    it('should throw error when secret value is not an object', async () => {
      const secretName = 'test-secret';
      const secretValue = 'not-an-object';

      await expect(writeSecret(secretName, secretValue)).rejects.toThrow('Failed to write secret test-secret: Secret value must be a valid object');
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Secret value must be a valid object',
        context: { secretName }
      });
    });

    it('should throw error when secret value is null', async () => {
      const secretName = 'test-secret';
      const secretValue = null;

      await expect(writeSecret(secretName, secretValue)).rejects.toThrow('Failed to write secret test-secret: Secret value must be a valid object');
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Secret value must be a valid object',
        context: { secretName }
      });
    });

    it('should handle AWS SDK errors', async () => {
      const secretName = 'test-secret';
      const secretValue = { key1: 'value1' };
      const awsError = new Error('AWS update error');

      mockSecretsManager.updateSecret.mockReturnValue({
        promise: jest.fn().mockRejectedValue(awsError)
      });

      await expect(writeSecret(secretName, secretValue)).rejects.toThrow('Failed to write secret test-secret: AWS update error');
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Error writing secret to Secrets Manager: test-secret',
        context: { error: awsError }
      });
    });
  });
});