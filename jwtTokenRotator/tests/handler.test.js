jest.mock('../secretUtils');
jest.mock('../utils');
jest.mock('../SCVLoggingUtil');

jest.mock('../config', () => ({
  logLevel: 'info',
  secretName: 'test-cc-salesforce-secret',
  jwtSecretName: 'test-cc-salesforce-jwt-secret',
  tokenValidFor: '20m',
}));

const { readSecret, writeSecret } = require('../secretUtils');
const { generateJWT } = require('../utils');
const SCVLoggingUtil = require('../SCVLoggingUtil');
const config = require('../config');
const handler = require('../handler');

describe('jwtTokenRotator handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mints a JWT read from the existing secret and writes it as plain text into the dedicated JWT secret', async () => {
    const existingSecretData = {
      SALESFORCE_ORG_ID: 'test_org_id',
      CALL_CENTER_API_NAME: 'test_cc_api_name',
      'test_cc_api_name-scrt-jwt-auth-private-key': 'test_private_key',
      otherField: 'otherValue',
    };
    readSecret.mockResolvedValue(existingSecretData);
    generateJWT.mockResolvedValue('signed.jwt.token');
    writeSecret.mockResolvedValue();

    const result = await handler.handler({});

    expect(readSecret).toHaveBeenCalledWith(config.secretName);
    expect(generateJWT).toHaveBeenCalledWith({
      orgId: 'test_org_id',
      callCenterApiName: 'test_cc_api_name',
      expiresIn: '20m',
      privateKey: 'test_private_key',
    });
    expect(writeSecret).toHaveBeenCalledWith(config.jwtSecretName, 'signed.jwt.token');
    expect(result).toEqual({
      statusCode: 200,
      message: 'JWT token rotated successfully',
    });
    expect(SCVLoggingUtil.info).toHaveBeenCalled();
  });

  it('throws when SECRET_NAME configuration is not set', async () => {
    jest.resetModules();
    jest.doMock('../secretUtils');
    jest.doMock('../utils');
    jest.doMock('../SCVLoggingUtil');
    jest.doMock('../config', () => ({
      logLevel: 'info',
      secretName: undefined,
      jwtSecretName: 'test-cc-salesforce-jwt-secret',
      tokenValidFor: '20m',
    }));
    const handlerWithoutSecret = require('../handler');

    await expect(handlerWithoutSecret.handler({})).rejects.toThrow('SECRET_NAME configuration is not set');
  });

  it('throws when JWT_SECRET_NAME configuration is not set', async () => {
    jest.resetModules();
    jest.doMock('../secretUtils');
    jest.doMock('../utils');
    jest.doMock('../SCVLoggingUtil');
    jest.doMock('../config', () => ({
      logLevel: 'info',
      secretName: 'test-cc-salesforce-secret',
      jwtSecretName: undefined,
      tokenValidFor: '20m',
    }));
    const handlerWithoutJwtSecret = require('../handler');

    await expect(handlerWithoutJwtSecret.handler({})).rejects.toThrow('JWT_SECRET_NAME configuration is not set');
  });

  it('rotates the secrets named in the event payload instead of the env-configured ones, for shared/multiorg invocations', async () => {
    const existingSecretData = {
      SALESFORCE_ORG_ID: 'multiorg_test_org_id',
      CALL_CENTER_API_NAME: 'multiorg_test_cc_api_name',
      'multiorg_test_cc_api_name-scrt-jwt-auth-private-key': 'multiorg_test_private_key',
    };
    readSecret.mockResolvedValue(existingSecretData);
    generateJWT.mockResolvedValue('signed.jwt.token');
    writeSecret.mockResolvedValue();

    const result = await handler.handler({
      secretName: 'multiorg-cc-salesforce-secret',
      jwtSecretName: 'multiorg-cc-salesforce-jwt-secret',
    });

    expect(readSecret).toHaveBeenCalledWith('multiorg-cc-salesforce-secret');
    expect(writeSecret).toHaveBeenCalledWith('multiorg-cc-salesforce-jwt-secret', 'signed.jwt.token');
    expect(result).toEqual({
      statusCode: 200,
      message: 'JWT token rotated successfully',
    });
  });

  it('throws when orgId is missing from the secret', async () => {
    readSecret.mockResolvedValue({
      CALL_CENTER_API_NAME: 'test_cc_api_name',
      'test_cc_api_name-scrt-jwt-auth-private-key': 'test_private_key',
    });

    await expect(handler.handler({})).rejects.toThrow(
      `Missing required secret fields for JWT generation in secret ${config.secretName}`
    );
    expect(generateJWT).not.toHaveBeenCalled();
    expect(writeSecret).not.toHaveBeenCalled();
    expect(SCVLoggingUtil.error).toHaveBeenCalled();
  });

  it('throws when callCenterApiName is missing from the secret', async () => {
    readSecret.mockResolvedValue({
      SALESFORCE_ORG_ID: 'test_org_id',
    });

    await expect(handler.handler({})).rejects.toThrow(
      `Missing required secret fields for JWT generation in secret ${config.secretName}`
    );
    expect(generateJWT).not.toHaveBeenCalled();
  });

  it('throws when the per-CC private key field is missing from the secret', async () => {
    readSecret.mockResolvedValue({
      SALESFORCE_ORG_ID: 'test_org_id',
      CALL_CENTER_API_NAME: 'test_cc_api_name',
    });

    await expect(handler.handler({})).rejects.toThrow(
      `Missing required secret fields for JWT generation in secret ${config.secretName}`
    );
    expect(generateJWT).not.toHaveBeenCalled();
  });

  it('propagates errors when readSecret fails', async () => {
    const readError = new Error('Failed to read secret');
    readSecret.mockRejectedValue(readError);

    await expect(handler.handler({})).rejects.toThrow('Failed to read secret');
    expect(generateJWT).not.toHaveBeenCalled();
  });

  it('propagates errors when writeSecret fails', async () => {
    readSecret.mockResolvedValue({
      SALESFORCE_ORG_ID: 'test_org_id',
      CALL_CENTER_API_NAME: 'test_cc_api_name',
      'test_cc_api_name-scrt-jwt-auth-private-key': 'test_private_key',
    });
    generateJWT.mockResolvedValue('signed.jwt.token');
    const writeError = new Error('Failed to write secret');
    writeSecret.mockRejectedValue(writeError);

    await expect(handler.handler({})).rejects.toThrow('Failed to write secret');
  });
});
