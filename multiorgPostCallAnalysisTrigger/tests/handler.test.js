const handler = require("../handler");

// Mock all external dependencies
jest.mock("../telephonyIntegrationApi");
const api = require("../telephonyIntegrationApi");

jest.mock("../cacheUtils", () => ({
  retrieveFromCache: jest.fn(),
}));
const cacheUtils = require("../cacheUtils");

jest.mock("../secretUtils", () => ({
  getSecretConfigs: jest.fn(),
}));
const secretUtils = require("../secretUtils");

jest.mock("../utils", () => ({
  sliceIntoChunks: jest.fn().mockReturnValue([["mock-signal"]]),
  sentimentNormalizer: jest.fn().mockReturnValue(1000),
  validateS3KeyName: jest.fn().mockReturnValue(true),
  getAgentTimestamp: jest.fn().mockResolvedValue({
    Contact: {
      Id: "test-contact",
      AgentInfo: { ConnectedToAgentTimestamp: "2022-03-31T00:03:57.439Z" },
      DisconnectTimestamp: "2022-03-31T00:06:48.667Z",
    },
  }),
}));
const utils = require("../utils");

jest.mock("aws-sdk", () => ({
  S3: function () {
    return {
      getObject: jest.fn(() => ({
        promise: jest.fn().mockResolvedValue({
          Body: JSON.stringify({
            Version: "1.1.0",
            JobStatus: "COMPLETED",
            ConversationCharacteristics: {
              Sentiment: {
                OverallSentiment: { AGENT: 0, CUSTOMER: 0.8 },
                SentimentByPeriod: {
                  QUARTER: {
                    AGENT: [
                      {
                        BeginOffsetMillis: 0,
                        EndOffsetMillis: 21681,
                        Score: 0,
                      },
                    ],
                    CUSTOMER: [
                      {
                        BeginOffsetMillis: 0,
                        EndOffsetMillis: 20983,
                        Score: 1.3,
                      },
                    ],
                  },
                },
              },
              TalkTime: {
                TotalTimeMillis: 12521,
                DetailsByParticipant: {
                  AGENT: { TotalTimeMillis: 8282 },
                  CUSTOMER: { TotalTimeMillis: 4239 },
                },
              },
            },
            CustomerMetadata: {
              ContactId: "7c77422d-f9ba-4111-ad48-b2f5dadf854a",
              InstanceId: "test-instance-id",
            },
          }),
        }),
      })),
    };
  },
}));

describe("Post Call Analysis Trigger Lambda handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    cacheUtils.retrieveFromCache.mockResolvedValue({
      secretName: "test-secret-name",
    });
    secretUtils.getSecretConfigs.mockResolvedValue({
      orgId: "test-org",
      scrtEndpointBase: "https://test.salesforce.com",
      privateKey: "test-private-key",
    });
    api.persistSignals.mockResolvedValue({ result: "Success" });
  });

  const validEvent = {
    version: "0",
    id: "test-id",
    detailType: "Object Created",
    source: "aws.s3",
    account: "694266641768",
    time: "2022-07-13T21:19:49Z",
    region: "ap-southeast-1",
    resources: ["arn:aws:s3:::test-bucket"],
    detail: {
      version: "0",
      bucket: { name: "test-bucket" },
      object: {
        key: "Analysis/Voice/2022/03/30/test-contact-id_analysis.json",
        size: 1154,
        etag: "test-etag",
        versionId: "test-version",
        sequencer: "test-sequencer",
      },
      requestId: "test-request-id",
      requester: "694266641768",
      sourceIpAddress: "204.14.236.152",
      reason: "PutObject",
    },
  };

  it("successfully processes valid event", async () => {
    const result = await handler.handler(validEvent);

    expect(cacheUtils.retrieveFromCache).toHaveBeenCalledWith(
      "7c77422d-f9ba-4111-ad48-b2f5dadf854a"
    );
    expect(secretUtils.getSecretConfigs).toHaveBeenCalledWith(
      "test-secret-name"
    );
    expect(api.persistSignals).toHaveBeenCalled();
    expect(result).toEqual({ result: "Success" });
  });

  it("handles cache retrieval failure", async () => {
    cacheUtils.retrieveFromCache.mockRejectedValue(new Error("Cache error"));

    await expect(handler.handler(validEvent)).rejects.toThrow("Cache error");
    expect(api.persistSignals).not.toHaveBeenCalled();
  });

  it("handles missing secret name in cache", async () => {
    cacheUtils.retrieveFromCache.mockResolvedValue({});

    await expect(handler.handler(validEvent)).rejects.toThrow(
      "Secret configuration is required but not available"
    );
    expect(api.persistSignals).not.toHaveBeenCalled();
  });

  it("validates S3 key format", async () => {
    utils.validateS3KeyName.mockReturnValue(false);

    const result = await handler.handler(validEvent);
    expect(result).toBe(null);
  });
});