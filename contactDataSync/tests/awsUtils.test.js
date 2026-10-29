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

const s3 = aws.S3.mock.results[0].value;
const listedObjects = (keys) => ({ promise: jest.fn().mockResolvedValue({ Contents: keys.map((Key) => ({ Key })) }) });

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
  it('getContactLensS3Path reads the original analysis files by default', async () => {
    const original = 'Analysis/Voice/2026/10/29/cid_analysis_2026-10-29T00:22:43Z.json';
    s3.listObjectsV2.mockReturnValueOnce(listedObjects([original]));
    const result = await awsUtils.getContactLensS3Path('bucket', [{ contactId: 'cid' }], 'iid');
    expect(s3.listObjectsV2.mock.calls[0][0].Prefix).toMatch(/^Analysis\/Voice\/\d{4}\/\d{2}\/\d{2}\/$/);
    expect(result).toEqual([original]);
  });
  it('getContactLensS3Path reads the redacted analysis files and skips redacted recordings', async () => {
    const redacted = 'Analysis/Voice/Redacted/2026/10/29/cid_analysis_redacted_2026-10-29T00:22:43Z.json';
    s3.listObjectsV2.mockReturnValueOnce(listedObjects([
      redacted,
      'Analysis/Voice/Redacted/2026/10/29/cid_call_recording_redacted_2026-10-29T00:22:43Z.wav',
      'Analysis/Voice/Redacted/2026/10/29/other_analysis_redacted_2026-10-29T00:22:43Z.json',
    ]));
    const result = await awsUtils.getContactLensS3Path('bucket', [{ contactId: 'cid' }], 'iid', true);
    expect(s3.listObjectsV2.mock.calls[0][0].Prefix).toMatch(/^Analysis\/Voice\/Redacted\/\d{4}\/\d{2}\/\d{2}\/$/);
    expect(result).toEqual([redacted]);
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