// Set environment variable before any imports to ensure it's available
process.env.SECRET_CACHE_S3 = "test-bucket/cache-dir";

const mockS3 = {
  getObject: jest.fn(),
  putObject: jest.fn(),
  listObjectsV2: jest.fn()
};

jest.mock("aws-sdk", () => ({
  S3: jest.fn(() => mockS3)
}));

jest.mock("../SCVLoggingUtil");
const SCVLoggingUtil = require("../SCVLoggingUtil");

const cacheUtils = require("../cacheUtils");

describe("cacheUtils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    delete process.env.SECRET_CACHE_S3;
  });

  describe("retrieveFromCache", () => {
    const contactId = "test-contact-123";

    it("should successfully retrieve cache from S3 with directory", async () => {
      const mockCacheData = {
        secretName: "test-secret",
        accessToken: "test-token",
        timestamp: "2023-01-01T00:00:00Z"
      };

      mockS3.getObject.mockReturnValue({
        promise: () => Promise.resolve({
          Body: Buffer.from(JSON.stringify(mockCacheData))
        })
      });

      const result = await cacheUtils.retrieveFromCache(contactId);

      expect(mockS3.getObject).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: "cache-dir/test-contact-123"
      });
      expect(result).toEqual(mockCacheData);
    });

    it("should return null when cache not found (NoSuchKey)", async () => {
      const error = new Error("Not found");
      error.code = "NoSuchKey";

      mockS3.getObject.mockReturnValue({
        promise: () => Promise.reject(error)
      });

      const result = await cacheUtils.retrieveFromCache(contactId);

      expect(result).toBeNull();
      expect(SCVLoggingUtil.warn).toHaveBeenCalledWith({
        message: `Secret cache not found in S3 for contactId: ${contactId}`,
        context: { bucket: "test-bucket", key: "cache-dir/test-contact-123" }
      });
    });

    it("should return null when cache not found (NotFound)", async () => {
      const error = new Error("Not found");
      error.code = "NotFound";

      mockS3.getObject.mockReturnValue({
        promise: () => Promise.reject(error)
      });

      const result = await cacheUtils.retrieveFromCache(contactId);

      expect(result).toBeNull();
      expect(SCVLoggingUtil.warn).toHaveBeenCalledWith({
        message: `Secret cache not found in S3 for contactId: ${contactId}`,
        context: { bucket: "test-bucket", key: "cache-dir/test-contact-123" }
      });
    });

    it("should handle S3 errors and return null", async () => {
      const error = new Error("S3 Error");
      error.code = "AccessDenied";

      mockS3.getObject.mockReturnValue({
        promise: () => Promise.reject(error)
      });

      const result = await cacheUtils.retrieveFromCache(contactId);

      expect(result).toBeNull();
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: `Error reading secret cache from S3 for contactId: ${contactId}. Error: ${error}`,
        context: { bucket: "test-bucket", key: "cache-dir/test-contact-123", error }
      });
    });

    it("should handle invalid JSON in cache", async () => {
      mockS3.getObject.mockReturnValue({
        promise: () => Promise.resolve({
          Body: Buffer.from("invalid json")
        })
      });

      const result = await cacheUtils.retrieveFromCache(contactId);

      expect(result).toBeNull();
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: expect.stringContaining(`Error reading secret cache from S3 for contactId: ${contactId}`),
        context: expect.objectContaining({ bucket: "test-bucket", key: "cache-dir/test-contact-123" })
      });
    });
  });

  describe("storeInCache", () => {
    const contactId = "test-contact-123";
    const cacheData = {
      secretName: "test-secret",
      accessToken: "test-token"
    };

    it("should successfully store cache in S3 with directory", async () => {
      mockS3.putObject.mockReturnValue({
        promise: () => Promise.resolve()
      });

      const result = await cacheUtils.storeInCache(contactId, cacheData);

      expect(mockS3.putObject).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: "cache-dir/test-contact-123",
        Body: JSON.stringify(cacheData),
        ContentType: "application/json"
      });
      expect(result).toBe(true);
      expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
        message: `Secret cache stored successfully for contactId: ${contactId}`,
        context: { bucket: "test-bucket", key: "cache-dir/test-contact-123" }
      });
    });

    it("should handle S3 errors and return false", async () => {
      const error = new Error("S3 Put Error");

      mockS3.putObject.mockReturnValue({
        promise: () => Promise.reject(error)
      });

      const result = await cacheUtils.storeInCache(contactId, cacheData);

      expect(result).toBe(false);
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: `Error storing secret cache in S3 for contactId: ${contactId}. Error: ${error}`,
        context: { bucket: "test-bucket", key: "cache-dir/test-contact-123", error }
      });
    });
  });
});
