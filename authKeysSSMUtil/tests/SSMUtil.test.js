const handler = require('../index');

jest.mock('aws-sdk');
jest.mock('selfsigned');
jest.mock('aws-param-store');
const selfsigned = require("selfsigned");

describe('SSMUtil Tests', () => {
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
            Message: `The SSM parameter ${ssmParamName} is put successfully.`,
        };
        expect(await handler.handler(event)).toMatchObject(expectedResponse);
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
        await expect(await handler.handler(event)).toMatchObject(expectedResponse);
    });
});
