const { fetchDefaultVoicemailGreetingUrl } = require("./../fetchDefaultVoicemailGreetingUrl");

jest.mock("./../queryEngine");
const queryEngine = require("./../queryEngine");

jest.mock("../secretUtils");
const secretUtils = require("../secretUtils.js");

jest.mock("./../SCVLoggingUtil", () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
}));
const SCVLoggingUtil = require("./../SCVLoggingUtil");

describe("fetchDefaultVoicemailGreetingUrl", () => {
    it("returns success with no GreetingUrl when agentARN is missing and does not call secrets or query", async () => {
        const event = { Details: { Parameters: {} } };

        const { GreetingUrl, success } = await fetchDefaultVoicemailGreetingUrl(event);

        expect(GreetingUrl).toBeUndefined();
        expect(success).toBeTruthy();
        expect(secretUtils.getSecretConfigs).not.toHaveBeenCalled();
        expect(queryEngine.invokeQuery).not.toHaveBeenCalled();
        expect(SCVLoggingUtil.error).toHaveBeenCalledTimes(1);
        expect(SCVLoggingUtil.error.mock.calls[0][0].message).toMatch(/Couldn't find agentARN/i);
    });

    it("returns success with no GreetingUrl when SF query rejects and logs serialized error", async () => {
        const event = { Details: { Parameters: { agentARN: "testAgentARN" } } };
        const configs = { callCenterApiName: "api", baseURL: "url", authEndpoint: "auth", consumerKey: "ck", privateKey: "pk", audience: "aud", subject: "sub" };

        secretUtils.getSecretConfigs.mockResolvedValueOnce(configs);
        queryEngine.invokeQuery.mockRejectedValueOnce(new Error("boom"));

        const { GreetingUrl, success } = await fetchDefaultVoicemailGreetingUrl(event, "secret1", "access1");

        expect(GreetingUrl).toBeUndefined();
        expect(success).toBeTruthy();
        expect(SCVLoggingUtil.error).toHaveBeenCalled();
        const logArg = SCVLoggingUtil.error.mock.calls.find(
            ([arg]) => /Couldn't query voicemail greeting to find greeting url/i.test(arg.message)
        )[0];
        expect(logArg.context.payload.error).toMatchObject({ name: "Error", message: "boom" });
        expect(typeof logArg.context.payload.error.stack).toBe("string");
    });

    it("returns success with no GreetingUrl when SF query returns success=false and logs", async () => {
        const event = { Details: { Parameters: { agentARN: "testAgentARN" } } };
        const configs = { callCenterApiName: "api" };

        secretUtils.getSecretConfigs.mockResolvedValueOnce(configs);
        queryEngine.invokeQuery.mockResolvedValueOnce({ success: false });

        const { GreetingUrl, success } = await fetchDefaultVoicemailGreetingUrl(event);

        expect(GreetingUrl).toBeUndefined();
        expect(success).toBeTruthy();
        expect(SCVLoggingUtil.error).toHaveBeenCalled();
        const logArg = SCVLoggingUtil.error.mock.calls.find(
            ([arg]) => /Error in querying voicemail greeting to find greeting url/i.test(arg.message)
        )[0];
        expect(logArg).toBeTruthy();
    });

    it("returns success with no GreetingUrl when SF query resolves without GreetingUrl and logs missing", async () => {
        const event = { Details: { Parameters: { agentARN: "testAgentARN" } } };
        const configs = { callCenterApiName: "api" };

        secretUtils.getSecretConfigs.mockResolvedValueOnce(configs);
        queryEngine.invokeQuery.mockResolvedValueOnce({}); // no GreetingUrl

        const { GreetingUrl, success } = await fetchDefaultVoicemailGreetingUrl(event);

        expect(GreetingUrl).toBeUndefined();
        expect(success).toBeTruthy();
        expect(SCVLoggingUtil.error).toHaveBeenCalled();
        const logArg = SCVLoggingUtil.error.mock.calls.find(
            ([arg]) => /Couldn't find default voicemail greeting url/i.test(arg.message)
        )[0];
        expect(logArg.context.payload).toMatchObject({ agentARN: "testAgentARN" });
    });

    it("returns GreetingUrl on success and does not log errors", async () => {
        const event = { Details: { Parameters: { agentARN: "testAgentARN" } } };
        const GreetingUrl = "https://example.com/greeting.wav";
        const configs = { callCenterApiName: "api" };

        secretUtils.getSecretConfigs.mockResolvedValueOnce(configs);
        queryEngine.invokeQuery.mockResolvedValueOnce({ GreetingUrl });

        const result = await fetchDefaultVoicemailGreetingUrl(event);

        expect(result.success).toBeTruthy();
        expect(result.GreetingUrl).toEqual(GreetingUrl);
        // Ensure we didn't log any errors in the success path
        expect(SCVLoggingUtil.error).not.toHaveBeenCalled();
    });

    it("passes secret and token names to queryEngine and secretUtils", async () => {
        const event = { Details: { Parameters: { agentARN: "agent-123" } } };
        const GreetingUrl = "https://example.com/ok.wav";

        secretUtils.getSecretConfigs.mockResolvedValueOnce({});
        queryEngine.invokeQuery.mockImplementationOnce((qry, args, secretName, accessTokenSecretName) => {
            expect(secretName).toBe("mySecret");
            expect(accessTokenSecretName).toBe("myAccessToken");
            return Promise.resolve({ GreetingUrl });
        });

        const result = await fetchDefaultVoicemailGreetingUrl(event, "mySecret", "myAccessToken");
        expect(result.GreetingUrl).toBe(GreetingUrl);
    });

    it("builds SOQL including agentARN and expected filters", async () => {
        const event = { Details: { Parameters: { agentARN: "AGENT-XYZ" } } };
        secretUtils.getSecretConfigs.mockResolvedValueOnce({});

        queryEngine.invokeQuery.mockImplementationOnce((qry) => {
            expect(qry).toMatch(/VoiceMailGreeting2\.GreetingUrl/);
            expect(qry).toMatch(/VoiceMailGreeting2\.Type='DROP'/);
            expect(qry).toMatch(/IsDefault\s*=\s*true/);
            expect(qry).toMatch(/ExternalId\s*=\s*'AGENT-XYZ'/);
            return Promise.resolve({ GreetingUrl: "x" });
        });

        const result = await fetchDefaultVoicemailGreetingUrl(event);
        expect(result.success).toBeTruthy();
    });
});