const handler = require('../handler');

jest.mock('../telephonyIntegrationApi');
const api = require('../telephonyIntegrationApi');

const signalConfig = require('../signalConfig');
const config = require('../config');

const s3ResponseRecord = '{"Version":"1.1.0","AccountId":"670991668472","Channel":"VOICE","ContentMetadata":{"Output":"Raw"},"JobStatus":"COMPLETED","LanguageCode":"en-US","Participants":[{"ParticipantId":"AGENT","ParticipantRole":"AGENT"},{"ParticipantId":"CUSTOMER","ParticipantRole":"CUSTOMER"}],"Categories":{"MatchedCategories":[],"MatchedDetails":{}},"ConversationCharacteristics":{"TotalConversationDurationMillis":86727,"Sentiment":{"OverallSentiment":{"AGENT":0,"CUSTOMER":0.8},"SentimentByPeriod":{"QUARTER":{"AGENT":[{"BeginOffsetMillis":0,"EndOffsetMillis":21681,"Score":0},{"BeginOffsetMillis":21681,"EndOffsetMillis":43363,"Score":0},{"BeginOffsetMillis":43363,"EndOffsetMillis":65045,"Score":5},{"BeginOffsetMillis":65045,"EndOffsetMillis":86727,"Score":-2.5}],"CUSTOMER":[{"BeginOffsetMillis":0,"EndOffsetMillis":20983,"Score":1.3},{"BeginOffsetMillis":20983,"EndOffsetMillis":41967,"Score":0},{"BeginOffsetMillis":41967,"EndOffsetMillis":62951,"Score":0},{"BeginOffsetMillis":62951,"EndOffsetMillis":83935,"Score":0}]}}},"Interruptions":{"InterruptionsByInterrupter":{},"TotalCount":0,"TotalTimeMillis":0},"NonTalkTime":{"TotalTimeMillis":67489,"Instances":[{"BeginOffsetMillis":3095,"DurationMillis":4802,"EndOffsetMillis":7897},{"BeginOffsetMillis":15387,"DurationMillis":11103,"EndOffsetMillis":26490},{"BeginOffsetMillis":28927,"DurationMillis":8073,"EndOffsetMillis":37000},{"BeginOffsetMillis":37705,"DurationMillis":20475,"EndOffsetMillis":58180},{"BeginOffsetMillis":58567,"DurationMillis":19813,"EndOffsetMillis":78380},{"BeginOffsetMillis":78727,"DurationMillis":3223,"EndOffsetMillis":81950}]},"TalkSpeed":{"DetailsByParticipant":{"AGENT":{"AverageWordsPerMinute":109},"CUSTOMER":{"AverageWordsPerMinute":184}}},"TalkTime":{"TotalTimeMillis":12521,"DetailsByParticipant":{"AGENT":{"TotalTimeMillis":8282},"CUSTOMER":{"TotalTimeMillis":4239}}}},"CustomModels":[],"Transcript":[{"BeginOffsetMillis":2540,"Content":"Mhm.","EndOffsetMillis":2975,"Id":"0a174aab-13c2-4fee-952c-247ec8bb0e53","ParticipantId":"AGENT","Sentiment":"NEUTRAL","LoudnessScore":[74.12]},{"BeginOffsetMillis":2580,"Content":"Mhm.","EndOffsetMillis":3095,"Id":"942384ef-b973-4a74-98d8-ab4d1c242dfc","ParticipantId":"CUSTOMER","Sentiment":"NEUTRAL","LoudnessScore":[71.74,0]},{"BeginOffsetMillis":7897,"Content":"Okay? Hoping","EndOffsetMillis":11267,"Id":"83a6823a-4785-44cf-9e80-7df06d14f49a","ParticipantId":"AGENT","Sentiment":"NEUTRAL","LoudnessScore":[0,82.33,87.64,85.61,77.3]},{"BeginOffsetMillis":10720,"Content":"I hope you got","EndOffsetMillis":11555,"Id":"9bd11b62-b037-4eb4-b913-97afa80db221","ParticipantId":"CUSTOMER","Sentiment":"POSITIVE","LoudnessScore":[70.07,75.64]},{"BeginOffsetMillis":12490,"Content":"I hear my voice.","EndOffsetMillis":13345,"Id":"849c8f02-43e4-4cf4-9133-4f892efc89a1","ParticipantId":"CUSTOMER","Sentiment":"NEUTRAL","LoudnessScore":[72.64,74.34]},{"BeginOffsetMillis":12537,"Content":"Bye.","EndOffsetMillis":13017,"Id":"d6531f7d-06a6-4a75-bace-0098eaa4f93c","ParticipantId":"AGENT","Sentiment":"NEUTRAL","LoudnessScore":[74.77,74.17]},{"BeginOffsetMillis":14860,"Content":"Hello.","EndOffsetMillis":15325,"Id":"93083968-e918-4b7e-b972-d0da056657c6","ParticipantId":"AGENT","Sentiment":"NEUTRAL","LoudnessScore":[72.04,0]},{"BeginOffsetMillis":14870,"Content":"Hello.","EndOffsetMillis":15387,"Id":"db39cad1-0e08-4406-b08d-67eea9273731","ParticipantId":"CUSTOMER","Sentiment":"NEUTRAL","LoudnessScore":[69.4,0]},{"BeginOffsetMillis":26490,"Content":"Okay? Mm.","EndOffsetMillis":28927,"Id":"42113973-a4fc-49b5-8469-107e18f9a74e","ParticipantId":"AGENT","Sentiment":"NEUTRAL","LoudnessScore":[49.25,55.12,51.24]},{"BeginOffsetMillis":37000,"Content":"Hello.","EndOffsetMillis":37665,"Id":"0902e330-f6eb-4e6c-b1a8-ff812ed650b7","ParticipantId":"AGENT","Sentiment":"NEUTRAL","LoudnessScore":[78.08]},{"BeginOffsetMillis":37220,"Content":"So","EndOffsetMillis":37705,"Id":"ef189545-1aec-49dc-a41d-306fbb2d9322","ParticipantId":"CUSTOMER","Sentiment":"NEUTRAL","LoudnessScore":[76.03]},{"BeginOffsetMillis":58180,"Content":"Cool.","EndOffsetMillis":58567,"Id":"4cde6c89-bc55-420d-9aaa-01120541cb13","ParticipantId":"AGENT","Sentiment":"POSITIVE","LoudnessScore":[58.69]},{"BeginOffsetMillis":78380,"Content":"Okay? Oh,","EndOffsetMillis":83065,"Id":"4087cdef-ed9d-4466-859d-de263bf459fd","ParticipantId":"AGENT","Sentiment":"NEUTRAL","LoudnessScore":[53.85,0,0,0,63.78,58.58]},{"BeginOffsetMillis":82070,"Content":"Oh, Okay?","EndOffsetMillis":83935,"Id":"315e1e8d-c4a9-450a-be70-6d7299f0b1b8","ParticipantId":"CUSTOMER","Sentiment":"NEUTRAL","LoudnessScore":[59.97,54.81]},{"BeginOffsetMillis":83460,"Content":"Call back. Bye bye.","EndOffsetMillis":86727,"Id":"7856b68a-4a6a-4891-9a97-c1e5490bd508","ParticipantId":"AGENT","Sentiment":"NEGATIVE","LoudnessScore":[58.58,81.09,54.21,58.63]}],"CustomerMetadata":{"InputS3Uri":"s3://contactlenscenter-670991668472/ContactLensCenter00DRM000000LYFc/2022/06/22/7c77422d-f9ba-4111-ad48-b2f5dadf854a_20220622T16:55_UTC.wav","ContactId":"7c77422d-f9ba-4111-ad48-b2f5dadf854a","InstanceId":"5f046746-5931-45cc-a614-43b75eca2a5f"}}';
const describeContactResponse = {
    Contact: {
        Arn: "arn:aws:connect:us-west-2:670991668472:instance/5f046746-5931-45cc-a614-43b75eca2a5f/contact/7f42267c-d99b-42e6-870a-17ad0b657a2c",
        Id: "7f42267c-d99b-42e6-870a-17ad0b657a2c",
        InitiationMethod: "OUTBOUND",
        Channel: "VOICE",
        AgentInfo: {
          Id: "f94517c7-9193-4da0-a4e9-7fc7a86042f6",
          ConnectedToAgentTimestamp: "2022-03-31T00:03:57.439Z"
        },
        InitiationTimestamp: "2022-03-31T00:03:41.153Z",
        DisconnectTimestamp: "2022-03-31T00:06:48.667Z",
        LastUpdateTimestamp: "2022-03-31T00:06:48.668Z"
    },
};

