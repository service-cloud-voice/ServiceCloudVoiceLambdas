require('dotenv').config()
const config = require('../config.js');
jest.mock("../axiosWrapper");
const axiosWrapper = require("../axiosWrapper.js");

jest.mock("../utils");
const utils = require("../utils.js");

jest.mock("../secretUtils");
const secretUtils = require("../secretUtils.js");

const queryEngine = require('../queryEngine.js');
const api = require('../sfRestApi.js');

jest.mock('jsonwebtoken');
const jwt = require('jsonwebtoken');

afterEach(() => {
  jest.clearAllMocks();
});

describe('InvalidConsumerKey', ()=> {
    it('Invalid consumer Key configured', async () => {
        const data = {
            id: "1234",
            errors: [],
            success: true
        };
        const error = {
            response: {
                success: false,
                status: 400,
                statusText: 'Bad Request',
                data: {
                    error: "invalid_client_id",
                    error_description: "client identifier invalid"
                }
            }
        }
        const configs = {
            callCenterApiName: "callCenterApiNameVal",
            baseURL: "baseURLVal",
            authEndpoint: "authEndpointVal",
            consumerKey: "consumerKeyVal",
            privateKey: "privateKeyVal",
            audience: "audienceVal",
            subject: "subjectVal"
        };

        secretUtils.getSecretConfigs.mockImplementationOnce(() => Promise.resolve(configs));
        utils.getAccessToken.mockImplementationOnce(() => Promise.reject(error));
        axiosWrapper.apiEndpoint.mockImplementationOnce(() => Promise.resolve(error));

        const errorResponse = {
            success: false,
            status: 400,
            statusText: 'Bad Request',
            errorCode: 'invalid_client_id',
            errorMessage: 'client identifier invalid'
        }

        await expect(await api.createRecord(('Account', { Name: 'Test Account 1' }))).toEqual(errorResponse);
    });
    it('Invalid Private Key configured', async () => {
        const data = {
            id: "1234",
            errors: [],
            success: true
        };
        const error = {
            code: "ERR_OSSL_PEM_BAD_END_LINE",
            reason: "bad end line"
        }
        const configs = {
            callCenterApiName: "callCenterApiNameVal",
            baseURL: "baseURLVal",
            authEndpoint: "authEndpointVal",
            consumerKey: "consumerKeyVal",
            privateKey: "privateKeyVal",
            audience: "audienceVal",
            subject: "subjectVal"
        };

        secretUtils.getSecretConfigs.mockImplementationOnce(() => Promise.resolve(configs));
        utils.getAccessToken.mockImplementationOnce(() => Promise.reject(error));
        axiosWrapper.authEndpoint.mockImplementationOnce(() => Promise.resolve(error));

        const errorResponse = {
            success: false,
            status: 500,
            statusText: 'ERR_OSSL_PEM_BAD_END_LINE',
            errorMessage: 'bad end line',
            errorCode: 'ERR_OSSL_PEM_BAD_END_LINE'
        }

        await expect(await api.createRecord(('Account', { Name: 'Test Account 1' }))).toEqual(errorResponse);
    });
    it('Invalid Audience', async () => {
        const data = {
            id: "1234",
            errors: [],
            success: true
        };
        const error = {
            response: {
                success: false,
                status: 400,
                statusText: 'Bad Request',
                data: {
                      error: "invalid_grant",
                      error_description: "audience is invalid"
                }
            }
        }
        const configs = {
            callCenterApiName: "callCenterApiNameVal",
            baseURL: "baseURLVal",
            authEndpoint: "authEndpointVal",
            consumerKey: "consumerKeyVal",
            privateKey: "privateKeyVal",
            audience: "audienceVal",
            subject: "subjectVal"
        };

        secretUtils.getSecretConfigs.mockImplementationOnce(() => Promise.resolve(configs));
        utils.getAccessToken.mockImplementationOnce(() => Promise.reject(error));
        axiosWrapper.authEndpoint.mockImplementationOnce(() => Promise.resolve(error));

        const errorResponse = {
            success: false,
            status: 400,
            statusText: 'Bad Request',
            errorMessage: 'audience is invalid',
            errorCode: 'invalid_grant'
        }

        await expect(await api.createRecord(('Account', { Name: 'Test Account 1' }))).toEqual(errorResponse);
    });
    it('Invalid Subject', async () => {
        const data = {
            id: "1234",
            errors: [],
            success: true
        };
        const error = {
            response: {
                success: false,
                status: 400,
                statusText: 'Bad Request',
                data: {
                      error: "invalid_grant",
                      error_description: "user hasn't approved this consume"
                }
            }
        }
        const configs = {
            callCenterApiName: "callCenterApiNameVal",
            baseURL: "baseURLVal",
            authEndpoint: "authEndpointVal",
            consumerKey: "consumerKeyVal",
            privateKey: "privateKeyVal",
            audience: "audienceVal",
            subject: "subjectVal"
        };

        secretUtils.getSecretConfigs.mockImplementationOnce(() => Promise.resolve(configs));
        utils.getAccessToken.mockImplementationOnce(() => Promise.reject(error));
        axiosWrapper.authEndpoint.mockImplementationOnce(() => Promise.resolve(error));

        const errorResponse = {
            success: false,
            status: 400,
            statusText: 'Bad Request',
            errorMessage: "user hasn't approved this consume",
            errorCode: 'invalid_grant'
        }

        await expect(await api.createRecord(('Account', { Name: 'Test Account 1' }))).toEqual(errorResponse);
    });
})