const utils = require('../utils.js');

jest.mock('jsonwebtoken');
const jwt = require('jsonwebtoken');

jest.mock('uuid/v1');
const uuid = require('uuid');

afterEach(() => {
  jest.clearAllMocks();
});

describe('generateJWT', () => {
  it('should invoke jwt.sign() with proper arguments for SCV (no roles claim)', async () => {
    jest.spyOn(uuid, 'v1').mockReturnValue('123456789');
    jwt.sign.mockReturnValueOnce('test_signed_jwt');

    const result = await utils.generateJWT({
      privateKey: 'test_private_key',
      orgId: 'test_org_id',
      callCenterApiName: 'test_call_center_api_name',
      expiresIn: '15m',
      includeRolesClaim: false
    });

    expect(jwt.sign).toHaveBeenCalledWith({}, 'test_private_key', {
      issuer: 'test_org_id',
      subject: 'test_call_center_api_name',
      expiresIn: '15m',
      algorithm: 'RS256',
      jwtid: '123456789'
    });
    expect(result).toBe('test_signed_jwt');
  });

  it('should invoke jwt.sign() with roles claim for non-SCV', async () => {
    jest.spyOn(uuid, 'v1').mockReturnValue('123456789');
    jwt.sign.mockReturnValueOnce('test_signed_jwt_with_roles');

    const result = await utils.generateJWT({
      privateKey: 'test_private_key',
      orgId: 'test_org_id',
      callCenterApiName: 'test_call_center_api_name',
      expiresIn: '15m',
      includeRolesClaim: true
    });

    expect(jwt.sign).toHaveBeenCalledWith({ roles: 'voiceagent' }, 'test_private_key', {
      issuer: 'test_org_id',
      subject: 'test_call_center_api_name',
      expiresIn: '15m',
      algorithm: 'RS256',
      jwtid: '123456789'
    });
    expect(result).toBe('test_signed_jwt_with_roles');
  });

  it('should invoke jwt.sign() once', async () => {
    jwt.sign.mockReturnValueOnce('test_signed_jwt');

    await utils.generateJWT({
      privateKey: 'test_private_key',
      orgId: 'test_org_id',
      callCenterApiName: 'test_call_center_api_name',
      expiresIn: '15m',
      includeRolesClaim: false
    });

    expect(jwt.sign).toHaveBeenCalledTimes(1);
  });

  it('should return the result of the jwt.sign() call', async () => {
    jwt.sign.mockReturnValueOnce('test_signed_jwt');

    const result = await utils.generateJWT({
      privateKey: 'test_private_key',
      orgId: 'test_org_id',
      callCenterApiName: 'test_call_center_api_name',
      expiresIn: '15m',
      includeRolesClaim: false
    });

    expect(result).toBe('test_signed_jwt');
  });
});