jest.mock('../utils', () => ({
  sliceIntoChunks: jest.requireActual('../utils').sliceIntoChunks,
  sentimentNormalizer: jest.requireActual('../utils').sentimentNormalizer,
  validateS3KeyName: () => true,
  getAgentTimestamp: () => describeContactResponse
}));
const utils = require('../utils');

jest.mock('aws-sdk', () => {
    return {
        S3: jest.fn(() => ({
          getObject: jest.fn(() => ({
            promise: jest.fn().mockResolvedValue({Body: s3ResponseRecord}),
          })),
        })),
        Connect: jest.fn(() => ({
            describeContact: jest.fn(() => ({
              promise: jest.fn().mockResolvedValue(describeContactResponse),
            })),
          })),
        SecretsManager: jest.fn(() => ({
          getSecretValue: jest.fn(() => ({
            promise: jest.fn().mockResolvedValue({
              SecretString: JSON.stringify({
                SALESFORCE_ORG_ID: 'test-org-id',
                SCRT_ENDPOINT_BASE: 'https://test-scrt.com',
                CALL_CENTER_API_NAME: 'test-api',
                'test-api-scrt-jwt-auth-private-key': 'test-private-key'
              })
            })
          }))
        }))
    }
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('Post Call Analysis Trigger Lambda handler', () => {
    /*
    Sample Contact Lens Post-call Analysis File Payload

    {
        "Version": "1.1.0",
        "AccountId": "670991668472",
        "Channel": "VOICE",
        "ContentMetadata": {
          "Output": "Raw"
        },
        "JobStatus": "COMPLETED",
        "LanguageCode": "en-US",
        "Participants": [
          {
            "ParticipantId": "AGENT",
            "ParticipantRole": "AGENT"
          },
          {
            "ParticipantId": "CUSTOMER",
            "ParticipantRole": "CUSTOMER"
          }
        ],
        "Categories": {
          "MatchedCategories": [],
          "MatchedDetails": {}
        },
        "ConversationCharacteristics": {
          "TotalConversationDurationMillis": 86727,
          "Sentiment": {
            "OverallSentiment": {
              "AGENT": 0,
              "CUSTOMER": 0.8
            },
            "SentimentByPeriod": {
              "QUARTER": {
                "AGENT": [
                  {
                    "BeginOffsetMillis": 0,
                    "EndOffsetMillis": 21681,
                    "Score": 0
                  },
                  {
                    "BeginOffsetMillis": 21681,
                    "EndOffsetMillis": 43363,
                    "Score": 0
                  }
                ],
                "CUSTOMER": [
                  {
                    "BeginOffsetMillis": 0,
                    "EndOffsetMillis": 20983,
                    "Score": 1.3
                  },
                  {
                    "BeginOffsetMillis": 20983,
                    "EndOffsetMillis": 41967,
                    "Score": 0
                  }
                ]
              }
            }
          },
          "Interruptions": {
            "InterruptionsByInterrupter": {},
            "TotalCount": 0,
            "TotalTimeMillis": 0
          },
          "NonTalkTime": {
            "TotalTimeMillis": 67489,
            "Instances": [
              {
                "BeginOffsetMillis": 3095,
                "DurationMillis": 4802,
                "EndOffsetMillis": 7897
              }
            ]
          },
          "TalkSpeed": {
            "DetailsByParticipant": {
              "AGENT": {
                "AverageWordsPerMinute": 109
              },
              "CUSTOMER": {
                "AverageWordsPerMinute": 184
              }
            }
          },
          "TalkTime": {
            "TotalTimeMillis": 12521,
            "DetailsByParticipant": {
              "AGENT": {
                "TotalTimeMillis": 8282
              },
              "CUSTOMER": {
                "TotalTimeMillis": 4239
              }
            }
          }
        },
        "CustomModels": [],
        "Transcript": [
          {
            "BeginOffsetMillis": 2540,
            "Content": "Mhm.",
            "EndOffsetMillis": 2975,
            "Id": "0a174aab-13c2-4fee-952c-247ec8bb0e53",
            "ParticipantId": "AGENT",
            "Sentiment": "NEUTRAL",
            "LoudnessScore": [
              74.12
            ]
          },
          {
            "BeginOffsetMillis": 2580,
            "Content": "Mhm.",
            "EndOffsetMillis": 3095,
            "Id": "942384ef-b973-4a74-98d8-ab4d1c242dfc",
            "ParticipantId": "CUSTOMER",
            "Sentiment": "NEUTRAL",
            "LoudnessScore": [
              71.74,
              0
            ]
          }
        ],
        "CustomerMetadata": {
          "InputS3Uri": "s3://contactlenscenter-670991668472/ContactLensCenter00DRM000000LYFc/2022/06/22/7c77422d-f9ba-4111-ad48-b2f5dadf854a_20220622T16:55_UTC.wav",
          "ContactId": "7c77422d-f9ba-4111-ad48-b2f5dadf854a",
          "InstanceId": "5f046746-5931-45cc-a614-43b75eca2a5f"
        }
      }
      **/
  it('successfully triggered batch send lambda to SCRT', async () => {
    const event = {
      version: "0",
      id: "ea2a95c1-ffb0-995e-058d-ce2d88053edd",
      detailType: "Object Created",
      source: "aws.s3",
      account: "694266641768",
      time: "2022-07-13T21:19:49Z",
      region: "ap-southeast-1",
      resources: ["arn:aws:s3:::tansings-694266641768"],
      detail: {
        version: "0",
        bucket: {
          name: "tansings-694266641768",
        },
        object: {
          key: "Analysis/Voice/2022/03/30/4aff0437-fda0-4f80-95a9-08b9e5924997_analysis_2022-03-30T23:55:23Z.json",
          size: 1154,
          etag: "2f27d903ba9c2945fef2f6254ef9f235",
          versionId: "jCWdUm4G3CgC6s1cBG5CQuq_6cCHeB1L",
          sequencer: "0062CF36F4EAD5355A",
        },
        requestId: "GGZGM0MDA90AEFX0",
        requester: "694266641768",
        sourceIpAddress: "204.14.236.152",
        reason: "PutObject",
      },
    };
    const expectedResponse = { result: 'Success' };

    api.persistSignals.mockImplementationOnce(() => Promise.resolve(expectedResponse));
    await handler.handler(event);
    expect(handler.getOverallBatchCount()).toBe(handler.getCurrentBatchCount());
  });

  it('successfully triggers post-call JSON file analysis', async () => {
    const event = {
      version: "0",
      id: "ea2a95c1-ffb0-995e-058d-ce2d88053edd",
      detailType: "Object Created",
      source: "aws.s3",
      account: "694266641768",
      time: "2022-07-13T21:19:49Z",
      region: "ap-southeast-1",
      resources: ["arn:aws:s3:::tansings-694266641768"],
      detail: {
        version: "0",
        bucket: {
          name: "tansings-694266641768",
        },
        object: {
          key: "Analysis/Voice/2022/03/30/4aff0437-fda0-4f80-95a9-08b9e5924997_analysis_2022-03-30T23:55:23Z.json",
          size: 1154,
          etag: "2f27d903ba9c2945fef2f6254ef9f235",
          versionId: "jCWdUm4G3CgC6s1cBG5CQuq_6cCHeB1L",
          sequencer: "0062CF36F4EAD5355A",
        },
        requestId: "GGZGM0MDA90AEFX0",
        requester: "694266641768",
        sourceIpAddress: "204.14.236.152",
        reason: "PutObject",
      },
    };
    const expectedResponse = { result: 'Success' };

    api.persistSignals.mockImplementationOnce(() => Promise.resolve(expectedResponse));
    await expect(await handler.handler(event)).toMatchObject(expectedResponse);
  });
})
