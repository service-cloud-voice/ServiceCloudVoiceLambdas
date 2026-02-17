const aws = require('aws-sdk');
const SCVLoggingUtil = require('../SCVLoggingUtil');
const config = require('../config');

// Mock AWS SecretsManager
jest.mock('aws-sdk', () => {
  const mSecretsManager = {
    getSecretValue: jest.fn().mockReturnThis(),
    promise: jest.fn()
  };
  return { SecretsManager: jest.fn(() => mSecretsManager) };
});

// Mock logger
jest.mock('../SCVLoggingUtil', () => ({
  error: jest.fn(),
  warn: jest.fn()
}));

// Mock config
jest.mock('../config', () => ({
  audience: 'test-audience',
  tokenValidFor: 1234
}));

const secretUtils = require('../secretUtils');

describe('secretUtils', () => {
  const mockSecretName = 'test/secret';
  const mockCallCenterApiName = 'multiorgscc2';
  const mockSecretData = {
    SALESFORCE_ORG_ID: 'ORGID',
    SCRT_ENDPOINT_BASE: 'SCRT',
    CALL_CENTER_API_NAME: mockCallCenterApiName,
    'multiorgscc2-scrt-jwt-auth-private-key': 'PRIVATE_KEY',
    'multiorgscc2-salesforce-rest-api-access-token': 'ACCESS_TOKEN'
  };

  let secretsManagerInstance;

  beforeEach(() => {
    secretsManagerInstance = new aws.SecretsManager();
    secretsManagerInstance.getSecretValue.mockReturnThis();
    secretsManagerInstance.promise.mockReset();
    SCVLoggingUtil.error.mockClear();
    SCVLoggingUtil.warn.mockClear();
  });

  describe('readSecret (indirectly via getSecretConfigs)', () => {
    it('should return config data from secret', async () => {
      secretsManagerInstance.promise.mockResolvedValue({
        SecretString: JSON.stringify(mockSecretData)
      });

      const result = await secretUtils.getSecretConfigs(mockSecretName);

      expect(result).toEqual({
        audience: 'test-audience',
        orgId: 'ORGID',
        scrtEndpointBase: 'SCRT',
        callCenterApiName: mockCallCenterApiName,
        privateKey: 'PRIVATE_KEY',
        tokenValidFor: 1234
      });
    });

    it('should use Lambda Extension to read secret if useSecretLambdaExtension is true (integration style)', async () => {
      jest.resetModules();
      // Mock config to enable Lambda Extension
      jest.doMock('../config', () => ({
        audience: 'test-audience',
        tokenValidFor: 1234,
        useSecretLambdaExtension: true
      }));

      // Mock axios.create to simulate Lambda Extension HTTP call
      const mockGet = jest.fn().mockResolvedValue({
        data: { SecretString: JSON.stringify(mockSecretData) }
      });
      jest.doMock('axios', () => ({
        create: jest.fn(() => ({ get: mockGet }))
      }));

      // Re-require after mocks
      const secretUtilsWithExt = require('../secretUtils');
      const result = await secretUtilsWithExt.getSecretConfigs(mockSecretName);

      expect(result).toEqual({
        audience: 'test-audience',
        orgId: 'ORGID',
        scrtEndpointBase: 'SCRT',
        callCenterApiName: mockCallCenterApiName,
        privateKey: 'PRIVATE_KEY',
        tokenValidFor: 1234
      });
    });

    it('should log and throw if secretName is missing', async () => {
      await expect(secretUtils.getSecretConfigs()).rejects.toThrow();
      expect(SCVLoggingUtil.error).toHaveBeenCalled();
    });

    it('should log and throw on AWS error', async () => {
      secretsManagerInstance.promise.mockRejectedValue(new Error('AWS error'));
      await expect(secretUtils.getSecretConfigs(mockSecretName)).rejects.toThrow('AWS error');
      expect(SCVLoggingUtil.error).toHaveBeenCalled();
    });
  });

  describe('getAccessSecretConfigs', () => {
    it('should return accessToken from secret', async () => {
      secretsManagerInstance.promise.mockResolvedValue({
        SecretString: JSON.stringify(mockSecretData)
      });

      const result = await secretUtils.getAccessSecretConfigs(mockSecretName, mockCallCenterApiName);
      expect(result).toEqual({ accessToken: 'ACCESS_TOKEN' });
    });

    it('should warn if accessToken is missing', async () => {
      const data = { ...mockSecretData };
      delete data['multiorgscc2-salesforce-rest-api-access-token'];
      secretsManagerInstance.promise.mockResolvedValue({
        SecretString: JSON.stringify(data)
      });

      const result = await secretUtils.getAccessSecretConfigs(mockSecretName, mockCallCenterApiName);
      expect(result).toEqual({ accessToken: null });
      expect(SCVLoggingUtil.warn).toHaveBeenCalled();
    });

    it('should throw if accessSecretName is missing', async () => {
      await expect(secretUtils.getAccessSecretConfigs(undefined, mockCallCenterApiName)).rejects.toThrow();
    });

    it('should throw if callCenterApiName is missing', async () => {
      await expect(secretUtils.getAccessSecretConfigs(mockSecretName)).rejects.toThrow();
    });

    it('should log and throw on AWS error', async () => {
      secretsManagerInstance.promise.mockRejectedValue(new Error('AWS error'));
      await expect(secretUtils.getAccessSecretConfigs(mockSecretName, mockCallCenterApiName)).rejects.toThrow('AWS error');
      expect(SCVLoggingUtil.error).toHaveBeenCalled();
    });
  });
});