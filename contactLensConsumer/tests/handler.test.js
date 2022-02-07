handler = require('../handler');

jest.mock('../utils');
const utils = require('../utils.js');

jest.mock('../telephonyIntegrationApi');
const api = require('../telephonyIntegrationApi');

afterEach(() => {    
  jest.clearAllMocks();
});

describe('Lambda handler', () => {
  it('successfully handles Kinesis event', async () => {
    const record = '{"Version":"1.0.0","Channel":"VOICE","AccountId":"698414421362","InstanceId":"4defbdc5-3029-456e-9bf3-a0d168cf409c","ContactId":"d5187cb8-f83f-471d-b724-bfb242b34b59","LanguageCode":"en-US","EventType":"SEGMENTS","Segments":[{"Transcript":{"ParticipantId":"AGENT","ParticipantRole":"AGENT","Content":"Testing.","BeginOffsetMillis":19230,"EndOffsetMillis":19855,"Id":"5a859b25-e047-454f-b47f-c78ee2a33f08","Sentiment":"NEUTRAL","IssuesDetected":[]}}]}';
    const event = { Records: [{ kinesis: { data: new Buffer.from(record).toString('base64') } }] };
    const expectedResponse = { result: 'Success' };

    api.sendMessage.mockImplementationOnce(() => Promise.resolve(expectedResponse));

    await expect(await handler.handler(event)).toMatchObject([expectedResponse]);
  });
})
