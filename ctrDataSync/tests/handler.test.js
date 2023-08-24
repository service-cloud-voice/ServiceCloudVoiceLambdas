const handler = require('../handler');
describe('shouldProcessCTRTests', () => {
	let inboundCall = {
		InitiationMethod: "INBOUND",
		ContactId: "placeHolderContactId",
	};
	it ('should process inbound calls', () => {
		expect(handler.shouldProcessCtr(inboundCall)).toBeTruthy();
	});

	let outboundCall = {
		InitiationMethod: "OUTBOUND",
		ContactId: "placeHolderContactId",
	};
	it ('should process outbound calls', () => {
		expect(handler.shouldProcessCtr(outboundCall)).toBeTruthy();
	});

	let transferCall = {
		InitiationMethod: "TRANSFER",
		ContactId: "placeHolderContactId",
	};
	it ('should process transfer calls', () => {
		expect(handler.shouldProcessCtr(transferCall)).toBeTruthy();
	});

	let callbackCall = {
		InitiationMethod: "CALLBACK",
		ContactId: "placeHolderContactId",
	};
	it ('should process callback calls', () => {
		expect(handler.shouldProcessCtr(callbackCall)).toBeTruthy();
	});

	let apiCall = {
		InitiationMethod: "API",
		ContactId: "placeHolderContactId",
	};
	it ('should process api calls', () => {
		expect(handler.shouldProcessCtr(apiCall)).toBeTruthy();
	});

	let disconnectCall = {
		InitiationMethod: "DISCONNECT",
		ContactId: "placeHolderContactId",
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
	};
	it('should process incomplete voicemails', () => {
		expect(handler.shouldProcessCtr(incompleteVoicemailCall)).toBeTruthy();
	});

	let misformattedVoicemailCall1 = {
		InitiationMethod: "INBOUND",
		ContactId: "placeHolderContactId",
		Recordings: ["placeholderRecordingsValue"],
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
	}
	it('should process misformatted voicemails - test 2', () => {
		expect(handler.shouldProcessCtr(misformattedVoicemailCall2)).toBeTruthy();
	});
});
