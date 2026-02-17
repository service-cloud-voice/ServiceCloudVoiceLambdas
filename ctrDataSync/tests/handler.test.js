const handler = require('../handler');

jest.mock('../SCVLoggingUtil');
const SCVLoggingUtil = require('../SCVLoggingUtil');

afterEach(() => {
	jest.restoreAllMocks();
});

describe('shouldProcessCTRTests', () => {
	let inboundCall = {
		InitiationMethod: "INBOUND",
		ContactId: "placeHolderContactId",
		Channel: "VOICE"
	};
	it ('should process inbound calls', () => {
		expect(handler.shouldProcessCtr(inboundCall)).toBeTruthy();
	});

	let outboundCall = {
		InitiationMethod: "OUTBOUND",
		ContactId: "placeHolderContactId",
		Channel: "VOICE"
	};
	it ('should process outbound calls', () => {
		expect(handler.shouldProcessCtr(outboundCall)).toBeTruthy();
	});

	let transferCall = {
		InitiationMethod: "TRANSFER",
		ContactId: "placeHolderContactId",
		Channel: "VOICE"
	};
	it ('should process transfer calls', () => {
		expect(handler.shouldProcessCtr(transferCall)).toBeTruthy();
	});

	let callbackCall = {
		InitiationMethod: "CALLBACK",
		ContactId: "placeHolderContactId",
		Channel: "VOICE"
	};
	it ('should process callback calls', () => {
		expect(handler.shouldProcessCtr(callbackCall)).toBeTruthy();
	});

	let apiCall = {
		InitiationMethod: "API",
		ContactId: "placeHolderContactId",
		Channel: "VOICE"
	};
	it ('should process api calls', () => {
		expect(handler.shouldProcessCtr(apiCall)).toBeTruthy();
	});

	let disconnectCall = {
		InitiationMethod: "DISCONNECT",
		ContactId: "placeHolderContactId",
		Channel: "VOICE"
	};
	it ('should not process disconnect calls', () => {
		expect(handler.shouldProcessCtr(disconnectCall)).toBeFalsy();
	});

	let voicemailCall = {
		InitiationMethod: "INBOUND",
		ContactId: "placeHolderContactId",
		Recordings: ["placeholderRecordingsValue"],
		Attributes: {
			vm_flag: 1
		},
		Channel: "VOICE"
	};
	it('should not process voicemails', () => {
		expect(handler.shouldProcessCtr(voicemailCall)).toBeFalsy();
	});

	let incompleteVoicemailCall = {
		InitiationMethod: "INBOUND",
		ContactId: "placeHolderContactId",
		Recordings: null,
		Attributes: {
			vm_flag: 1,
		},
		Channel: "VOICE"
	};
	it('should process incomplete voicemails', () => {
		expect(handler.shouldProcessCtr(incompleteVoicemailCall)).toBeTruthy();
	});

	let misformattedVoicemailCall1 = {
		InitiationMethod: "INBOUND",
		ContactId: "placeHolderContactId",
		Recordings: ["placeholderRecordingsValue"],
		Channel: "VOICE"
	}
	it('should process misformatted voicemails - test 1', () => {
		expect(handler.shouldProcessCtr(misformattedVoicemailCall1)).toBeTruthy();
	});

	let misformattedVoicemailCall2 = {
		InitiationMethod: "INBOUND",
		ContactId: "placeHolderContactId",
		Recordings: ["placeholderRecordingsValue"],
		Attributes: {
			placeholderKey: "placeHolderValue",
		},
		Channel: "VOICE"
	}
	it('should process misformatted voicemails - test 2', () => {
		expect(handler.shouldProcessCtr(misformattedVoicemailCall2)).toBeTruthy();
	});

	let noSyncVoiceCall1 = {
		InitiationMethod: "INBOUND",
		ContactId: "placeHolderContactId",
		Attributes: {
			NoSync: 'true'
		},
		Channel: "VOICE"
	}
	it('should not process when NoSync attribute set to true - test 1', () => {
		expect(handler.shouldProcessCtr(noSyncVoiceCall1)).toBeFalsy();
	});

	let noSyncVoiceCall2 = {
		InitiationMethod: "INBOUND",
		ContactId: "placeHolderContactId",
		Attributes: {
			NoSync: 'false'
		},
		Channel: "VOICE"
	}
	it('should process when NoSync attribute set to false - test 2', () => {
		expect(handler.shouldProcessCtr(noSyncVoiceCall2)).toBeTruthy();
	});

	let voiceCTR1 = {
		InitiationMethod: "INBOUND",
		ContactId: "placeHolderContactId",
		Channel: "VOICE"
	}
	it('should process when CTR record is for VOICE channel', () => {
		expect(handler.shouldProcessCtr(voiceCTR1)).toBeTruthy();
	});

	let voiceCTR2 = {
		InitiationMethod: "INBOUND",
		ContactId: "placeHolderContactId",
		Channel: "CHAT"
	}
	it('should not process when CTR record is for CHAT channel', () => {
		expect(handler.shouldProcessCtr(voiceCTR2)).toBeFalsy();
	});
});

describe('Lambda handler', () => {
	it('should error for non supported CTR events', async () => {
		const record = '{"InitiationMethod":"placeHolderInitiationMethod"}';
		const event = {Records: [{kinesis: {data: new Buffer.from(record).toString('base64')}}]};
		await handler.handler(event);
		expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
			message: "Encountered Non supported CTR Events: failing fast",
			context: {},
		});
	});
});