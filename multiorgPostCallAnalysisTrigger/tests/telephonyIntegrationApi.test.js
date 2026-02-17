const telephonyIntegrationApi = require("../telephonyIntegrationApi");

jest.mock("../SCVLoggingUtil", () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

jest.mock("../config", () => ({
  tokenValidFor: "15m",
}));

jest.mock("../utils", () => ({
  generateJWT: jest.fn(),
}));

jest.mock("../axiosWrapper", () => ({
  getScrtEndpoint: jest.fn(),
}));

const SCVLoggingUtil = require("../SCVLoggingUtil");
const utils = require("../utils");
const axiosWrapper = require("../axiosWrapper");

describe("telephonyIntegrationApi", () => {
  let mockAxiosInstance;
  let mockSecretConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAxiosInstance = {
      post: jest.fn(),
    };

    mockSecretConfig = {
      orgId: "test-org-id",
      callCenterApiName: "test-call-center",
      privateKey: "test-private-key",
      scrtEndpointBase: "https://test.salesforce.com",
      tokenValidFor: "30m",
    };

    axiosWrapper.getScrtEndpoint.mockReturnValue(mockAxiosInstance);
    utils.generateJWT.mockResolvedValue("mock-jwt-token");
  });

  describe("persistSignals", () => {
    it("should successfully persist signals", async () => {
      const contactId = "test-contact-id";
      const payload = { test: "payload" };
      const mockResponse = { status: 200 };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await telephonyIntegrationApi.persistSignals(
        contactId,
        payload,
        mockSecretConfig
      );

      expect(axiosWrapper.getScrtEndpoint).toHaveBeenCalledWith(
        mockSecretConfig
      );
      expect(utils.generateJWT).toHaveBeenCalled();
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/voiceCalls/${contactId}/postConversationEvents`,
        payload,
        {
          headers: {
            Authorization: "Bearer mock-jwt-token",
            "Content-Type": "application/json",
            "Telephony-Provider-Name": "amazon-connect",
          },
        }
      );

      expect(SCVLoggingUtil.info).toHaveBeenCalledTimes(2);
    });

    it("should handle API errors", async () => {
      const contactId = "test-contact-id";
      const payload = { test: "payload" };
      const error = new Error("API error");

      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(
        telephonyIntegrationApi.persistSignals(
          contactId,
          payload,
          mockSecretConfig
        )
      ).rejects.toThrow("API error");

      expect(SCVLoggingUtil.error).toHaveBeenCalled();
    });
  });
});