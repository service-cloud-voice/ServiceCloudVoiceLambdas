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

  it('should handle undefined environment variables', () => {
    delete process.env.LOG_LEVEL;
    delete process.env.SECRET_NAME;

    const config = require('../config');

    expect(config.logLevel).toBeUndefined();
    expect(config.secretName).toBeUndefined();
  });

  it('should handle empty string environment variables', () => {
    process.env.LOG_LEVEL = '';
    process.env.SECRET_NAME = '';

    const config = require('../config');

    expect(config.logLevel).toBe('');
    expect(config.secretName).toBe('');
  });

  it('should export configuration object with correct properties', () => {
    process.env.LOG_LEVEL = 'info';
    process.env.SECRET_NAME = 'test-secret';

    const config = require('../config');

    expect(config).toEqual({
      logLevel: 'info',
      secretName: 'test-secret'
    });
  });
});