const handler = require('../handler');

jest.mock('aws-sdk');

describe('VoiceMailAudioProcessing Tests', () => {
    it('Sample VoiceMailAudioProcessing tests', () => {
        expect(handler.hasOwnProperty('handler')).toEqual(true);
    });
});