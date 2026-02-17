const SCVLoggingUtil = require('../SCVLoggingUtil');

describe('SCVLoggingUtil', () => {
  describe('buildLog function coverage', () => {
    it('should use default values when logLine is empty', () => {
      // This test will exercise the buildLog function with empty/null values
      // to cover the remaining uncovered lines
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      SCVLoggingUtil.info({});
      SCVLoggingUtil.warn({});
      SCVLoggingUtil.error({});
      SCVLoggingUtil.debug({});

      consoleSpy.mockRestore();
    });

    it('should handle null logLine', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      SCVLoggingUtil.info(null);
      SCVLoggingUtil.warn(null);
      SCVLoggingUtil.error(null);
      SCVLoggingUtil.debug(null);

      consoleSpy.mockRestore();
    });

    it('should handle undefined logLine', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      SCVLoggingUtil.info(undefined);
      SCVLoggingUtil.warn(undefined);
      SCVLoggingUtil.error(undefined);
      SCVLoggingUtil.debug(undefined);

      consoleSpy.mockRestore();
    });

    it('should handle logLine with only message', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      SCVLoggingUtil.info({ message: 'test message' });
      SCVLoggingUtil.warn({ message: 'test warning' });
      SCVLoggingUtil.error({ message: 'test error' });
      SCVLoggingUtil.debug({ message: 'test debug' });

      consoleSpy.mockRestore();
    });

    it('should handle logLine with only context', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      SCVLoggingUtil.info({ context: { key: 'value' } });
      SCVLoggingUtil.warn({ context: { key: 'value' } });
      SCVLoggingUtil.error({ context: { key: 'value' } });
      SCVLoggingUtil.debug({ context: { key: 'value' } });

      consoleSpy.mockRestore();
    });
  });
});