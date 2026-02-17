// Mock environment variables before requiring modules
process.env.LOG_LEVEL = 'debug';
process.env.CONTACT_LENS_PROCESSOR_FUNCTION_ARN = 'arn:aws:lambda:us-east-1:123456789012:function:test-processor';
process.env.SECRET_CACHE_S3 = 'test-bucket/cache';

handler = require('../handler');
jest.mock('aws-sdk');
const AWS = require('aws-sdk');
jest.mock('aws-sdk', () => {
    return {
        Lambda: jest.fn(() => ({
          invoke: jest.fn(() => ({
            promise: jest.fn().mockResolvedValue({ result: "Success" }),
          })),
        })),
        S3: jest.fn(() => ({
          getObject: jest.fn(() => ({
            promise: jest.fn().mockResolvedValue({
              Body: Buffer.from(JSON.stringify({ secretName: "test-secret" }))
            }),
          })),
        })),
      }
});

// Store original environment variables
const originalEnv = {
  LOG_LEVEL: process.env.LOG_LEVEL,
  CONTACT_LENS_PROCESSOR_FUNCTION_ARN: process.env.CONTACT_LENS_PROCESSOR_FUNCTION_ARN,
  SECRET_CACHE_S3: process.env.SECRET_CACHE_S3
};

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  // Restore original environment variables
  process.env.LOG_LEVEL = originalEnv.LOG_LEVEL;
  process.env.CONTACT_LENS_PROCESSOR_FUNCTION_ARN = originalEnv.CONTACT_LENS_PROCESSOR_FUNCTION_ARN;
  process.env.SECRET_CACHE_S3 = originalEnv.SECRET_CACHE_S3;
});

describe('Lambda handler', () => {
 it('successfully handles Contact Lens Kinesis event for Utterance', async () => {
    const record = '{"Version":"1.0.0","Channel":"VOICE","AccountId":"698414421362","InstanceId":"4defbdc5-3029-456e-9bf3-a0d168cf409c","ContactId":"d5187cb8-f83f-471d-b724-bfb242b34b59","LanguageCode":"en-US","EventType":"SEGMENTS","Segments":[{"Utterance":{"ParticipantId":"AGENT","ParticipantRole":"AGENT","PartialContent":"Testing.","BeginOffsetMillis":19230,"EndOffsetMillis":19855,"Id":"5a859b25-e047-454f-b47f-c78ee2a33f08","Sentiment":"NEUTRAL","IssuesDetected":[]}}]}';
    const event = { Records: [{ kinesis: { data: new Buffer.from(record).toString('base64') } }] };
    const expectedResponse = { data: { result: "Success" } };

    await expect(await handler.handler(event)).toMatchObject(expectedResponse);
    });

 it('should handle batch size limit exceeding 5 records', async () => {
    const record = '{"Version":"1.0.0","Channel":"VOICE","AccountId":"698414421362","InstanceId":"4defbdc5-3029-456e-9bf3-a0d168cf409c","ContactId":"d5187cb8-f83f-471d-b724-bfb242b34b59","LanguageCode":"en-US","EventType":"SEGMENTS","Segments":[{"Utterance":{"ParticipantId":"AGENT","ParticipantRole":"AGENT","PartialContent":"Testing.","BeginOffsetMillis":19230,"EndOffsetMillis":19855,"Id":"5a859b25-e047-454f-b47f-c78ee2a33f08","Sentiment":"NEUTRAL","IssuesDetected":[]}}]}';
    const event = {
      Records: [
        { kinesis: { data: new Buffer.from(record).toString('base64') } },
        { kinesis: { data: new Buffer.from(record).toString('base64') } },
        { kinesis: { data: new Buffer.from(record).toString('base64') } },
        { kinesis: { data: new Buffer.from(record).toString('base64') } },
        { kinesis: { data: new Buffer.from(record).toString('base64') } },
        { kinesis: { data: new Buffer.from(record).toString('base64') } }
      ]
    };
    const expectedResponse = { data: { result: "Success" } };

    const result = await handler.handler(event);
    expect(result).toMatchObject(expectedResponse);
    });

 it('should handle invalid JSON in kinesis record', async () => {
    const invalidRecord = 'invalid json data';
    const event = { Records: [{ kinesis: { data: new Buffer.from(invalidRecord).toString('base64') } }] };
    const expectedResponse = { data: { result: "Success" } };

    const result = await handler.handler(event);
    expect(result).toMatchObject(expectedResponse);
    });

 it('should handle missing ContactId in record', async () => {
    const recordWithoutContactId = '{"Version":"1.0.0","Channel":"VOICE","AccountId":"698414421362","InstanceId":"4defbdc5-3029-456e-9bf3-a0d168cf409c","LanguageCode":"en-US","EventType":"SEGMENTS","Segments":[{"Utterance":{"ParticipantId":"AGENT","ParticipantRole":"AGENT","PartialContent":"Testing.","BeginOffsetMillis":19230,"EndOffsetMillis":19855,"Id":"5a859b25-e047-454f-b47f-c78ee2a33f08","Sentiment":"NEUTRAL","IssuesDetected":[]}}]}';
    const event = { Records: [{ kinesis: { data: new Buffer.from(recordWithoutContactId).toString('base64') } }] };
    const expectedResponse = { data: { result: "Success" } };

    const result = await handler.handler(event);
    expect(result).toMatchObject(expectedResponse);
    });

 it('should handle event without Records', async () => {
    const event = { someOtherProperty: 'value' };
    const expectedResponse = { data: { result: "Success" } };

    const result = await handler.handler(event);
    expect(result).toMatchObject(expectedResponse);
    });

 it('should handle null/undefined event', async () => {
    const expectedResponse = { data: { result: "Success" } };

    const result1 = await handler.handler(null);
    expect(result1).toMatchObject(expectedResponse);

    const result2 = await handler.handler(undefined);
    expect(result2).toMatchObject(expectedResponse);
    });

 it('should handle S3 cache miss (no secretName found)', async () => {
    // Mock S3 to return null (cache miss)
    const mockS3GetObject = jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Body: Buffer.from(JSON.stringify({})) // Empty object, no secretName
      })
    });

    AWS.S3.mockImplementation(() => ({
      getObject: mockS3GetObject
    }));

    const record = '{"Version":"1.0.0","Channel":"VOICE","AccountId":"698414421362","InstanceId":"4defbdc5-3029-456e-9bf3-a0d168cf409c","ContactId":"d5187cb8-f83f-471d-b724-bfb242b34b59","LanguageCode":"en-US","EventType":"SEGMENTS","Segments":[{"Utterance":{"ParticipantId":"AGENT","ParticipantRole":"AGENT","PartialContent":"Testing.","BeginOffsetMillis":19230,"EndOffsetMillis":19855,"Id":"5a859b25-e047-454f-b47f-c78ee2a33f08","Sentiment":"NEUTRAL","IssuesDetected":[]}}]}';
    const event = { Records: [{ kinesis: { data: new Buffer.from(record).toString('base64') } }] };
    const expectedResponse = { data: { result: "Success" } };

    const result = await handler.handler(event);
    expect(result).toMatchObject(expectedResponse);
    });
})