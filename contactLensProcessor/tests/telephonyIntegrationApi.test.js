const api = require('../telephonyIntegrationApi');
const axios = require("axios");
const logger = require("axios-logger");

const secretUtils = require("../secretUtils");
jest.mock('../axiosWrapper');
const axiosWrapper = require('../axiosWrapper');

jest.mock('../utils');
const utils = require('../utils.js');

const secretStringJson = `{
    "CALL_CENTER_API_NAME": "multiorgscc2",
    "SALESFORCE_AUTH_ENDPOINT": "https://stmhb-ari-demo3.test2.my.pc-rnd.salesforce.com/services/oauth2/token",
    "SALESFORCE_ORG_ID": "00DZN000000CoCT",
    "SALESFORCE_REST_API_ENDPOINT_BASE": "https://stmhb-ari-demo3.test2.my.pc-rnd.salesforce.com/services/data/v54.0",
    "SCRT_ENDPOINT_BASE": "https://stmhb-ari-demo3.test2.my.pc-rnd.salesforce-scrt.com/telephony/v1",
    "TRANSCRIBE_REGION": "us-west-2",
    "multiorgscc2-salesforce-rest-api-access-token": "salesforce-rest-api-auth-access-token-key-value",
    "multiorgscc2-salesforce-rest-api-audience": "https://stmhb-ari-demo3.test2.my.pc-rnd.salesforce.com/",
    "multiorgscc2-salesforce-rest-api-auth-consumer-key": "3MVG9jO2DZUSOpAVn27areCr0lJ.8kc7KYk_82sh2ky3VofeRC775fdwAchRSp_U7TSaQQOGHgui_IETIYfJs",
    "multiorgscc2-salesforce-rest-api-auth-private-key": "test_auth_private_key",
    "multiorgscc2-salesforce-rest-api-subject": "admin@stmhb-ari-demo3.com",
    "multiorgscc2-scrt-jwt-auth-private-key": "test_private_key"
}`;
jest.mock('axios');
jest.mock('aws-sdk', () => {
    const mSecretsManager = {
        getSecretValue: jest.fn().mockReturnThis(),
        promise: jest.fn().mockResolvedValue({ SecretString: secretStringJson })
    };
    return {
        SecretsManager: jest.fn(() => mSecretsManager)
    };
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('SendMessagesInBulk API', () => {
  it('successfully sends bulk transcripts', async () => {
    const expectedResponse = { data: { result: "Success" } };
    utils.generateJWT.mockImplementationOnce(() => Promise.resolve('jwt'));
    const mockPost = jest.fn(() => Promise.resolve({ data: expectedResponse }));
    axiosWrapper.getScrtEndpoint.mockImplementation(() => ({ post: mockPost }));

    await expect(await api.sendMessagesInBulk({ secretName: 'test_secret_name' })).toEqual(expectedResponse);
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
    const mockPost = jest.fn(() => Promise.reject(error));
    axiosWrapper.getScrtEndpoint.mockImplementation(() => ({ post: mockPost }));

    await expect(await api.sendMessagesInBulk( { secretName: 'test_secret_name' })).toEqual(expectedResponse);
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
    const mockPost = jest.fn(() => Promise.reject(error));
    axiosWrapper.getScrtEndpoint.mockImplementation(() => ({ post: mockPost }));
    await expect(await api.sendMessagesInBulk( { secretName: 'test_secret_name' })).toEqual(expectedResponse);
  });
})

describe('SendRealtimeConversationEvents API', () => {
  it('successfully sent realtime conversation events', async () => {
    const expectedResponse = { data: { result: "Success" } };
    utils.generateJWT.mockImplementationOnce(() => Promise.resolve('jwt'));
    const mockPost = jest.fn(() => Promise.resolve({ data: expectedResponse }));
    axiosWrapper.getScrtEndpoint.mockImplementation(() => ({ post: mockPost }));

    await expect(await api.sendRealtimeConversationEvents('contactId', {}, 'test_secret_name')).toEqual(expectedResponse);
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
    const mockPost = jest.fn(() => Promise.reject(error));
    axiosWrapper.getScrtEndpoint.mockImplementation(() => ({ post: mockPost }));

    await expect(await api.sendRealtimeConversationEvents('contactId', {}, 'test_secret_name')).toEqual(expectedResponse);
  });
})
