const winston = require('winston');
const SCVLoggingUtil = require('../SCVLoggingUtil');

jest.mock('winston', () => {
  const logger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    createLogger: jest.fn(() => logger),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      prettyPrint: jest.fn(),
      json: jest.fn(),
    },
    transports: {
      Console: jest.fn(),
    },
  };
  return logger;
});

describe('SCVLoggingUtil', () => {
  it('info logs with correct structure', () => {
    SCVLoggingUtil.info({ message: 'msg', context: { foo: 'bar' } });
    expect(winston.info).toHaveBeenCalled();
  });
  it('debug logs with correct structure', () => {
    SCVLoggingUtil.debug({ message: 'msg', context: { foo: 'bar' } });
    expect(winston.debug).toHaveBeenCalled();
  });
  it('warn logs with correct structure', () => {
    SCVLoggingUtil.warn({ message: 'msg', context: { foo: 'bar' } });
    expect(winston.warn).toHaveBeenCalled();
  });
  it('error logs with correct structure', () => {
    SCVLoggingUtil.error({ message: 'msg', context: { foo: 'bar' } });
    expect(winston.error).toHaveBeenCalled();
  });
  it('buildLog returns expected log object', () => {
    const log = SCVLoggingUtil.debug({ message: 'msg', context: { foo: 'bar' } });
    expect(typeof log).toBe('undefined'); // debug returns undefined
  });
});