describe('config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should export logLevel from LOG_LEVEL environment variable', () => {
    process.env.LOG_LEVEL = 'debug';

    const config = require('../config');

    expect(config.logLevel).toBe('debug');
  });

  it('should export secretName from SECRET_NAME environment variable', () => {
    process.env.SECRET_NAME = 'my-secret-name';

    const config = require('../config');

    expect(config.secretName).toBe('my-secret-name');
  });

  it('should export jwtSecretName from JWT_SECRET_NAME environment variable', () => {
    process.env.JWT_SECRET_NAME = 'my-jwt-secret-name';

    const config = require('../config');

    expect(config.jwtSecretName).toBe('my-jwt-secret-name');
  });

  it('should handle undefined environment variables', () => {
    delete process.env.LOG_LEVEL;
    delete process.env.SECRET_NAME;
    delete process.env.JWT_SECRET_NAME;

    const config = require('../config');

    expect(config.logLevel).toBeUndefined();
    expect(config.secretName).toBeUndefined();
    expect(config.jwtSecretName).toBeUndefined();
  });

  it('should default tokenValidFor to 60m', () => {
    const config = require('../config');

    expect(config.tokenValidFor).toBe('60m');
  });

  it('should set includeRolesClaim to true when INCLUDE_ROLES_CLAIM is "true"', () => {
    process.env.INCLUDE_ROLES_CLAIM = 'true';

    const config = require('../config');

    expect(config.includeRolesClaim).toBe(true);
  });

  it('should set includeRolesClaim to false when INCLUDE_ROLES_CLAIM is not "true"', () => {
    process.env.INCLUDE_ROLES_CLAIM = 'false';

    const config = require('../config');

    expect(config.includeRolesClaim).toBe(false);
  });

  it('should set includeRolesClaim to false when INCLUDE_ROLES_CLAIM is undefined', () => {
    delete process.env.INCLUDE_ROLES_CLAIM;

    const config = require('../config');

    expect(config.includeRolesClaim).toBe(false);
  });

  it('should export configuration object with correct properties for SCV', () => {
    process.env.LOG_LEVEL = 'info';
    process.env.SECRET_NAME = 'test-secret';
    process.env.JWT_SECRET_NAME = 'test-jwt-secret';
    delete process.env.INCLUDE_ROLES_CLAIM;

    const config = require('../config');

    expect(config).toEqual({
      logLevel: 'info',
      secretName: 'test-secret',
      jwtSecretName: 'test-jwt-secret',
      tokenValidFor: '60m',
      includeRolesClaim: false,
    });
  });

  it('should export configuration object with correct properties for non-SCV', () => {
    process.env.LOG_LEVEL = 'info';
    process.env.SECRET_NAME = 'test-secret';
    process.env.JWT_SECRET_NAME = 'test-jwt-secret';
    process.env.INCLUDE_ROLES_CLAIM = 'true';

    const config = require('../config');

    expect(config).toEqual({
      logLevel: 'info',
      secretName: 'test-secret',
      jwtSecretName: 'test-jwt-secret',
      tokenValidFor: '60m',
      includeRolesClaim: true,
    });
  });
});
