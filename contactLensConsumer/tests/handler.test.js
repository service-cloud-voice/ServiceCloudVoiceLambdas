handler = require('../handler');

const utils = require('../utils.js');

jest.mock('../telephonyIntegrationApi');
const api = require('../telephonyIntegrationApi');

const mockVoiceIntelligencePilotEnabledValueGetter = jest.fn();
jest.mock('../signalConfig', () => ({
  get voiceIntelligencePilotEnabled() {
    return mockVoiceIntelligencePilotEnabledValueGetter();
  },
}));
const config = require('../config');

afterEach(() => {    
  jest.clearAllMocks();
});

describe('Lambda handler', () => {
  it('successfully handles Contact Lens Kinesis event for Utterance', async () => {
    const record = '{"Version":"1.0.0","Channel":"VOICE","AccountId":"698414421362","InstanceId":"4defbdc5-3029-456e-9bf3-a0d168cf409c","ContactId":"d5187cb8-f83f-471d-b724-bfb242b34b59","LanguageCode":"en-US","EventType":"SEGMENTS","Segments":[{"Utterance":{"ParticipantId":"AGENT","ParticipantRole":"AGENT","PartialContent":"Testing.","BeginOffsetMillis":19230,"EndOffsetMillis":19855,"Id":"5a859b25-e047-454f-b47f-c78ee2a33f08","Sentiment":"NEUTRAL","IssuesDetected":[]}}]}';
    const event = { Records: [{ kinesis: { data: new Buffer.from(record).toString('base64') } }] };
    const expectedResponse = { result: 'Success' };

    api.sendMessage.mockImplementationOnce(() => Promise.resolve(expectedResponse));

    await expect(await handler.handler(event)).toMatchObject([expectedResponse]);
  });

  // Sample payload for Categories. If it contains sentiment as part of the rule conditions, the PointsOfInterest property will be empty.
  // {
  //     "Categories": {
  //         "MatchedCategories": [
  //             "Keyword1Test",
  //             "Keyword2Test"
  //         ],
  //         "MatchedDetails": {
  //             "Keyword1Test": {
  //                 "PointsOfInterest": [
  //                     {
  //                         "BeginOffsetMillis": 25130,
  //                         "EndOffsetMillis": 25825
  //                     }
  //                 ]
  //             },
  //             "Keyword2Test": {
  //                 "PointsOfInterest": [
  //                     {
  //                         "BeginOffsetMillis": 25130,
  //                         "EndOffsetMillis": 25825
  //                     }
  //                 ]
  //             }
  //         }
  //     }
  // }
  it('successfully handle Contact Lens event for Categories', async () => {
    const record = '{"Version":"1.0.0","Channel":"VOICE","AccountId":"698414421362","InstanceId":"4defbdc5-3029-456e-9bf3-a0d168cf409c","ContactId":"d5187cb8-f83f-471d-b724-bfb242b34b59","LanguageCode":"en-US","EventType":"SEGMENTS","Segments":[{"Categories":{"MatchedCategories":["keyWord"],"MatchedDetails": {"keyWord": {"PointsOfInterest": [{"BeginOffsetMillis": 5120,"EndOffsetMillis": 15495}]}}}}]}';
    const event = { Records: [{ kinesis: { data: new Buffer.from(record).toString('base64') } }] };
    const expectedResponse = { result: 'Success' };
    mockVoiceIntelligencePilotEnabledValueGetter.mockReturnValue(true);

    api.sendRealtimeConversationEvents.mockImplementationOnce(() => Promise.resolve(expectedResponse));

    await expect(await handler.handler(event)).toMatchObject([expectedResponse]);
  });
})
