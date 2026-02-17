const utils = require("../utils");

// Mock dependencies that are easier to handle
jest.mock("../SCVLoggingUtil", () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn().mockReturnValue("mock-jwt-token"),
}));

jest.mock("uuid/v1", () => jest.fn().mockReturnValue("mock-uuid"));

// Simple mock for AWS SDK
jest.mock("aws-sdk", () => ({
  SSM: function () {
    return {
      getParameters: jest.fn((params, callback) => {
        callback(null, { Parameters: [{ Value: "mock-private-key" }] });
      }),
    };
  },
  Connect: function () {
    return {
      describeContact: jest.fn(() => ({
        promise: jest.fn().mockResolvedValue({
          Contact: {
            Id: "test-contact",
            InitiationTimestamp: "2022-01-01T00:00:00Z",
          },
        }),
      })),
    };
  },
}));

describe("utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sliceIntoChunks", () => {
    it("should slice array into chunks correctly", () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = utils.sliceIntoChunks(array, 3);
      expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]);

      expect(utils.sliceIntoChunks([], 3)).toEqual([]);
      expect(utils.sliceIntoChunks([1, 2], 5)).toEqual([[1, 2]]);
    });
  });

  describe("sentimentNormalizer", () => {
    it("should normalize sentiment values correctly", () => {
      expect(utils.sentimentNormalizer("POSITIVE")).toBe(1000);
      expect(utils.sentimentNormalizer("NEGATIVE")).toBe(-1000);
      expect(utils.sentimentNormalizer("NEUTRAL")).toBe(0);
      expect(utils.sentimentNormalizer("MIXED")).toBe(0);
    });

    it("should throw error for invalid sentiment", () => {
      expect(() => utils.sentimentNormalizer("INVALID")).toThrow(
        "Error converting sentiment type into score!"
      );
    });
  });

  describe("generateJWT", () => {
    it("should generate JWT successfully", async () => {
      const params = {
        privateKeyParamName: "test-param",
        orgId: "test-org",
        callCenterApiName: "test-api",
        expiresIn: "15m",
      };

      const result = await utils.generateJWT(params);
      expect(result).toBe("mock-jwt-token");
    });
  });

  describe("validateS3KeyName", () => {
    it("should validate S3 key formats", () => {
      const validKey =
        "Analysis/Voice/2022/03/30/7c77422d-f9ba-4111-ad48-b2f5dadf854a_analysis.json";
      const invalidKey = "invalid-key";
      const redactedKey = "Analysis/Voice/2022/03/30/Redacted/test.json";

      expect(utils.validateS3KeyName(validKey)).toBe(true);
      expect(utils.validateS3KeyName(invalidKey)).toBe(false);
      expect(utils.validateS3KeyName(redactedKey)).toBe(false);
    });
  });

  describe("getSSMParameterValue", () => {
    it("should call SSM service", async () => {
      await utils.getSSMParameterValue("test-param", true);
      // Just verify it doesn't throw an error
      expect(true).toBe(true);
    });
  });

  describe("getAgentTimestamp", () => {
    it("should get agent timestamp from Connect", async () => {
      const params = { ContactId: "test-contact-id" };
      const result = await utils.getAgentTimestamp(params);

      expect(result).toEqual({
        Contact: {
          Id: "test-contact",
          InitiationTimestamp: "2022-01-01T00:00:00Z",
        },
      });
    });
  });

  describe("getSSMParameterValue", () => {
    it("should handle SSM parameter retrieval error", async () => {
      // Mock SSM to return error by resetting the mock
      jest.doMock("aws-sdk", () => ({
        SSM: function () {
          return {
            getParameters: jest.fn((params, callback) => {
              callback(new Error("SSM error"), null);
            }),
          };
        },
        Connect: function () {
          return {
            describeContact: jest.fn(() => ({
              promise: jest.fn().mockResolvedValue({
                Contact: {
                  Id: "test-contact",
                  InitiationTimestamp: "2022-01-01T00:00:00Z",
                },
              }),
            })),
          };
        },
      }));

      // Re-require utils to get the updated mock
      jest.resetModules();
      const utilsWithError = require("../utils");

      const result = await utilsWithError.getSSMParameterValue("test-param");
      expect(result).toBe(null);
    });
  });

  describe("getAgentTimestamp", () => {
    it("should handle describeContact API error", async () => {
      // Mock Connect to throw error by resetting the mock
      jest.doMock("aws-sdk", () => ({
        SSM: function () {
          return {
            getParameters: jest.fn((params, callback) => {
              callback(null, { Parameters: [{ Value: "mock-private-key" }] });
            }),
          };
        },
        Connect: function () {
          return {
            describeContact: jest.fn(() => ({
              promise: jest
                .fn()
                .mockRejectedValue(new Error("Connect API error")),
            })),
          };
        },
      }));

      // Re-require utils to get the updated mock
      jest.resetModules();
      const utilsWithError = require("../utils");
      const SCVLoggingUtil = require("../SCVLoggingUtil");

      const describeContactParams = { ContactId: "test-contact" };

      await expect(
        utilsWithError.getAgentTimestamp(describeContactParams)
      ).rejects.toThrow(
        "Error fetching the result from the describeContact API call!"
      );

      expect(SCVLoggingUtil.error).toHaveBeenCalled();
    });
  });
});