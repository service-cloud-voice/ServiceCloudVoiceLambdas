const utils = require('../utils');

jest.mock('aws-sdk');
const aws = require('aws-sdk');

describe('transformCTR', () => {
    let input1 = {
        "ContactId":"1e67e495-edea-488e-b7cf-359e2f4ebfc1",
        "InitiationTimestamp":"2020-08-07T06:09:34Z",
        "DisconnectTimestamp":"2020-08-07T06:09:41Z",
        "PreviousContactId":"0eeeb618-d2a9-46ce-9ad9-0c76a60cff8e",
        "InitiationMethod":"TRANSFER",
        "DisconnectReason": "TELECOM_PROBLEM",
        "Recording":{
            "Location":"abc.com"
        },
        "Agent":{
            "ConnectedToAgentTimestamp":"2020-08-07T06:09:34Z",
            "CustomerHoldDuration":10,
            "LongestHoldDuration":8,
            "AgentInteractionDuration":2,
            "NumberOfHolds":1
        },
        "Queue":{
            "EnqueueTimestamp":"2020-08-07T06:09:34Z",
            "Name":"Test"
        },
        "Attributes":{
            "sf_realtime_transcription_status":"passed",
            "sfdc-UserInputNum__c":10
        }
    };
    let expected1 = {
        "contactId":"1e67e495-edea-488e-b7cf-359e2f4ebfc1",
        "fields":{
            "startTime":"2020-08-07T06:09:34Z",
            "endTime":"2020-08-07T06:09:41Z",
            "parentCallIdentifier":"0eeeb618-d2a9-46ce-9ad9-0c76a60cff8e",
            "initiationMethod":"TRANSFER",
            "acceptTime":"2020-08-07T06:09:34Z",
            "totalHoldDuration":10,
            "longestHoldDuration":8,
            "agentInteractionDuration":2,
            "numberOfHolds":1,
            "enqueueTime":"2020-08-07T06:09:34Z",
            "queue":"Test",
            "recordingLocation":"abc.com",
            "callAttributes": "{\"sf_realtime_transcription_status\":\"passed\",\"UserInputNum__c\":10}",
            "callSubType": "PSTN",
            "disconnectReason": {
                "value": "TELECOM_PROBLEM",
                "isError": true
            }
        }
    }
    it('should transform raw CTR data to voicecall like JSON', () => {
        expect(utils.transformCTR(input1)).toStrictEqual(expected1);
    });

    let input2 = {
        "ContactId":"1e67e495-edea-488e-b7cf-359e2f4ebfc1",
        "InitiationTimestamp":undefined,
        "DisconnectTimestamp":"2020-08-07T06:09:41Z",
        "DisconnectReason": "AGENT_HUNGUP",
        "queue":null
    };
    let expected2 = {
        "contactId":"1e67e495-edea-488e-b7cf-359e2f4ebfc1",
        "fields":{
            "endTime":"2020-08-07T06:09:41Z",
            "disconnectReason": {
                "value": "AGENT_HUNGUP",
                "isError": false
            }
        }
    };
    it('should remove key with undefined value', () => {
        expect(utils.transformCTR(input2)).toStrictEqual(expected2);
    });

    let input3 = {
        "ContactId":"1e67e495-edea-488e-b7cf-359e2f4ebfc1",
        "DisconnectReason": "AGENT_HUNGUP",
        "InitiationMethod":"API"
    };
    let expected3 = {
        "contactId":"1e67e495-edea-488e-b7cf-359e2f4ebfc1",
        "fields":{
            "initiationMethod":"INBOUND",
            "callSubType": "PSTN",
            "disconnectReason": {
                "value": "AGENT_HUNGUP",
                "isError": false
            }
        }
    };
    let actual3 = utils.transformCTR(input3);
    it('should transform raw CTR data with initiationMethod API to voicecall with initiationMethod INBOUND like JSON', () => {
        expect(actual3).toStrictEqual(expected3);
    });

    let input4 = {
        "ContactId":"1e67e495-edea-488e-b7cf-359e2f4ebfc1",
        "DisconnectReason": null,
        "InitiationMethod":"API"
    };
    let expected4 = {
        "contactId":"1e67e495-edea-488e-b7cf-359e2f4ebfc1",
        "fields":{
            "initiationMethod":"INBOUND",
            "callSubType": "PSTN",
            "disconnectReason": {
                "value": "UNKNOWN",
                "isError": false
            }
        }
    };
    let actual4 = utils.transformCTR(input4);
    it('should default to UNKNOWN reason for disconnect if null', () => {
        expect(actual4).toStrictEqual(expected4);
    });

    it('should set disconnectReason to CALLBACK and isError to false when callback_flag is set', () => {
        const input = {
            ContactId: "cb-flag-test-1",
            InitiationTimestamp: "2023-01-01T00:00:00Z",
            DisconnectTimestamp: "2023-01-01T00:05:00Z",
            DisconnectReason: "TELECOM_PROBLEM", // would normally be isError: true
            Attributes: {
                callback_flag: true,
                "sfdc-TestField": "testValue"
            },
            Agent: {
                ConnectedToAgentTimestamp: "2023-01-01T00:00:30Z",
                CustomerHoldDuration: 20,
                LongestHoldDuration: 10,
                AgentInteractionDuration: 100,
                NumberOfHolds: 2
            },
            Queue: {
                EnqueueTimestamp: "2023-01-01T00:00:10Z",
                Name: "TestQueue"
            },
            Recording: {
                Location: "https://example.com/rec"
            },
            InitiationMethod: "CALLBACK",
            SystemEndpoint: { Address: "+1234567890" },
            CustomerEndpoint: { Address: "+0987654321" }
        };
        const expected = {
            contactId: "cb-flag-test-1",
            fields: {
                startTime: "2023-01-01T00:00:00Z",
                endTime: "2023-01-01T00:05:00Z",
                acceptTime: "2023-01-01T00:00:30Z",
                totalHoldDuration: 20,
                longestHoldDuration: 10,
                agentInteractionDuration: 100,
                numberOfHolds: 2,
                enqueueTime: "2023-01-01T00:00:10Z",
                queue: "TestQueue",
                recordingLocation: "https://example.com/rec",
                initiationMethod: "CALLBACK",
                fromNumber: "+1234567890",
                toNumber: "+0987654321",
                callSubType: "PSTN",
                callAttributes: '{"TestField":"testValue"}',
                disconnectReason: {
                    value: "CALLBACK",
                    isError: false
                }
            }
        };
        expect(utils.transformCTR(input)).toStrictEqual(expected);
    });

    it('should set disconnectReason to TELECOM_PROBLEM and isError to true when callback_flag is not present', () => {
        const input = {
            ContactId: "cb-flag-test-1",
            InitiationTimestamp: "2023-01-01T00:00:00Z",
            DisconnectTimestamp: "2023-01-01T00:05:00Z",
            DisconnectReason: "TELECOM_PROBLEM", // would normally be isError: true
            Attributes: {
                "sfdc-TestField": "testValue"
            },
            Agent: {
                ConnectedToAgentTimestamp: "2023-01-01T00:00:30Z",
                CustomerHoldDuration: 20,
                LongestHoldDuration: 10,
                AgentInteractionDuration: 100,
                NumberOfHolds: 2
            },
            Queue: {
                EnqueueTimestamp: "2023-01-01T00:00:10Z",
                Name: "TestQueue"
            },
            Recording: {
                Location: "https://example.com/rec"
            },
            InitiationMethod: "CALLBACK",
            SystemEndpoint: { Address: "+1234567890" },
            CustomerEndpoint: { Address: "+0987654321" }
        };
        const expected = {
            contactId: "cb-flag-test-1",
            fields: {
                startTime: "2023-01-01T00:00:00Z",
                endTime: "2023-01-01T00:05:00Z",
                acceptTime: "2023-01-01T00:00:30Z",
                totalHoldDuration: 20,
                longestHoldDuration: 10,
                agentInteractionDuration: 100,
                numberOfHolds: 2,
                enqueueTime: "2023-01-01T00:00:10Z",
                queue: "TestQueue",
                recordingLocation: "https://example.com/rec",
                initiationMethod: "CALLBACK",
                fromNumber: "+1234567890",
                toNumber: "+0987654321",
                callSubType: "PSTN",
                callAttributes: '{"TestField":"testValue"}',
                disconnectReason: {
                    value: "TELECOM_PROBLEM",
                    isError: true
                }
            }
        };
        expect(utils.transformCTR(input)).toStrictEqual(expected);
    });
});

