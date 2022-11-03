const api = require('../telephonyIntegrationApi');

jest.mock('../axiosWrapper');
const axiosWrapper = require('../axiosWrapper');

jest.mock('../utils');
const utils = require('../utils.js');

afterEach(() => {    
  jest.clearAllMocks();
});

describe('SendMessage API', () => {
  it('successfully sends transcript', async () => {
    const expectedResponse = { result: 'Success' };
    utils.generateJWT.mockImplementationOnce(() => Promise.resolve('jwt'));
    axiosWrapper.scrtEndpoint.post.mockImplementationOnce(() => Promise.resolve({ data: expectedResponse }));

    await expect(await api.sendMessage('contactId', {})).toEqual(expectedResponse);
  });

  it('handles error when sending transcript', async () => {
    const expectedResponse = { result: 'Error' };
    utils.generateJWT.mockImplementationOnce(() => Promise.resolve('jwt'));
    axiosWrapper.scrtEndpoint.post.mockImplementationOnce(() => Promise.reject(expectedResponse));

    await expect(await api.sendMessage('contactId', {})).toEqual(expectedResponse);
  });
})

describe('SendRealtimeConversationEvents API', () => {
  it('successfully sent realtime conversation events', async () => {
    const expectedResponse = { result: 'Success' };
    utils.generateJWT.mockImplementationOnce(() => Promise.resolve('jwt'));
    axiosWrapper.scrtEndpoint.post.mockImplementationOnce(() => Promise.resolve({ data: expectedResponse }));

    await expect(await api.sendMessage('contactId', {})).toEqual(expectedResponse);
  });

  it('handles error when sending realtime conversation events', async () => {
    const expectedResponse = { result: 'Error' };
    utils.generateJWT.mockImplementationOnce(() => Promise.resolve('jwt'));
    axiosWrapper.scrtEndpoint.post.mockImplementationOnce(() => Promise.reject(expectedResponse));

    await expect(await api.sendMessage('contactId', {})).toEqual(expectedResponse);
  });
})
