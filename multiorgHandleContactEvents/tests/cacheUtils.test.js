// Set environment variable before any imports to ensure it's available
process.env.SECRET_CACHE_S3 = "test-bucket/cache-dir";

const mockS3 = {
  getObject: jest.fn(),
  putObject: jest.fn(),
};

jest.mock("aws-sdk", () => ({
  S3: jest.fn(() => mockS3),
}));

// Mock SCVLoggingUtil
jest.mock("../SCVLoggingUtil", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
}));

// Mock config to provide S3 bucket info
jest.mock("../config", () => ({
  secretCacheS3: "test-bucket/cache-dir",
}));

const cacheUtils = require("../cacheUtils");
const SCVLoggingUtil = require("../SCVLoggingUtil");

describe("cacheUtils", () => {
  const contactId = "test-contact-123";

  beforeEach(() => {
    jest.clearAllMocks();
    mockS3.getObject.mockClear();
    mockS3.putObject.mockClear();
  });

  describe('retrieveFromCache', () => {
    it('should successfully retrieve cache data from S3', async () => {
      const mockCacheData = { secretName: 'test-secret', timestamp: '2023-01-01T00:00:00Z' };
      mockS3.getObject.mockReturnValue({
        promise: () => Promise.resolve({
          Body: Buffer.from(JSON.stringify(mockCacheData)),
        }),
      });

      const result = await cacheUtils.retrieveFromCache(contactId);

      expect(mockS3.getObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'cache-dir/test-contact-123',
      });
      expect(result).toEqual(mockCacheData);
    });

    it('should return null for invalid contactId (null)', async () => {
      const result = await cacheUtils.retrieveFromCache(null);

      expect(result).toBeNull();
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Invalid contactId provided to retrieveFromCache',
        context: { contactId: null },
      });
      // S3 should not be called for invalid contactId
      expect(mockS3.getObject).not.toHaveBeenCalled();
    });

    it('should return null for invalid contactId (empty string)', async () => {
      const result = await cacheUtils.retrieveFromCache('');

      expect(result).toBeNull();
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Invalid contactId provided to retrieveFromCache',
        context: { contactId: '' },
      });
      // S3 should not be called for invalid contactId
      expect(mockS3.getObject).not.toHaveBeenCalled();
    });

    it('should return null for invalid contactId (non-string)', async () => {
      const result = await cacheUtils.retrieveFromCache(123);

      expect(result).toBeNull();
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Invalid contactId provided to retrieveFromCache',
        context: { contactId: 123 },
      });
      // S3 should not be called for invalid contactId
      expect(mockS3.getObject).not.toHaveBeenCalled();
    });

    it('should return null when cache not found (NoSuchKey)', async () => {
      const error = new Error('Not found');
      error.code = 'NoSuchKey';

      mockS3.getObject.mockReturnValue({
        promise: () => Promise.reject(error),
      });

      const result = await cacheUtils.retrieveFromCache(contactId);

      expect(result).toBeNull();
      expect(SCVLoggingUtil.warn).toHaveBeenCalledWith({
        message: `Secret cache not found in S3 for contactId: ${contactId}`,
        context: { bucket: 'test-bucket', key: 'cache-dir/test-contact-123' },
      });
    });

    it('should return null when cache not found (NotFound)', async () => {
      const error = new Error('Not found');
      error.code = 'NotFound';

      mockS3.getObject.mockReturnValue({
        promise: () => Promise.reject(error),
      });

      const result = await cacheUtils.retrieveFromCache(contactId);

      expect(result).toBeNull();
      expect(SCVLoggingUtil.warn).toHaveBeenCalledWith({
        message: `Secret cache not found in S3 for contactId: ${contactId}`,
        context: { bucket: 'test-bucket', key: 'cache-dir/test-contact-123' },
      });
    });

    it('should handle S3 errors and return null', async () => {
      const error = new Error('S3 Error');
      error.code = 'AccessDenied';

      mockS3.getObject.mockReturnValue({
        promise: () => Promise.reject(error),
      });

      const result = await cacheUtils.retrieveFromCache(contactId);

      expect(result).toBeNull();
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: `Error reading secret cache from S3 for contactId: ${contactId}`,
        context: { bucket: 'test-bucket', key: 'cache-dir/test-contact-123', error: 'S3 Error', errorCode: 'AccessDenied' },
      });
    });

    it('should handle invalid JSON in cache', async () => {
      mockS3.getObject.mockReturnValue({
        promise: () => Promise.resolve({
          Body: Buffer.from('invalid json'),
        }),
      });

      const result = await cacheUtils.retrieveFromCache(contactId);

      expect(result).toBeNull();
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: expect.stringContaining(`Error reading secret cache from S3 for contactId: ${contactId}`),
        context: expect.objectContaining({ bucket: 'test-bucket', key: 'cache-dir/test-contact-123' }),
      });
    });

    it('should work with bucket only (no directory)', async () => {
      // Reset modules to clear cache
      jest.resetModules();

      // Re-mock everything
      jest.doMock('aws-sdk', () => ({
        S3: jest.fn(() => mockS3),
      }));

      jest.doMock('../SCVLoggingUtil', () => ({
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
      }));

      // Override config for this test
      jest.doMock('../config', () => ({
        secretCacheS3: 'test-bucket-only',
      }));

      // Re-require the modules
      const cacheUtilsWithoutDir = require('../cacheUtils');
      const SCVLoggingUtilBucketOnly = require('../SCVLoggingUtil');

      const mockCacheData = { secretName: 'test-secret' };
      mockS3.getObject.mockReturnValue({
        promise: () => Promise.resolve({
          Body: Buffer.from(JSON.stringify(mockCacheData)),
        }),
      });

      const result = await cacheUtilsWithoutDir.retrieveFromCache(contactId);

      expect(mockS3.getObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket-only',
        Key: 'test-contact-123',
      });
      expect(result).toEqual(mockCacheData);
    });
  });

  describe('retrieveFromCache - environment variable missing', () => {
    it('should return null when SECRET_CACHE_S3 is not set', async () => {
      // Reset modules to clear cache
      jest.resetModules();

      // Re-mock everything
      jest.doMock('aws-sdk', () => ({
        S3: jest.fn(() => mockS3),
      }));

      jest.doMock('../SCVLoggingUtil', () => ({
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
      }));

      // Mock config with missing SECRET_CACHE_S3
      jest.doMock('../config', () => ({
        secretCacheS3: null,
      }));

      // Re-require the modules
      const cacheUtilsNoEnv = require('../cacheUtils');
      const SCVLoggingUtilNoEnv = require('../SCVLoggingUtil');

      const result = await cacheUtilsNoEnv.retrieveFromCache(contactId);

      expect(result).toBeNull();
      expect(SCVLoggingUtilNoEnv.error).toHaveBeenCalledWith({
        message: 'SECRET_CACHE_S3 environment variable is not set',
        context: { contactId },
      });
    });
  });

  describe('storeInCache', () => {
    const mockCacheData = {
      secretName: 'test-secret-name',
      timestamp: '2023-01-01T00:00:00Z',
      orgId: 'test-org-123'
    };

    it('should successfully store cache data in S3', async () => {
      mockS3.putObject.mockReturnValue({
        promise: () => Promise.resolve({}),
      });

      const result = await cacheUtils.storeInCache(contactId, mockCacheData);

      expect(mockS3.putObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'cache-dir/test-contact-123',
        Body: JSON.stringify(mockCacheData),
        ContentType: 'application/json',
      });
      expect(result).toBe(true);
      expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
        message: `Secret cache stored successfully for contactId: ${contactId}`,
        context: { bucket: 'test-bucket', key: 'cache-dir/test-contact-123' },
      });
    });

    it('should return false when SECRET_CACHE_S3 is not set', async () => {
      // Reset modules to clear cache
      jest.resetModules();

      // Re-mock everything
      jest.doMock('aws-sdk', () => ({
        S3: jest.fn(() => mockS3),
      }));

      jest.doMock('../SCVLoggingUtil', () => ({
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
      }));

      // Mock config with missing SECRET_CACHE_S3
      jest.doMock('../config', () => ({
        secretCacheS3: null,
      }));

      // Re-require the modules
      const cacheUtilsNoEnv = require('../cacheUtils');
      const SCVLoggingUtilNoEnv = require('../SCVLoggingUtil');

      const result = await cacheUtilsNoEnv.storeInCache(contactId, mockCacheData);

      expect(result).toBe(false);
      expect(SCVLoggingUtilNoEnv.error).toHaveBeenCalledWith({
        message: 'SECRET_CACHE_S3 environment variable is not set',
        context: { contactId },
      });
      expect(mockS3.putObject).not.toHaveBeenCalled();
    });

    it('should handle S3 putObject errors and return false', async () => {
      const error = new Error('S3 Put Error');
      error.code = 'AccessDenied';

      mockS3.putObject.mockReturnValue({
        promise: () => Promise.reject(error),
      });

      const result = await cacheUtils.storeInCache(contactId, mockCacheData);

      expect(result).toBe(false);
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: `Error storing secret cache in S3 for contactId: ${contactId}. Error: ${error}`,
        context: { bucket: 'test-bucket', key: 'cache-dir/test-contact-123', error },
      });
    });

    it('should work with bucket only (no directory)', async () => {
      // Reset modules to clear cache
      jest.resetModules();

      // Re-mock everything
      jest.doMock('aws-sdk', () => ({
        S3: jest.fn(() => mockS3),
      }));

      jest.doMock('../SCVLoggingUtil', () => ({
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
      }));

      // Override config for this test
      jest.doMock('../config', () => ({
        secretCacheS3: 'test-bucket-only',
      }));

      // Re-require the modules
      const cacheUtilsWithoutDir = require('../cacheUtils');
      const SCVLoggingUtilBucketOnly = require('../SCVLoggingUtil');

      mockS3.putObject.mockReturnValue({
        promise: () => Promise.resolve({}),
      });

      const result = await cacheUtilsWithoutDir.storeInCache(contactId, mockCacheData);

      expect(mockS3.putObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket-only',
        Key: 'test-contact-123',
        Body: JSON.stringify(mockCacheData),
        ContentType: 'application/json',
      });
      expect(result).toBe(true);
    });

    it('should handle complex cache data structures', async () => {
      const complexCacheData = {
        secretName: 'complex-secret',
        metadata: {
          region: 'us-west-2',
          version: '1.2.3',
          nested: {
            property: 'value',
            array: [1, 2, 3],
          },
        },
        timestamp: new Date().toISOString(),
        flags: {
          enabled: true,
          debug: false,
        },
      };

      mockS3.putObject.mockReturnValue({
        promise: () => Promise.resolve({}),
      });

      const result = await cacheUtils.storeInCache(contactId, complexCacheData);

      expect(mockS3.putObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'cache-dir/test-contact-123',
        Body: JSON.stringify(complexCacheData),
        ContentType: 'application/json',
      });
      expect(result).toBe(true);
    });

    it('should handle empty cache data', async () => {
      const emptyCacheData = {};

      mockS3.putObject.mockReturnValue({
        promise: () => Promise.resolve({}),
      });

      const result = await cacheUtils.storeInCache(contactId, emptyCacheData);

      expect(mockS3.putObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'cache-dir/test-contact-123',
        Body: JSON.stringify(emptyCacheData),
        ContentType: 'application/json',
      });
      expect(result).toBe(true);
    });

    it('should handle null cache data', async () => {
      mockS3.putObject.mockReturnValue({
        promise: () => Promise.resolve({}),
      });

      const result = await cacheUtils.storeInCache(contactId, null);

      expect(mockS3.putObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'cache-dir/test-contact-123',
        Body: 'null',
        ContentType: 'application/json',
      });
      expect(result).toBe(true);
    });
  });
});