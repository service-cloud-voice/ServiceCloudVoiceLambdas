const mockGetSecretValue = jest.fn();

jest.mock("aws-sdk", () => ({
  SecretsManager: jest.fn().mockImplementation(() => ({
    getSecretValue: mockGetSecretValue
  }))
}));

const secretUtils = require("../secretUtils");

jest.mock("../SCVLoggingUtil");
const SCVLoggingUtil = require("../SCVLoggingUtil");

jest.mock("../config");
const config = require("../config");

const AWS = require("aws-sdk");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("secretUtils", () => {
  describe("getSecretConfigs", () => {
    it("should retrieve and parse secret configuration", async () => {
      const mockSecretData = {
        SALESFORCE_ORG_ID: "test-org-id",
        SCRT_ENDPOINT_BASE: "https://test-endpoint.com",
        CALL_CENTER_API_NAME: "test-call-center",
        "test-call-center-scrt-jwt-auth-private-key": "test-private-key",
      };

      mockGetSecretValue.mockReturnValue({
        promise: () => Promise.resolve({
          SecretString: JSON.stringify(mockSecretData),
        }),
      });

      config.audience = "test-audience";
      config.tokenValidFor = "10m";

      const result = await secretUtils.getSecretConfigs("test-secret-name");

      expect(mockGetSecretValue).toHaveBeenCalledWith({
        SecretId: "test-secret-name",
      });

      expect(result).toEqual({
        audience: "test-audience",
        orgId: "test-org-id",
        scrtEndpointBase: "https://test-endpoint.com",
        callCenterApiName: "test-call-center",
        privateKey: "test-private-key",
        tokenValidFor: "10m",
      });
    });

    it("should throw error when secret name is not provided", async () => {
      await expect(secretUtils.getSecretConfigs(null)).rejects.toThrow(
        "Secret name is required"
      );
    });

    it("should handle AWS Secrets Manager errors", async () => {
      mockGetSecretValue.mockReturnValue({
        promise: () => Promise.reject(new Error("AWS Error")),
      });

      await expect(secretUtils.getSecretConfigs("test-secret-name")).rejects.toThrow(
        "AWS Error"
      );

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: "Error reading secret from AWS Secrets Manager",
        context: { secretName: "test-secret-name", error: "AWS Error" },
      });
    });
  });
});