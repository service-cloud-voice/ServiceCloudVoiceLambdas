const handler = require('../handler');

jest.mock('aws-sdk');

describe('VoiceMailPackaging Tests', () => {
    it('Sample VoiceMailPackaging tests', () => {
        expect(handler.hasOwnProperty('handler')).toEqual(true);
    });
});