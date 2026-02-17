const mockSecretsManager = {
  getSecretValue: jest.fn()
};

jest.mock("aws-sdk", () => ({
  SecretsManager: jest.fn(() => mockSecretsManager)
}));

jest.mock("../SCVLoggingUtil");
const SCVLoggingUtil = require("../SCVLoggingUtil");

const secretUtils = require("../secretUtils");

describe("secretUtils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getSecretConfigs", () => {
    it("should successfully build config from secret data", async () => {
      const secretName = "config-secret";
      const mockSecretData = {
        SALESFORCE_ORG_ID: "test-org-id",
        SCRT_ENDPOINT_BASE: "https://test-scrt.com",
        CALL_CENTER_API_NAME: "test-api",
        "test-api-scrt-jwt-auth-private-key": "test-private-key"
      };

      mockSecretsManager.getSecretValue.mockReturnValue({
        promise: () => Promise.resolve({
          SecretString: JSON.stringify(mockSecretData)
        })
      });

      const result = await secretUtils.getSecretConfigs(secretName);

      expect(result).toEqual({
        salesforceOrgId: "test-org-id",
        scrtEndpointBase: "https://test-scrt.com",
        callCenterApiName: "test-api",
        privateKey: "test-private-key"
      });
    });

    it("should handle errors when getting secret configs", async () => {
      const secretName = "config-secret";
      const error = new Error("Access denied");

      mockSecretsManager.getSecretValue.mockReturnValue({
        promise: () => Promise.reject(error)
      });

      await expect(secretUtils.getSecretConfigs(secretName)).rejects.toThrow("Access denied");
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: "Error getting secret configuration",
        context: { secretName, error: error.message }
      });
    });

    it("should throw error for missing required values", async () => {
      const secretName = "config-secret";
      const mockSecretData = {
        SALESFORCE_ORG_ID: "test-org-id"
        // Missing required values
      };

      mockSecretsManager.getSecretValue.mockReturnValue({
        promise: () => Promise.resolve({
          SecretString: JSON.stringify(mockSecretData)
        })
      });

      await expect(secretUtils.getSecretConfigs(secretName)).rejects.toThrow("Missing required secret configuration values");
    });
  });
});