jest.mock("./../SCVLoggingUtil.js", () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
}));
const SCVLoggingUtil = require("./../SCVLoggingUtil.js");

jest.mock("./../sfRestApi.js", () => ({
    createRecord: jest.fn(),
    updateRecord: jest.fn(),
    uploadTranscript: jest.fn(),
    sendRealtimeAlertEvent: jest.fn(),
    searchRecord: jest.fn(),
    fetchUploadIdsStatus: jest.fn(),
}));
const api = require("./../sfRestApi.js");

jest.mock("./../utils.js", () => ({
    formatObjectApiName: jest.fn((x) => x),
    getSObjectFieldValuesFromConnectLambdaParams: jest.fn(() => ({ f1: "v1" })),
    getRealtimeAlertEventFieldValuesFromConnectLambdaParams: jest.fn(() => ({ e1: "v1" })),
}));

jest.mock("./../queryEngine.js", () => ({
    invokeQuery: jest.fn(),
}));
const queryEngine = require("./../queryEngine.js");

jest.mock("./../SFSPhoneCallFlow.js", () => ({
    entryPoint: jest.fn(),
}));
const SFSPhoneCallFlow = require("./../SFSPhoneCallFlow.js");

jest.mock("./../fetchAgentPhoneNumber.js", () => ({
    fetchAgentPhoneNumber: jest.fn(),
}));
const { fetchAgentPhoneNumber } = require("./../fetchAgentPhoneNumber.js");

jest.mock("./../fetchOutboundPhoneNumber.js", () => ({
    fetchOutboundPhoneNumber: jest.fn(),
}));
const { fetchOutboundPhoneNumber } = require("./../fetchOutboundPhoneNumber.js");

jest.mock("./../fetchDefaultVoicemailGreetingUrl.js", () => ({
    fetchDefaultVoicemailGreetingUrl: jest.fn(),
}));
const { fetchDefaultVoicemailGreetingUrl } = require("./../fetchDefaultVoicemailGreetingUrl.js");

jest.mock("./../config.js", () => ({
    secretName: "confSecret",
    accessTokenSecretName: "confAccess",
}));

const { handler } = require("./../handler");

function eventWith(overrides = {}) {
    return {
        Details: {
            Parameters: {
                methodName: "createRecord",
                objectApiName: "Case",
                recordId: "001xx",
                ...(overrides.Parameters || {}),
            },
            ContactData: {
                Attributes: {
                    ...(overrides.Details?.ContactData?.Attributes || {}),
                },
            },
            ...(overrides.Details || {}),
        },
    };
}

