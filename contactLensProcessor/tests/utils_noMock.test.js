const utils = require('../utils.js');

jest.mock('aws-sdk/clients/ssm');
const SSM = require('aws-sdk/clients/ssm');

jest.mock('uuid/v1');
const uuid = require('uuid');
const selfsigned = require("selfsigned");

afterEach(() => {    
  jest.clearAllMocks();
});

function generatePrivatePublicKeyPair() {
  const attrs = [
    { name: "countryName", value: "US" },
    { name: "stateOrProvinceName", value: "CA" },
    { name: "localityName", value: "San Francisco" },
    { name: "organizationName", value: "salesforce.com" },
    { name: "commonName", value: "www.salesforce.com" },
    {
      name: "organizationalUnitName",
      value: "SFDC",
    },
  ];
  const pems = selfsigned.generate(attrs, { days: '7d' });
  return pems;
}

describe('generateJWTWithActualKey', () => {
    let originalDateGetTime;
    let originalSSMGetParameters;
    const pems = generatePrivatePublicKeyPair();
    let rsaKey = pems.private;

    beforeEach(() => {
        originalDateGetTime = Date.prototype.getTime;
        originalSSMGetParameters = SSM.prototype.getParameters;
    });

    it('should invoke jwt.sign() with proper arguments', async () => {
        SSM.prototype.getParameters = jest.fn((query, callback) => {
            callback.call(null, undefined, {
                Parameters: [{ Value: rsaKey }]
            });
        });
        jest.spyOn(uuid, 'v1').mockReturnValue('123456789');

        const jwtValue = await utils.generateJWT({
            privateKeyParamName: 'test_param_name',
            orgId: 'test_org_id',
            callCenterApiName: 'test_call_center_api_name',
            allowInsecureKeySizes: true,
            expiresIn: '10m'
        });

        expect(jwtValue).toBeTruthy();
        expect(jwtValue).not.toBeNull();
    });

    afterEach(() => {
        Date.prototype.getTime = originalDateGetTime;
        SSM.prototype.getParameters = originalSSMGetParameters;
    });
}); 
