const mockAxios = {
  create: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() }
  }
};

const mockLogger = {
  requestLogger: jest.fn(),
  responseLogger: jest.fn(),
  errorLogger: jest.fn()
};

jest.mock("axios", () => mockAxios);
jest.mock("axios-logger", () => mockLogger);

const axiosWrapper = require("../axiosWrapper");

describe("axiosWrapper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.LOG_LEVEL;

    // Reset axios instance mock
    mockAxios.create.mockReturnValue({
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    });
  });

  describe("getScrtEndpoint", () => {
    const mockConfigData = {
      scrtEndpointBase: "https://test-scrt-endpoint.com"
    };

    it("should create axios instance with correct baseURL", () => {
      const result = axiosWrapper.getScrtEndpoint(mockConfigData);

      expect(mockAxios.create).toHaveBeenCalledWith({
        baseURL: "https://test-scrt-endpoint.com"
      });
      expect(result).toBeDefined();
    });

    it("should not add logging interceptors when LOG_LEVEL is not debug", () => {
      const mockInstance = {
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };
      mockAxios.create.mockReturnValue(mockInstance);

      axiosWrapper.getScrtEndpoint(mockConfigData);

      expect(mockInstance.interceptors.request.use).not.toHaveBeenCalled();
      expect(mockInstance.interceptors.response.use).not.toHaveBeenCalled();
    });

    it("should add logging interceptors when LOG_LEVEL is debug", () => {
      process.env.LOG_LEVEL = "debug";

      const mockInstance = {
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };
      mockAxios.create.mockReturnValue(mockInstance);

      axiosWrapper.getScrtEndpoint(mockConfigData);

      expect(mockInstance.interceptors.request.use).toHaveBeenCalledWith(
        mockLogger.requestLogger,
        mockLogger.errorLogger
      );
      expect(mockInstance.interceptors.response.use).toHaveBeenCalledWith(
        mockLogger.responseLogger,
        mockLogger.errorLogger
      );
    });

    it("should handle different endpoint URLs", () => {
      const configWithDifferentUrl = {
        scrtEndpointBase: "https://production-api.salesforce.com"
      };

      axiosWrapper.getScrtEndpoint(configWithDifferentUrl);

      expect(mockAxios.create).toHaveBeenCalledWith({
        baseURL: "https://production-api.salesforce.com"
      });
    });

    it("should handle LOG_LEVEL case variations", () => {
      process.env.LOG_LEVEL = "DEBUG"; // uppercase

      const mockInstance = {
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };
      mockAxios.create.mockReturnValue(mockInstance);

      axiosWrapper.getScrtEndpoint(mockConfigData);

      // Should not add interceptors because it's case-sensitive and expects "debug"
      expect(mockInstance.interceptors.request.use).not.toHaveBeenCalled();
      expect(mockInstance.interceptors.response.use).not.toHaveBeenCalled();
    });

    it("should handle empty scrtEndpointBase", () => {
      const configWithEmptyUrl = {
        scrtEndpointBase: ""
      };

      axiosWrapper.getScrtEndpoint(configWithEmptyUrl);

      expect(mockAxios.create).toHaveBeenCalledWith({
        baseURL: ""
      });
    });

    it("should handle undefined scrtEndpointBase", () => {
      const configWithUndefinedUrl = {
        scrtEndpointBase: undefined
      };

      axiosWrapper.getScrtEndpoint(configWithUndefinedUrl);

      expect(mockAxios.create).toHaveBeenCalledWith({
        baseURL: undefined
      });
    });
  });
});