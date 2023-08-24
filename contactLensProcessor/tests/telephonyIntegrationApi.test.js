const api = require('../telephonyIntegrationApi');

jest.mock('../axiosWrapper');
const axiosWrapper = require('../axiosWrapper');

jest.mock('../utils');
const utils = require('../utils.js');

afterEach(() => {    
  jest.clearAllMocks();
});

describe('SendMessagesInBulk API', () => {
  it('successfully sends bulk transcripts', async () => {
    const expectedResponse = { data: { result: "Success" } };
    utils.generateJWT.mockImplementationOnce(() => Promise.resolve('jwt'));
    axiosWrapper.scrtEndpoint.post.mockImplementationOnce(() => Promise.resolve({ data: expectedResponse }));

    await expect(await api.sendMessagesInBulk({})).toEqual(expectedResponse);
  });

  it('handles error when sending transcript but still sends success response', async () => {
    const expectedResponse = { data: { result: "Success" } };
    const error = {
        response: {
            success: false,
            status: 404
        }
    };
    utils.generateJWT.mockImplementationOnce(() => Promise.resolve('jwt'));
    axiosWrapper.scrtEndpoint.post.mockImplementationOnce(() => Promise.reject(error));

    await expect(await api.sendMessagesInBulk('contactId', {})).toEqual(expectedResponse);
  });

  it('handles 429 error when sending transcript', async () => {
    const expectedResponse = { data: { result: "Success" } };
    const error = {
        response: {
            success: false,
            status: 429
        }
    };
    utils.generateJWT.mockImplementationOnce(() => Promise.resolve('jwt'));
    axiosWrapper.scrtEndpoint.post.mockImplementationOnce(() => Promise.reject(error));
    await expect(await api.sendMessagesInBulk('contactId', {})).toEqual(expectedResponse);
  });
})

describe('SendRealtimeConversationEvents API', () => {
  it('successfully sent realtime conversation events', async () => {
    const expectedResponse = { data: { result: "Success" } };
    utils.generateJWT.mockImplementationOnce(() => Promise.resolve('jwt'));
    axiosWrapper.scrtEndpoint.post.mockImplementationOnce(() => Promise.resolve({ data: expectedResponse }));

    await expect(await api.sendRealtimeConversationEvents('contactId', {})).toEqual(expectedResponse);
  });

  it('handles error when sending realtime conversation events but still sends success response', async () => {
    const expectedResponse = { data: { result: "Success" } };
    const error = {
        response: {
            success: false,
            status: 404
        }
    };
    utils.generateJWT.mockImplementationOnce(() => Promise.resolve('jwt'));
    axiosWrapper.scrtEndpoint.post.mockImplementationOnce(() => Promise.reject(error));

    await expect(await api.sendRealtimeConversationEvents('contactId', {})).toEqual(expectedResponse);
  });
})
