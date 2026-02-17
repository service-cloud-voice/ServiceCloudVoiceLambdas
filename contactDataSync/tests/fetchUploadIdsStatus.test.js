const fetchUploadIdsStatus = require('../fetchUploadIdsStatus');
const sfRestApi = require('../sfRestApi');
const SCVLoggingUtil = require('../SCVLoggingUtil');

jest.mock('../sfRestApi');
jest.mock('../SCVLoggingUtil');

describe('fetchUploadIdsStatus', () => {
  it('processFetchUploadIdsStatus calls sfRestApi and returns result', async () => {
    sfRestApi.invokeSfRestApiFetchUploadIdsStatus.mockResolvedValue('result');
    const event = { uploadIds: ['id1', 'id2'], secretName: 'secret', accessTokenSecretName: 'access' };
    const result = await fetchUploadIdsStatus.processFetchUploadIdsStatus(event, 'secret', 'access');
    expect(sfRestApi.invokeSfRestApiFetchUploadIdsStatus).toHaveBeenCalledWith('id1,id2', 'secret', 'access');
    expect(result).toBe('result');
  });
});