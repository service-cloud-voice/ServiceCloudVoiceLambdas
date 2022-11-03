const handler = require('../handler');

jest.mock('aws-sdk');

describe('VoiceMailTranscribe Tests', () => {
    it('Sample VoiceMailTranscribe tests', () => {
        expect(handler.hasOwnProperty('handler')).toEqual(true);
    });
});