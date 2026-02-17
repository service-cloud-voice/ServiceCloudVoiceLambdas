const axios = require('axios');
const logger = require('axios-logger');

// Mock axios and logger
jest.mock('axios');
jest.mock('axios-logger');

const { getScrtEndpoint } = require('../axiosWrapper');

describe('getScrtEndpoint', () => {
  let createMock;
  let instanceMock;

  beforeEach(() => {
    instanceMock = {
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    };
    createMock = jest.fn().mockReturnValue(instanceMock);
    axios.create = createMock;
    process.env.LOG_LEVEL = ''; // default
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.LOG_LEVEL;
  });

  it('should create an axios instance with the correct baseURL', () => {
    const configData = { scrtEndpointBase: 'https://example.com' };
    const result = getScrtEndpoint(configData);

    expect(axios.create).toHaveBeenCalledWith({ baseURL: 'https://example.com' });
    expect(result).toBe(instanceMock);
  });

  it('should not set up logger interceptors if LOG_LEVEL is not debug', () => {
    const configData = { scrtEndpointBase: 'https://example.com' };
    getScrtEndpoint(configData);

    expect(instanceMock.interceptors.request.use).not.toHaveBeenCalled();
    expect(instanceMock.interceptors.response.use).not.toHaveBeenCalled();
  });

  it('should set up logger interceptors if LOG_LEVEL is debug', () => {
    process.env.LOG_LEVEL = 'debug';
    const configData = { scrtEndpointBase: 'https://example.com' };
    getScrtEndpoint(configData);

    expect(instanceMock.interceptors.request.use).toHaveBeenCalledWith(
      logger.requestLogger,
      logger.errorLogger
    );
    expect(instanceMock.interceptors.response.use).toHaveBeenCalledWith(
      logger.responseLogger,
      logger.errorLogger
    );
  });
});