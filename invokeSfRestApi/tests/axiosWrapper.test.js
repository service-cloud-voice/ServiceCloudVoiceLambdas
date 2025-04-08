const axios = require("axios");

// Mocking axios and axios-logger
jest.mock("axios");
jest.mock("axios-logger");

// Mocking the config values to avoid undefined baseURLs
jest.mock("../config", () => ({
    salesforceRestApiEndpointBase: "https://api.salesforce.com",
    salesforceAuthEndpoint: "https://auth.salesforce.com",
}));

describe("API endpoints tests", () => {
    let apiEndpoint;
    let authEndpoint;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.LOG_LEVEL = "debug"; // Default to 'info' before each test to ensure the correct logic is applied

        // Mock axios.create to return objects with the correct structure (including `interceptors` with `use` methods)
        apiEndpoint = {
            defaults: { baseURL: "https://api.salesforce.com" },
            interceptors: {
                request: {
                    handlers: [],
                    use: jest.fn((fulfilled, rejected) => {
                        apiEndpoint.interceptors.request.handlers.push({ fulfilled, rejected });
                    }),
                },
                response: {
                    handlers: [],
                    use: jest.fn((fulfilled, rejected) => {
                        apiEndpoint.interceptors.response.handlers.push({ fulfilled, rejected });
                    }),
                },
            },
        };

        authEndpoint = {
            defaults: { baseURL: "https://auth.salesforce.com" },
            interceptors: {
                request: {
                    handlers: [],
                    use: jest.fn((fulfilled, rejected) => {
                        authEndpoint.interceptors.request.handlers.push({ fulfilled, rejected });
                    }),
                },
                response: {
                    handlers: [],
                    use: jest.fn((fulfilled, rejected) => {
                        authEndpoint.interceptors.response.handlers.push({ fulfilled, rejected });
                    }),
                },
            },
        };

        // Mock axios.create to return our custom mock instances
        axios.create.mockImplementation((config) => {
            if (config.baseURL === "https://api.salesforce.com") {
                return apiEndpoint;
            }
            if (config.baseURL === "https://auth.salesforce.com") {
                return authEndpoint;
            }
            return axios.create(config); // Default axios create mock behavior
        });

        // Re-importing the module to trigger the interceptor setup
        require("../axiosWrapper.js"); // Replace with actual file name
    });

    it("should add interceptors when LOG_LEVEL is 'debug'", () => {
        process.env.LOG_LEVEL = "debug"; // Set the environment variable to 'debug'
        require("../axiosWrapper.js"); // Re-import to apply the change

        // Check if interceptors have been added to apiEndpoint and authEndpoint
        expect(apiEndpoint.interceptors.request.handlers.length).toBe(1);
        expect(apiEndpoint.interceptors.response.handlers.length).toBe(1);
        expect(authEndpoint.interceptors.request.handlers.length).toBe(1);
        expect(authEndpoint.interceptors.response.handlers.length).toBe(1);

    });

    it("should not add interceptors when LOG_LEVEL is not 'debug'", () => {
        process.env.LOG_LEVEL = "info"; // Set the environment variable to something other than 'debug'
        require("../axiosWrapper.js"); // Re-import to apply the change

        // Check that interceptors have not been added
        expect(apiEndpoint.interceptors.request.handlers.length).toBe(0);
        expect(apiEndpoint.interceptors.response.handlers.length).toBe(0);
        expect(authEndpoint.interceptors.request.handlers.length).toBe(0);
        expect(authEndpoint.interceptors.response.handlers.length).toBe(0);
    });
});
