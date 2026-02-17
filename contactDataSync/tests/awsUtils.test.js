const awsUtils = require('../awsUtils');
const aws = require('aws-sdk');
const SCVLoggingUtil = require('../SCVLoggingUtil');

jest.mock('aws-sdk', () => {
  const Lambda = jest.fn(() => ({ invoke: jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue('lambdaResult') }) }));
  const Connect = jest.fn(() => ({ describeContact: jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue({ Contact: { InitiationTimestamp: new Date().toISOString(), AgentInfo: {} } }) }) }));
  const S3 = jest.fn(() => ({ getObject: jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue({ Body: Buffer.from('{}') }) }), listObjectsV2: jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue({ Contents: [{ Key: 'file1' }] }) }) }));
  return { Lambda, Connect, S3 };
});
jest.mock('../SCVLoggingUtil');

describe('awsUtils', () => {
  it('getTranscript returns conversation entries', async () => {
    const clObject = { CustomerMetadata: { ContactId: 'cid', InstanceId: 'iid' }, Transcript: [{ Id: 'id', BeginOffsetMillis: 0, ParticipantId: 'CUSTOMER', Content: 'hi' }], };
    const map = { cid: ['rec'] };
    const result = await awsUtils.getTranscript(clObject, map);
    expect(Array.isArray(result)).toBe(true);
  });
  it('getContactLensS3Path returns file paths', async () => {
    const eventPayload = [{ contactId: 'cid' }];
    const result = await awsUtils.getContactLensS3Path('bucket', eventPayload, 'iid');
    expect(Array.isArray(result)).toBe(true);
  });
  it('getS3Object returns S3 object', async () => {
    const params = { Bucket: 'bucket', Key: 'key' };
    const result = await awsUtils.getS3Object(params);
    expect(result).toBeDefined();
  });
  it('invokeLambdaFunction returns lambda result', async () => {
    const params = { FunctionName: 'fn', Payload: '{}' };
    const result = await awsUtils.invokeLambdaFunction(params);
    expect(result).toBe('lambdaResult');
  });
});