const sfRestApi = require('../sfRestApi');
const awsUtils = require('../awsUtils');
const config = require('../config');

jest.mock('../awsUtils');
jest.mock('../config', () => ({ invokeSfRestApiArn: 'arn:lambda:sfRestApi' }));

describe('sfRestApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('invokeSfRestApiUploadTranscript calls awsUtils.invokeLambdaFunction with correct params', async () => {
    awsUtils.invokeLambdaFunction.mockResolvedValue('result');
    const batch = new Map([['cid', 'payload']]);
    const result = await sfRestApi.invokeSfRestApiUploadTranscript(batch, 'secret', 'accessToken');
    expect(awsUtils.invokeLambdaFunction).toHaveBeenCalledWith(expect.objectContaining({
      FunctionName: 'arn:lambda:sfRestApi',
      Payload: expect.any(String),
    }));
    expect(result).toBe('result');
  });
  it('invokeSfRestApiFetchUploadIdsStatus calls awsUtils.invokeLambdaFunction with correct params', async () => {
    awsUtils.invokeLambdaFunction.mockResolvedValue('result');
    const result = await sfRestApi.invokeSfRestApiFetchUploadIdsStatus(['id1'], 'secret', 'accessToken');
    expect(awsUtils.invokeLambdaFunction).toHaveBeenCalledWith(expect.objectContaining({
      FunctionName: 'arn:lambda:sfRestApi',
      Payload: expect.any(String),
    }));
    expect(result).toBe('result');
  });
});