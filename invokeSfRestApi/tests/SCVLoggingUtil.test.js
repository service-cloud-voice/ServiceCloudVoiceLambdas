const winston = require("winston");
const { info, warn } = require("../SCVLoggingUtil.js"); // Replace with the actual file name
jest.mock("winston", () => ({
    createLogger: jest.fn().mockReturnValue({
        info: jest.fn(),
        warn: jest.fn(),
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

describe("Logger tests", () => {
    let loggerInstance;

    beforeEach(() => {
        // Create a mock instance of the logger for each test
        loggerInstance = winston.createLogger();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("test logging info", () => {
        const logLine = { context: "Test", message: "Message" };

        const infoSpy = jest.spyOn(loggerInstance, "info");

        info(logLine);

        expect(infoSpy).toHaveBeenCalledWith({
            context: "Test",
            message: "Message",
            category: "invokeSfRestApi",
        });
    });

    it("test logging warn", () => {
        const logLine = { context: "Test", message: "Message" };

        const warnSpy = jest.spyOn(loggerInstance, "warn");

        warn(logLine);

        expect(warnSpy).toHaveBeenCalledWith({
            context: "Test",
            message: "Message",
            category: "invokeSfRestApi",
        });
    });
});
