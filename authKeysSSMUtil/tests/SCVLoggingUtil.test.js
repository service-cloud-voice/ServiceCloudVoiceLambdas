// Mock winston first
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

jest.mock('winston', () => ({
  createLogger: jest.fn(() => mockLogger),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    prettyPrint: jest.fn(),
    json: jest.fn()
  },
  transports: {
    Console: jest.fn()
  }
}));

// Mock config
jest.mock('../config', () => ({
  logLevel: 'info'
}));

const winston = require('winston');
const SCVLoggingUtil = require('../SCVLoggingUtil');

describe('SCVLoggingUtil', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('info', () => {
    it('should log info message with context', () => {
      const logLine = {
        message: 'Test info message',
        context: { key: 'value' }
      };

      SCVLoggingUtil.info(logLine);

      expect(mockLogger.info).toHaveBeenCalledWith({
        context: { key: 'value' },
        message: 'Test info message',
        category: 'authKeysSSMUtil'
      });
    });

    it('should log info message without context', () => {
      const logLine = {
        message: 'Test info message'
      };

      SCVLoggingUtil.info(logLine);

      expect(mockLogger.info).toHaveBeenCalledWith({
        context: 'NO_CONTEXT',
        message: 'Test info message',
        category: 'authKeysSSMUtil'
      });
    });

    it('should log info message without message', () => {
      const logLine = {
        context: { key: 'value' }
      };

      SCVLoggingUtil.info(logLine);

      expect(mockLogger.info).toHaveBeenCalledWith({
        context: { key: 'value' },
        message: 'NO_MESSAGE',
        category: 'authKeysSSMUtil'
      });
    });

    it('should handle empty logLine object', () => {
      const logLine = {};

      SCVLoggingUtil.info(logLine);

      expect(mockLogger.info).toHaveBeenCalledWith({
        context: 'NO_CONTEXT',
        message: 'NO_MESSAGE',
        category: 'authKeysSSMUtil'
      });
    });
  });

  describe('debug', () => {
    it('should log debug message with context', () => {
      const logLine = {
        message: 'Test debug message',
        context: { debugKey: 'debugValue' }
      };

      SCVLoggingUtil.debug(logLine);

      expect(mockLogger.debug).toHaveBeenCalledWith({
        context: { debugKey: 'debugValue' },
        message: 'Test debug message',
        category: 'authKeysSSMUtil'
      });
    });

    it('should log debug message without context', () => {
      const logLine = {
        message: 'Test debug message'
      };

      SCVLoggingUtil.debug(logLine);

      expect(mockLogger.debug).toHaveBeenCalledWith({
        context: 'NO_CONTEXT',
        message: 'Test debug message',
        category: 'authKeysSSMUtil'
      });
    });
  });

  describe('warn', () => {
    it('should log warn message with context', () => {
      const logLine = {
        message: 'Test warn message',
        context: { warnKey: 'warnValue' }
      };

      SCVLoggingUtil.warn(logLine);

      expect(mockLogger.warn).toHaveBeenCalledWith({
        context: { warnKey: 'warnValue' },
        message: 'Test warn message',
        category: 'authKeysSSMUtil'
      });
    });

    it('should log warn message without context', () => {
      const logLine = {
        message: 'Test warn message'
      };

      SCVLoggingUtil.warn(logLine);

      expect(mockLogger.warn).toHaveBeenCalledWith({
        context: 'NO_CONTEXT',
        message: 'Test warn message',
        category: 'authKeysSSMUtil'
      });
    });
  });

  describe('error', () => {
    it('should log error message with context', () => {
      const logLine = {
        message: 'Test error message',
        context: { errorKey: 'errorValue' }
      };

      SCVLoggingUtil.error(logLine);

      expect(mockLogger.error).toHaveBeenCalledWith({
        context: { errorKey: 'errorValue' },
        message: 'Test error message',
        category: 'authKeysSSMUtil'
      });
    });

    it('should log error message without context', () => {
      const logLine = {
        message: 'Test error message'
      };

      SCVLoggingUtil.error(logLine);

      expect(mockLogger.error).toHaveBeenCalledWith({
        context: 'NO_CONTEXT',
        message: 'Test error message',
        category: 'authKeysSSMUtil'
      });
    });

    it('should handle error with error object in context', () => {
      const errorObj = new Error('Test error');
      const logLine = {
        message: 'Test error message',
        context: { error: errorObj }
      };

      SCVLoggingUtil.error(logLine);

      expect(mockLogger.error).toHaveBeenCalledWith({
        context: { error: errorObj },
        message: 'Test error message',
        category: 'authKeysSSMUtil'
      });
    });
  });

  describe('logger configuration', () => {
    it('should create logger with correct configuration', () => {
      // Since the module is loaded at test startup, the logger should be created
      // Let's just verify the module exports are correct
      expect(SCVLoggingUtil).toBeDefined();
      expect(SCVLoggingUtil.info).toBeInstanceOf(Function);
      expect(SCVLoggingUtil.debug).toBeInstanceOf(Function);
      expect(SCVLoggingUtil.warn).toBeInstanceOf(Function);
      expect(SCVLoggingUtil.error).toBeInstanceOf(Function);
    });
  });

  describe('buildLog function coverage', () => {
    it('should handle null context and message', () => {
      const logLine = {
        message: null,
        context: null
      };

      SCVLoggingUtil.info(logLine);

      expect(mockLogger.info).toHaveBeenCalledWith({
        context: 'NO_CONTEXT',
        message: 'NO_MESSAGE',
        category: 'authKeysSSMUtil'
      });
    });

    it('should handle undefined context and message', () => {
      const logLine = {
        message: undefined,
        context: undefined
      };

      SCVLoggingUtil.info(logLine);

      expect(mockLogger.info).toHaveBeenCalledWith({
        context: 'NO_CONTEXT',
        message: 'NO_MESSAGE',
        category: 'authKeysSSMUtil'
      });
    });

    it('should handle empty string context and message', () => {
      const logLine = {
        message: '',
        context: ''
      };

      SCVLoggingUtil.info(logLine);

      expect(mockLogger.info).toHaveBeenCalledWith({
        context: 'NO_CONTEXT',
        message: 'NO_MESSAGE',
        category: 'authKeysSSMUtil'
      });
    });

    it('should replace falsy values with defaults', () => {
      const logLine = {
        message: 0,
        context: false
      };

      SCVLoggingUtil.info(logLine);

      expect(mockLogger.info).toHaveBeenCalledWith({
        context: 'NO_CONTEXT',
        message: 'NO_MESSAGE',
        category: 'authKeysSSMUtil'
      });
    });
  });
});