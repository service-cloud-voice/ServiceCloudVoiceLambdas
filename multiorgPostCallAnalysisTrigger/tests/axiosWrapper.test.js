const axios = require("axios");
const axiosRetry = require("axios-retry");
const axiosWrapper = require("../axiosWrapper");

jest.mock("axios");
jest.mock("axios-retry");
jest.mock("../config", () => ({
  logLevel: "info",
}));
jest.mock("../SCVLoggingUtil", () => ({
  debug: jest.fn(),
}));

const mockedAxios = axios;
const mockedAxiosRetry = axiosRetry;

describe("axiosWrapper", () => {
  let mockInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    mockInstance = {
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };

    mockedAxios.create.mockReturnValue(mockInstance);
  });

  describe("getScrtEndpoint", () => {
    it("should create axios instance with correct baseURL", () => {
      const configData = {
        scrtEndpointBase: "https://test-scrt-endpoint.com",
      };

      const result = axiosWrapper.getScrtEndpoint(configData);

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: "https://test-scrt-endpoint.com",
      });
      expect(result).toBe(mockInstance);
    });

    it("should configure axios retry with correct options", () => {
      const configData = {
        scrtEndpointBase: "https://test-scrt-endpoint.com",
      };

      axiosWrapper.getScrtEndpoint(configData);

      expect(mockedAxiosRetry).toHaveBeenCalledWith(
        mockInstance,
        expect.objectContaining({
          retries: 3,
          shouldResetTimeout: true,
        })
      );
    });

    it("should test retry conditions for different error codes", () => {
      const configData = {
        scrtEndpointBase: "https://test-scrt-endpoint.com",
      };

      axiosWrapper.getScrtEndpoint(configData);

      // Get the retryCondition function from the mock call
      const retryConfig = mockedAxiosRetry.mock.calls[0][1];
      const retryCondition = retryConfig.retryCondition;

      // Test retry for 429 (rate limiting)
      expect(retryCondition({ response: { status: 429 } })).toBe(true);

      // Test retry for 500 (server error)
      expect(retryCondition({ response: { status: 500 } })).toBe(true);

      // Test no retry for 400 (client error)
      expect(retryCondition({ response: { status: 400 } })).toBe(false);
    });
  });
});