describe("handler - coverage for create/update/upload/alert/agent/default/throw", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // 41-49: createRecord
    it("createRecord: calls api.createRecord with formatted object, field values, and secrets", async () => {
        api.createRecord.mockResolvedValueOnce({ success: true, id: "abc" });

        const ev = eventWith({
            Parameters: {
                methodName: "createRecord",
                objectApiName: "Case",
                secretName: "paramSecret",
                accessTokenSecretName: "paramAccess",
            },
        });

        const res = await handler(ev);
        expect(api.createRecord).toHaveBeenCalledWith(
            "Case",
            { f1: "v1" },
            "paramSecret",
            "paramAccess"
        );
        expect(res).toEqual({ success: true, id: "abc" });
    });

    // 50-59: updateRecord
    it("updateRecord: calls api.updateRecord with recordId and field values", async () => {
        api.updateRecord.mockResolvedValueOnce({ success: true });

        const ev = eventWith({
            Parameters: {
                methodName: "updateRecord",
                objectApiName: "Case",
                recordId: "001xyz",
            },
            Details: { ContactData: { Attributes: { secretName: "attrSecret", accessTokenSecretName: "attrAccess" } } },
        });

        const res = await handler(ev);
        expect(api.updateRecord).toHaveBeenCalledWith(
            "Case",
            "001xyz",
            { f1: "v1" },
            "attrSecret",
            "attrAccess"
        );
        expect(res).toEqual({ success: true });
    });

    // 70-75: uploadTranscript
    it("uploadTranscript: calls api.uploadTranscript with payload and secrets", async () => {
        api.uploadTranscript.mockResolvedValueOnce({ success: true, uploaded: 2 });

        const ev = eventWith({
            Parameters: {
                methodName: "uploadTranscript",
                contactIdsPayloadMap: { a: 1 },
            },
            Details: { ContactData: { Attributes: { secretName: "attrSecret", accessTokenSecretName: "attrAccess" } } },
        });

        const res = await handler(ev);
        expect(api.uploadTranscript).toHaveBeenCalledWith({ a: 1 }, "attrSecret", "attrAccess");
        expect(res).toEqual({ success: true, uploaded: 2 });
    });

    // 85-93: realtimeAlertEvent
    it("realtimeAlertEvent: passes processed event fields and secrets", async () => {
        api.sendRealtimeAlertEvent.mockResolvedValueOnce({ success: true });

        const ev = eventWith({
            Parameters: { methodName: "realtimeAlertEvent" },
            Details: { ContactData: { Attributes: { secretName: "attrSecret", accessTokenSecretName: "attrAccess" } } },
        });

        const res = await handler(ev);
        expect(api.sendRealtimeAlertEvent).toHaveBeenCalledWith({ e1: "v1" }, "attrSecret", "attrAccess");
        expect(res).toEqual({ success: true });
    });

    // 105-106: fetchAgentPhoneNumber
    it("fetchAgentPhoneNumber: is called with only event", async () => {
        fetchAgentPhoneNumber.mockResolvedValueOnce({ success: true, phone: "555" });

        const ev = eventWith({
            Parameters: { methodName: "fetchAgentPhoneNumber" },
        });

        const res = await handler(ev);
        expect(fetchAgentPhoneNumber).toHaveBeenCalledWith(ev);
        expect(res).toEqual({ success: true, phone: "555" });
    });

    // 113-117: default branch (warn + throw)
    it("default: logs warn and throws Unsupported method", async () => {
        const ev = eventWith({
            Parameters: { methodName: "nope" },
        });

        await expect(handler(ev)).rejects.toThrow("Unsupported method: nope");
        expect(SCVLoggingUtil.warn).toHaveBeenCalledWith(
            expect.objectContaining({ message: "Unsupported method" })
        );
    });

    // 122: throw when result.success === false
    it("throws when downstream returns success=false", async () => {
        api.createRecord.mockResolvedValueOnce({ success: false, errorMessage: "bad" });

        const ev = eventWith({
            Parameters: { methodName: "createRecord" },
        });

        await expect(handler(ev)).rejects.toThrow("bad");
    });

    // 61-64: queryRecord
    it("queryRecord: calls queryEngine.invokeQuery and flattens result", async () => {
        queryEngine.invokeQuery.mockResolvedValueOnce({ records: [{ Id: "123" }], totalSize: 1 });

        const ev = eventWith({
            Parameters: {
                methodName: "queryRecord",
                soql: "SELECT Id FROM Account",
                secretName: "paramSecret",
                accessTokenSecretName: "paramAccess",
            },
        });

        const res = await handler(ev);
        expect(queryEngine.invokeQuery).toHaveBeenCalledWith(
            "SELECT Id FROM Account",
            ev.Details.Parameters,
            "paramSecret",
            "paramAccess"
        );
        expect(res["records.0.Id"]).toBe("123");
        expect(res.totalSize).toBe(1);
    });

    // 65-68: searchRecord
    it("searchRecord: calls api.searchRecord and flattens result", async () => {
        api.searchRecord.mockResolvedValueOnce({ searchRecords: [{ Id: "456" }] });

        const ev = eventWith({
            Parameters: {
                methodName: "searchRecord",
                sosl: "FIND {test}",
            },
            Details: { ContactData: { Attributes: { secretName: "attrSecret", accessTokenSecretName: "attrAccess" } } },
        });

        const res = await handler(ev);
        expect(api.searchRecord).toHaveBeenCalledWith("FIND {test}", "attrSecret", "attrAccess");
        expect(res["searchRecords.0.Id"]).toBe("456");
    });

    // 77-83: fetchUploadIdsStatus
    it("fetchUploadIdsStatus: calls api.fetchUploadIdsStatus with uploadIds", async () => {
        api.fetchUploadIdsStatus.mockResolvedValueOnce({ success: true, statuses: ["complete"] });

        const ev = eventWith({
            Parameters: {
                methodName: "fetchUploadIdsStatus",
                uploadIds: ["id1", "id2"],
            },
            Details: { ContactData: { Attributes: { secretName: "attrSecret", accessTokenSecretName: "attrAccess" } } },
        });

        const res = await handler(ev);
        expect(api.fetchUploadIdsStatus).toHaveBeenCalledWith(["id1", "id2"], "attrSecret", "attrAccess");
        expect(res).toEqual({ success: true, statuses: ["complete"] });
    });

    // 95-98: SFSPhoneCallFlowQuery
    it("SFSPhoneCallFlowQuery: calls SFSPhoneCallFlow.entryPoint and flattens result", async () => {
        SFSPhoneCallFlow.entryPoint.mockResolvedValueOnce({ flow: { id: "789" } });

        const ev = eventWith({
            Parameters: {
                methodName: "SFSPhoneCallFlowQuery",
                secretName: "paramSecret",
                accessTokenSecretName: "paramAccess",
            },
        });

        const res = await handler(ev);
        expect(SFSPhoneCallFlow.entryPoint).toHaveBeenCalledWith(ev, "paramSecret", "paramAccess");
        expect(res["flow.id"]).toBe("789");
    });

    // 100-102: fetchOutboundPhoneNumber
    it("fetchOutboundPhoneNumber: calls fetchOutboundPhoneNumber with event and secrets", async () => {
        fetchOutboundPhoneNumber.mockResolvedValueOnce({ success: true, phoneNumber: "+1234567890" });

        const ev = eventWith({
            Parameters: { methodName: "fetchOutboundPhoneNumber" },
            Details: { ContactData: { Attributes: { secretName: "attrSecret", accessTokenSecretName: "attrAccess" } } },
        });

        const res = await handler(ev);
        expect(fetchOutboundPhoneNumber).toHaveBeenCalledWith(ev, "attrSecret", "attrAccess");
        expect(res).toEqual({ success: true, phoneNumber: "+1234567890" });
    });

    // 108-110: fetchDefaultVoicemailGreetingUrl
    it("fetchDefaultVoicemailGreetingUrl: calls fetchDefaultVoicemailGreetingUrl with event and secrets", async () => {
        fetchDefaultVoicemailGreetingUrl.mockResolvedValueOnce({ success: true, url: "https://example.com/greeting.mp3" });

        const ev = eventWith({
            Parameters: { methodName: "fetchDefaultVoicemailGreetingUrl" },
            Details: { ContactData: { Attributes: { secretName: "attrSecret", accessTokenSecretName: "attrAccess" } } },
        });

        const res = await handler(ev);
        expect(fetchDefaultVoicemailGreetingUrl).toHaveBeenCalledWith(ev, "attrSecret", "attrAccess");
        expect(res).toEqual({ success: true, url: "https://example.com/greeting.mp3" });
    });
});