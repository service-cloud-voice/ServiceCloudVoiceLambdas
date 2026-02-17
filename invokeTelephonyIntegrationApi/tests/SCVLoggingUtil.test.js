const winston = require("winston");
const { info, debug, warn, error } = require("../SCVLoggingUtil.js");

jest.mock("winston", () => ({
    createLogger: jest.fn().mockReturnValue({
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    }),
    transports: {
        Console: jest.fn(),
    },
    format: {
        combine: jest.fn(),
        timestamp: jest.fn(),
        prettyPrint: jest.fn(),
        json: jest.fn(),
    },
}));

describe("SCVLoggingUtil tests", () => {
    let loggerInstance;

    beforeEach(() => {
        loggerInstance = winston.createLogger();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("info", () => {
        it("should log info with complete logLine", () => {
            const logLine = {
                context: { contactId: "test-contact" },
                message: "Test info message"
            };
            const infoSpy = jest.spyOn(loggerInstance, "info");
            info(logLine);
            expect(infoSpy).toHaveBeenCalledWith({
                context: { contactId: "test-contact" },
                message: "Test info message",
                category: "invokeTelephonyIntegrationApi",
            });
        });

        it("should log info with default values when context is missing", () => {
            const logLine = {
                message: "Test info message"
            };
            const infoSpy = jest.spyOn(loggerInstance, "info");
            info(logLine);
            expect(infoSpy).toHaveBeenCalledWith({
                context: "NO_CONTEXT",
                message: "Test info message",
                category: "invokeTelephonyIntegrationApi",
            });
        });

        it("should log info with default values when message is missing", () => {
            const logLine = {
                context: { contactId: "test-contact" }
            };
            const infoSpy = jest.spyOn(loggerInstance, "info");
            info(logLine);
            expect(infoSpy).toHaveBeenCalledWith({
                context: { contactId: "test-contact" },
                message: "NO_MESSAGE",
                category: "invokeTelephonyIntegrationApi",
            });
        });

        it("should log info with default values when both context and message are missing", () => {
            const logLine = {};
            const infoSpy = jest.spyOn(loggerInstance, "info");
            info(logLine);
            expect(infoSpy).toHaveBeenCalledWith({
                context: "NO_CONTEXT",
                message: "NO_MESSAGE",
                category: "invokeTelephonyIntegrationApi",
            });
        });
    });

    describe("debug", () => {
        it("should log debug with complete logLine", () => {
            const logLine = {
                context: { payload: { data: "test" } },
                message: "Test debug message"
            };
            const debugSpy = jest.spyOn(loggerInstance, "debug");
            debug(logLine);
            expect(debugSpy).toHaveBeenCalledWith({
                context: { payload: { data: "test" } },
                message: "Test debug message",
                category: "invokeTelephonyIntegrationApi",
            });
        });

        it("should log debug with default values when context is missing", () => {
            const logLine = {
                message: "Test debug message"
            };
            const debugSpy = jest.spyOn(loggerInstance, "debug");
            debug(logLine);
            expect(debugSpy).toHaveBeenCalledWith({
                context: "NO_CONTEXT",
                message: "Test debug message",
                category: "invokeTelephonyIntegrationApi",
            });
        });

        it("should log debug with default values when message is missing", () => {
            const logLine = {
                context: { debug: true }
            };
            const debugSpy = jest.spyOn(loggerInstance, "debug");
            debug(logLine);
            expect(debugSpy).toHaveBeenCalledWith({
                context: { debug: true },
                message: "NO_MESSAGE",
                category: "invokeTelephonyIntegrationApi",
            });
        });
    });

    describe("warn", () => {
        it("should log warn with complete logLine", () => {
            const logLine = {
                context: { warning: "potential issue" },
                message: "Test warning message"
            };
            const warnSpy = jest.spyOn(loggerInstance, "warn");
            warn(logLine);
            expect(warnSpy).toHaveBeenCalledWith({
                context: { warning: "potential issue" },
                message: "Test warning message",
                category: "invokeTelephonyIntegrationApi",
            });
        });

        it("should log warn with default values when context is missing", () => {
            const logLine = {
                message: "Test warning message"
            };
            const warnSpy = jest.spyOn(loggerInstance, "warn");
            warn(logLine);
            expect(warnSpy).toHaveBeenCalledWith({
                context: "NO_CONTEXT",
                message: "Test warning message",
                category: "invokeTelephonyIntegrationApi",
            });
        });

        it("should log warn with default values when message is missing", () => {
            const logLine = {
                context: { methodName: "unsupportedMethod" }
            };
            const warnSpy = jest.spyOn(loggerInstance, "warn");
            warn(logLine);
            expect(warnSpy).toHaveBeenCalledWith({
                context: { methodName: "unsupportedMethod" },
                message: "NO_MESSAGE",
                category: "invokeTelephonyIntegrationApi",
            });
        });
    });

    describe("error", () => {
        it("should log error with complete logLine", () => {
            const logLine = {
                context: { payload: new Error("Test error") },
                message: "Test error message"
            };
            const errorSpy = jest.spyOn(loggerInstance, "error");
            error(logLine);
            expect(errorSpy).toHaveBeenCalledWith({
                context: { payload: new Error("Test error") },
                message: "Test error message",
                category: "invokeTelephonyIntegrationApi",
            });
        });

        it("should log error with default values when context is missing", () => {
            const logLine = {
                message: "Test error message"
            };
            const errorSpy = jest.spyOn(loggerInstance, "error");
            error(logLine);
            expect(errorSpy).toHaveBeenCalledWith({
                context: "NO_CONTEXT",
                message: "Test error message",
                category: "invokeTelephonyIntegrationApi",
            });
        });

        it("should log error with default values when message is missing", () => {
            const logLine = {
                context: { payload: new Error("API failed") }
            };
            const errorSpy = jest.spyOn(loggerInstance, "error");
            error(logLine);
            expect(errorSpy).toHaveBeenCalledWith({
                context: { payload: new Error("API failed") },
                message: "NO_MESSAGE",
                category: "invokeTelephonyIntegrationApi",
            });
        });

        it("should log error with default values when both context and message are missing", () => {
            const logLine = {};
            const errorSpy = jest.spyOn(loggerInstance, "error");
            error(logLine);
            expect(errorSpy).toHaveBeenCalledWith({
                context: "NO_CONTEXT",
                message: "NO_MESSAGE",
                category: "invokeTelephonyIntegrationApi",
            });
        });
    });

    describe("buildLog function coverage", () => {
        it("should handle falsy context values", () => {
            const logLine = {
                context: null,
                message: "Test message"
            };
            const infoSpy = jest.spyOn(loggerInstance, "info");
            info(logLine);
            expect(infoSpy).toHaveBeenCalledWith({
                context: "NO_CONTEXT",
                message: "Test message",
                category: "invokeTelephonyIntegrationApi",
            });
        });

        it("should handle falsy message values", () => {
            const logLine = {
                context: { test: "context" },
                message: null
            };
            const infoSpy = jest.spyOn(loggerInstance, "info");
            info(logLine);
            expect(infoSpy).toHaveBeenCalledWith({
                context: { test: "context" },
                message: "NO_MESSAGE",
                category: "invokeTelephonyIntegrationApi",
            });
        });

        it("should handle empty string context", () => {
            const logLine = {
                context: "",
                message: "Test message"
            };
            const infoSpy = jest.spyOn(loggerInstance, "info");
            info(logLine);
            expect(infoSpy).toHaveBeenCalledWith({
                context: "NO_CONTEXT",
                message: "Test message",
                category: "invokeTelephonyIntegrationApi",
            });
        });

        it("should handle empty string message", () => {
            const logLine = {
                context: { test: "context" },
                message: ""
            };
            const infoSpy = jest.spyOn(loggerInstance, "info");
            info(logLine);
            expect(infoSpy).toHaveBeenCalledWith({
                context: { test: "context" },
                message: "NO_MESSAGE",
                category: "invokeTelephonyIntegrationApi",
            });
        });
    });
});