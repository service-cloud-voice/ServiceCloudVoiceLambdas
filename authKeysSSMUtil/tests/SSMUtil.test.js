const handler = require('../index');

jest.mock('aws-sdk');
jest.mock('selfsigned');
jest.mock('../secretUtils');
jest.mock('../SCVLoggingUtil');

// Mock the config module
jest.mock('../config', () => ({
  logLevel: 'info',
  secretName: 'test-secret-name'
}));

const selfsigned = require("selfsigned");
const { readSecret, writeSecret } = require('../secretUtils');

// Mock environment variable
process.env.SECRET_NAME = 'test-secret-name';
process.env.LOG_LEVEL = 'info';

describe('SSMUtil Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        readSecret.mockResolvedValue({});
        writeSecret.mockResolvedValue();
    });

    it('Sample SSMUtil tests', () => {
        expect(handler.hasOwnProperty('handler')).toEqual(true);
    });

    it("Test invalid operation", async () => {
        const event = {
            ResourceProperties: {
                Parameters: {
                    RequestType: "invalid",
                    Details: {
                        SSMParamName: "testSSMParamName"
                    }
                }
            }
        };
        const ssmParamName = event.ResourceProperties.Parameters.Details.SSMParamName;
        const expectedResponse = {
            Success: false,
            Message: `Unsupported requestType along with parameter ${ssmParamName}`
        };
        expect(await handler.handler(event)).toMatchObject(expectedResponse);
    });

    it("Test CreateSSMParameter operation", async () => {
        const event = {
            ResourceProperties: {
                Parameters: {
                    RequestType: "CreateSSMParameter",
                    Details: {
                        SSMParamName: "testSSMParamName",
                        SSMParamValue: "testSSMParamValue"
                    }
                }
            }
        };
        const ssmParamName = event.ResourceProperties.Parameters.Details.SSMParamName;
        const expectedResponse = {
            Success: true,
            Message: `The secret parameter ${ssmParamName} is stored successfully.`,
        };
        const result = await handler.handler(event);
        expect(result).toMatchObject(expectedResponse);
        expect(readSecret).toHaveBeenCalledWith('test-secret-name');
        expect(writeSecret).toHaveBeenCalledWith('test-secret-name', {
            'testSSMParamName': 'testSSMParamValue'
        });
    });

    it("Test GeneratePrivatePublicKeyPair operation", async () => {
        const event = {
            ResourceProperties: {
                Parameters: {
                    RequestType: "GeneratePrivatePublicKeyPair",
                    Details: {
                        SSMParamName: "testSSMParamName",
                        SSMParamValue: "testSSMParamValue",
                        OrganizationalUnitName: "testOrganizationalUnitName",
                        ExpiresIn: 2
                    }
                }
            }
        };
        const pems = {
            private: "testPrivate",
            cert: "testCert"
        }
        selfsigned.generate.mockImplementationOnce(() => pems);

        const expectedResponse = {
            Success: true,
            Certificate: pems.cert
        };

        const result = await handler.handler(event);
        expect(result).toMatchObject(expectedResponse);
        expect(readSecret).toHaveBeenCalledWith('test-secret-name');
        expect(writeSecret).toHaveBeenCalledWith('test-secret-name', {
            'testSSMParamName': 'testPrivate'
        });
    });

    it("Test updating existing secret with additional parameters", async () => {
        const existingSecretData = {
            'existingParam': 'existingValue'
        };
        readSecret.mockResolvedValue(existingSecretData)

        const event = {
            ResourceProperties: {
                Parameters: {
                    RequestType: "CreateSSMParameter",
                    Details: {
                        SSMParamName: "newParam",
                        SSMParamValue: "newValue"
                    }
                }
            }
        };

        await handler.handler(event);
        expect(writeSecret).toHaveBeenCalledWith('test-secret-name', {
            'existingParam': 'existingValue',
            'newParam': 'newValue'
        });
    });

    it("Test error when SECRET_NAME is not set", async () => {
        // Mock the config to return undefined secretName
        jest.doMock('../config', () => ({
            logLevel: 'info',
            secretName: undefined
        }));

        // Re-require the handler to pick up the new config
        jest.resetModules();
        const handlerWithoutSecret = require('../index');

        const event = {
            ResourceProperties: {
                Parameters: {
                    RequestType: "CreateSSMParameter",
                    Details: {
                        SSMParamName: "testParam",
                        SSMParamValue: "testValue"
                    }
                }
            }
        };

        await expect(handlerWithoutSecret.handler(event)).rejects.toThrow('SECRET_NAME configuration is not set');
    });

    it("Test error when SECRET_NAME is empty string", async () => {
        // Mock the config to return empty secretName
        jest.doMock('../config', () => ({
            logLevel: 'info',
            secretName: ''
        }));

        // Mock selfsigned for this test
        const mockSelfsigned = {
            generate: jest.fn().mockReturnValue({
                private: 'test-private',
                cert: 'test-cert'
            })
        };
        jest.doMock('selfsigned', () => mockSelfsigned);

        // Re-require the handler to pick up the new config
        jest.resetModules();
        const handlerWithoutSecret = require('../index');

        const event = {
            ResourceProperties: {
                Parameters: {
                    RequestType: "GeneratePrivatePublicKeyPair",
                    Details: {
                        SSMParamName: "testParam",
                        OrganizationalUnitName: "testOrg",
                        ExpiresIn: 30
                    }
                }
            }
        };

        await expect(handlerWithoutSecret.handler(event)).rejects.toThrow('SECRET_NAME configuration is not set');
    });

    it("Test error handling when readSecret fails", async () => {
        const readError = new Error('Failed to read secret');
        readSecret.mockRejectedValue(readError);

        const event = {
            ResourceProperties: {
                Parameters: {
                    RequestType: "CreateSSMParameter",
                    Details: {
                        SSMParamName: "testParam",
                        SSMParamValue: "testValue"
                    }
                }
            }
        };

        await expect(handler.handler(event)).rejects.toThrow('Failed to read secret');
    });

    it("Test error handling when writeSecret fails", async () => {
        readSecret.mockResolvedValue({});
        const writeError = new Error('Failed to write secret');
        writeSecret.mockRejectedValue(writeError);

        const event = {
            ResourceProperties: {
                Parameters: {
                    RequestType: "CreateSSMParameter",
                    Details: {
                        SSMParamName: "testParam",
                        SSMParamValue: "testValue"
                    }
                }
            }
        };

        await expect(handler.handler(event)).rejects.toThrow('Failed to write secret');
    });
});