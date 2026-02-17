const transcriptUploader = require('../transcriptUploader');
const awsUtils = require('../awsUtils');
const sfRestApi = require('../sfRestApi');
const config = require('../config');

jest.mock('../awsUtils');
jest.mock('../sfRestApi');
jest.mock('../config', () => ({ batchSize: 2, connectInstanceId: 'inst', s3BucketTenantResources: 'callCenter-12345678' }));

describe('transcriptUploader.processTranscript', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    awsUtils.getContactLensS3Path.mockResolvedValue(['file1', 'file2']);
    awsUtils.getS3Object.mockResolvedValue({ Body: Buffer.from(JSON.stringify({ CustomerMetadata: { ContactId: 'cid', InstanceId: 'inst' }, Transcript: [{ Id: 'id', BeginOffsetMillis: 0, ParticipantId: 'CUSTOMER', Content: 'hi' }], })) });
    awsUtils.getTranscript.mockResolvedValue([{ payload: { conversationId: 'cid' } }]);
    sfRestApi.invokeSfRestApiUploadTranscript.mockResolvedValue('sfResult');
  });
  it('processes transcript and batches calls', async () => {
    const payload = [{ contactId: 'cid', relatedRecords: ['rec'] }];
    const result = await transcriptUploader.processTranscript('acct', payload, 'secret', 'access');
    expect(sfRestApi.invokeSfRestApiUploadTranscript).toHaveBeenCalled();
    expect(result).toContain('sfResult');
  });
  it('handles empty transcript entries', async () => {
    awsUtils.getTranscript.mockResolvedValue([]);
    const payload = [{ contactId: 'cid', relatedRecords: ['rec'] }];
    const result = await transcriptUploader.processTranscript('acct', payload, 'secret', 'access');
    expect(result).toEqual([]);
  });
});