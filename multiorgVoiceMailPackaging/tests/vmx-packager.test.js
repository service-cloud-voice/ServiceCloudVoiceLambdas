const AWS = require("aws-sdk");

// Mock environment variables first
process.env.INVOKE_TELEPHONY_INTEGRATION_API_ARN =
  "arn:aws:lambda:us-east-1:123456789012:function:test-function";
process.env.DELAY_BEFORE_ROUTING_VM_SEC = "1";
process.env.LOG_LEVEL = "info";
process.env.SECRET_NAME = "test-secret";
process.env.SECRET_CACHE_S3 = "test-bucket/secret_cache";

// Mock AWS services
const mockLambdaInvoke = jest.fn();
const mockS3GetObjectTagging = jest.fn();
const mockS3GetObject = jest.fn();
const mockTranscribeDeleteJob = jest.fn();

jest.mock("aws-sdk", () => ({
  Lambda: jest.fn(() => ({
    invoke: mockLambdaInvoke,
  })),
  S3: jest.fn(() => ({
    getObjectTagging: mockS3GetObjectTagging,
    getObject: mockS3GetObject,
  })),
  TranscribeService: jest.fn(() => ({
    deleteTranscriptionJob: mockTranscribeDeleteJob,
  })),
}));

// Mock SCVLoggingUtil
jest.mock("../SCVLoggingUtil", () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// Mock cacheUtils
jest.mock("../cacheUtils", () => ({
  retrieveFromCache: jest.fn(),
}));

const handler = require("../handler");
const cacheUtils = require("../cacheUtils");

describe("VoiceMailPackaging Tests", () => {
  const mockEvent = {
    detail: {
      bucket: { name: "test-bucket" },
      object: { key: "voicemail_transcripts/test-contact-123.json" },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockLambdaInvoke.mockReturnValue({
      promise: jest.fn().mockResolvedValue({ StatusCode: 200 }),
    });

    mockS3GetObjectTagging.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        TagSet: [
          { Key: "vm_recordingUrl", Value: "https://example.com/recording.wav" },
          { Key: "vm_duration", Value: "30" },
          { Key: "vm_initTimestamp", Value: "1234567890" },
          { Key: "vm_endTimestamp", Value: "1234567920" },
          { Key: "vm_dialedNumber", Value: "+1234567890" },
        ],
      }),
    });

    mockS3GetObject.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Body: Buffer.from(JSON.stringify({
          results: {
            transcripts: [{
              transcript: "Test voicemail transcript",
            }],
          },
        })),
      }),
    });

    mockTranscribeDeleteJob.mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    });

    cacheUtils.retrieveFromCache.mockResolvedValue({ secretName: "test-secret" });
  });

  describe("Handler function", () => {

    it("should process .json files successfully", async () => {
      const result = await handler.handler(mockEvent);

      expect(result).toHaveLength(5); // VM creation, sendMessage, routing, close VM, transcription deletion
      expect(mockS3GetObjectTagging).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: "voicemail_recordings/test-contact-123.wav",
      });
      expect(mockS3GetObject).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: "voicemail_transcripts/test-contact-123.json",
      });
      expect(mockLambdaInvoke).toHaveBeenCalledTimes(4); // updateVoiceCall (create), sendMessage, executeOmniFlow, updateVoiceCall (close)
      expect(mockTranscribeDeleteJob).toHaveBeenCalledWith({
        TranscriptionJobName: "test-contact-123",
      });
    });

    it("should skip non-.json files", async () => {
      const nonJsonEvent = {
        detail: {
          bucket: { name: "test-bucket" },
          object: { key: "voicemail_transcripts/test-contact-123.wav" },
        },
      };

      const result = await handler.handler(nonJsonEvent);

      expect(result).toEqual({ success: true });
      expect(mockS3GetObjectTagging).not.toHaveBeenCalled();
    });

    it("should handle S3 getObjectTagging errors", async () => {
      mockS3GetObjectTagging.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error("S3 TagSet Error")),
      });

      await expect(handler.handler(mockEvent)).rejects.toThrow("S3 TagSet Error");
    });

    it("should handle S3 getObject errors", async () => {
      mockS3GetObject.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error("S3 GetObject Error")),
      });

      await expect(handler.handler(mockEvent)).rejects.toThrow("S3 GetObject Error");
    });

    it("should handle JSON parsing errors", async () => {
      mockS3GetObject.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Body: Buffer.from("invalid json"),
        }),
      });

      await expect(handler.handler(mockEvent)).rejects.toThrow();
    });

    it("should retry executeOmniFlow on function errors", async () => {
      mockLambdaInvoke
        .mockReturnValueOnce({
          promise: jest.fn().mockResolvedValue({ StatusCode: 200 }),
        })
        .mockReturnValueOnce({
          promise: jest.fn().mockResolvedValue({ StatusCode: 200 }),
        })
        .mockReturnValueOnce({
          promise: jest.fn().mockResolvedValue({ FunctionError: "Unhandled" }),
        })
        .mockReturnValueOnce({
          promise: jest.fn().mockResolvedValue({ StatusCode: 200 }),
        })
        .mockReturnValueOnce({
          promise: jest.fn().mockResolvedValue({ StatusCode: 200 }),
        });

      const result = await handler.handler(mockEvent);

      expect(result).toHaveLength(5); // VM creation, sendMessage, retry routing, close VM, transcription deletion
      expect(mockLambdaInvoke).toHaveBeenCalledTimes(5);
    });

    it("should reach max retry attempts for executeOmniFlow", async () => {
      mockLambdaInvoke
        .mockReturnValueOnce({
          promise: jest.fn().mockResolvedValue({ StatusCode: 200 }),
        })
        .mockReturnValueOnce({
          promise: jest.fn().mockResolvedValue({ StatusCode: 200 }),
        });

      for (let i = 0; i < 4; i++) {
        mockLambdaInvoke.mockReturnValueOnce({
          promise: jest.fn().mockResolvedValue({ FunctionError: "Unhandled" }),
        });
      }

      mockLambdaInvoke.mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({ StatusCode: 200 }),
      });

      const result = await handler.handler(mockEvent);

      expect(result).toHaveLength(5); // VM creation, sendMessage, final failed routing, close VM, transcription deletion
      expect(mockLambdaInvoke).toHaveBeenCalledTimes(7);
    });

    it("should handle cache retrieval success", async () => {
      await handler.handler(mockEvent);

      expect(cacheUtils.retrieveFromCache).toHaveBeenCalledWith("test-contact-123");
      expect(mockLambdaInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          Payload: expect.stringContaining('"secretName":"test-secret"'),
        })
      );
    });

    it("should handle cache retrieval failure", async () => {
      cacheUtils.retrieveFromCache.mockRejectedValue(new Error("Cache error"));

      await handler.handler(mockEvent);

      expect(mockLambdaInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          Payload: expect.stringContaining('"secretName":null'),
        })
      );
    });

    it("should handle cache returning null", async () => {
      cacheUtils.retrieveFromCache.mockResolvedValue(null);

      await handler.handler(mockEvent);

      expect(mockLambdaInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          Payload: expect.stringContaining('"secretName":null'),
        })
      );
    });

    it("should handle cache returning data without secretName", async () => {
      cacheUtils.retrieveFromCache.mockResolvedValue({ otherField: "value" });

      await handler.handler(mockEvent);

      expect(mockLambdaInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          Payload: expect.stringContaining('"secretName":null'),
        })
      );
    });
  });


});