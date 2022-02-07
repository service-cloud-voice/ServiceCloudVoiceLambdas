const handler = require('../handler');

jest.mock('aws-sdk');
const aws = require('aws-sdk');

describe('alert Monitoring Tests', () => {
    it('Sample monitoring tests', () => {
        expect(handler.hasOwnProperty('handler')).toEqual(true);
    });
});