describe('getCallAttributes', () => {
    let input = {
        "sfdc-field1":"field1",
        "sfdc-field2":"field2",
        "sfdc-field3":"field3",
        "sfdc-field4":"field4",
        "field5":"field5"
    };

    let expected = {
        "field1":"field1",
        "field2":"field2",
        "field3":"field3",
        "field4":"field4"
    };
    it('should get contact attributes that start with sfdc- and ignore the other attributes', () => {
        expect(utils.getCallAttributes(input)).toStrictEqual(expected);
    });

    let input3 = {
        "sfd-field1":"field1",
        "sfdcfield2":"field2",
        "sdc-field3":"field3",
        "sfc-field4":"field4",
        "field5":"field5"
    };

    let expected3 = {};
    it('call attributes should be empty as none of the attributes start with sfdc-', () => {
        expect(utils.getCallAttributes(input3)).toStrictEqual(expected3);
    });
});

describe('parseData', () => {
    let input = "eyJsYW5nIjogIkVuZ2xpc2gifQ==";
    let expected = {"lang": "English"};
    it('should parse correctly', () => {
        expect(utils.parseData(input)).toStrictEqual(expected);
    });

    let input1 = "eyJmcmVuY2giOiAiU+KAmWlsIHZvdXMgcGxhw650In0=";
    let expected1 = {"french": "S’il vous plaît"};
    it('should parse correctly', () => {
        expect(utils.parseData(input1)).toStrictEqual(expected1);
    });

    let input2 = "eyJHZXJtYW4iOiAiTMOkY2hlbG4ifQ";
    let expected2 = {"German": "Lächeln"};
    it('should parse correctly', () => {
        expect(utils.parseData(input2)).toStrictEqual(expected2);
    });

    let input3 = "eyJNYW5kYXJpbiI6ICLkuIDkupvmma7pgJror50ifQ==";
    let expected3 = {"Mandarin": "一些普通话"};
    it('should parse correctly', () => {
        expect(utils.parseData(input3)).toStrictEqual(expected3);
    });

    let input4 = "eyJKYXBhbmVzZSI6ICLkuIDpg6jjga7ml6XmnKzkuroifQ===";
    let expected4 = {"Japanese": "一部の日本人"};
    it('should parse correctly', () => {
        expect(utils.parseData(input4)).toStrictEqual(expected4);
    });

    let input5 = "eyJTd2VkaXNoIjogIm7DpWdyYSBzdmVuc2thIHNwcsOlayJ9";
    let expected5 = {"Swedish": "några svenska språk"};
    it('should parse correctly', () => {
        expect(utils.parseData(input5)).toStrictEqual(expected5);
    });

    let input6 = "eyJLb3JlYW4iOiAi7ZWc6rWt7Ja0In0=";
    let expected6 = {"Korean": "한국어"};
    it('should parse correctly', () => {
        expect(utils.parseData(input6)).toStrictEqual(expected6);
    });

    let input7 = "eyJJdGFsaWFuIjogIkMnw6ggcXVhbGN1bm8gY2hlIHBhcmxhIGluZ2xlc2UifQ==";
    let expected7 = {"Italian": "C'è qualcuno che parla inglese"};
    it('should parse correctly', () => {
        expect(utils.parseData(input7)).toStrictEqual(expected7);
    });

    let input8 = "eyJQb3J0dWdlc2UiOiAiUG9ydHVndcOqcyBjb211bSJ9";
    let expected8 ={"Portugese": "Português comum"};
    it('should parse correctly', () => {
        expect(utils.parseData(input8)).toStrictEqual(expected8);
    });

    let input9 = "eyJBcmFiaWMiOiAi2KfZhNmE2LrYqSDYp9mE2LnYsdio2YrYqSDYp9mE2YXYtNiq2LHZg9ipIn0=";
    let expected9 = {"Arabic": "اللغة العربية المشتركة"};
    it('should parse correctly', () => {
        expect(utils.parseData(input9)).toStrictEqual(expected9);
    });

    let input10 = "eyJTcGFuaXNoIjogIkVzcGHDsW9sIGNvbcO6biJ9";
    let expected10 = {"Spanish": "Español común"};
    it('should parse correctly', () => {
        expect(utils.parseData(input10)).toStrictEqual(expected10);
    });
});
