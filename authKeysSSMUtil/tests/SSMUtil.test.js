const handler = require('../index');

jest.mock('aws-sdk');
jest.mock('selfsigned');
jest.mock('aws-param-store');
jest.mock('cfn-response');

describe('SSMUtil Tests', () => {
    it('Sample SSMUtil tests', () => {
        expect(handler.hasOwnProperty('handler')).toEqual(true);
    });
});
