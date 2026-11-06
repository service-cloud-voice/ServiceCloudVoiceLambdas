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

const connect = aws.Connect.mock.results[0].value;
const s3 = aws.S3.mock.results[0].value;
const describedContact = (contact) => ({ promise: jest.fn().mockResolvedValue({ Contact: contact }) });

describe('awsUtils', () => {
  it('getTranscript returns conversation entries', async () => {
    const clObject = { CustomerMetadata: { ContactId: 'cid', InstanceId: 'iid' }, Transcript: [{ Id: 'id', BeginOffsetMillis: 0, ParticipantId: 'CUSTOMER', Content: 'hi' }], };
    const map = { cid: ['rec'] };
    const result = await awsUtils.getTranscript(clObject, map);
    expect(Array.isArray(result)).toBe(true);
  });
  it('getTranscript times each entry from when the agent connected, not cumulatively', async () => {
    const initiation = Date.parse('2026-10-29T00:52:28.700Z');
    const agentConnected = Date.parse('2026-10-29T00:52:53.300Z');
    connect.describeContact.mockReturnValueOnce(describedContact({
      InitiationTimestamp: new Date(initiation).toISOString(),
      AgentInfo: { ConnectedToAgentTimestamp: new Date(agentConnected).toISOString() },
    }));
    const clObject = {
      CustomerMetadata: { ContactId: 'cid', InstanceId: 'iid' },
      Transcript: [
        { Id: 't1', BeginOffsetMillis: 3000, ParticipantId: 'AGENT', Content: 'hello' },
        { Id: 't2', BeginOffsetMillis: 5000, ParticipantId: 'CUSTOMER', Content: 'hi' },
        { Id: 't3', BeginOffsetMillis: 6000, ParticipantId: 'AGENT', Content: 'how can I help' },
      ],
    };
    const result = await awsUtils.getTranscript(clObject, { cid: ['rec'] });
    expect(result.map((entry) => entry.payload.clientSentTimestamp)).toEqual([
      agentConnected + 3000,
      agentConnected + 5000,
      agentConnected + 6000,
    ]);
  });
  it.each([
    ['answered just after midnight UTC', '2026-10-28T23:59:30.000Z', '2026-10-29T00:00:10.000Z'],
    ['answered late in the UTC day', '2026-10-29T16:29:00.000Z', '2026-10-29T16:30:00.000Z'],
  ])('getContactLensS3Path looks in the UTC date folder of when the agent connected (%s)', async (_case, initiation, agentConnected) => {
    connect.describeContact.mockReturnValueOnce(describedContact({
      InitiationTimestamp: initiation,
      AgentInfo: { ConnectedToAgentTimestamp: agentConnected },
    }));
    const key = 'Analysis/Voice/2026/10/29/cid_analysis_2026-10-29T00:00:10Z.json';
    s3.listObjectsV2.mockReturnValueOnce({ promise: jest.fn().mockResolvedValue({ Contents: [{ Key: key }] }) });
    const result = await awsUtils.getContactLensS3Path('bucket', [{ contactId: 'cid' }], 'iid');
    expect(s3.listObjectsV2.mock.calls[0][0].Prefix).toBe('Analysis/Voice/2026/10/29/');
    expect(result).toEqual([key]);
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