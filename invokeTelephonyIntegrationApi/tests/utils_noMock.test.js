const utils = require('../utils.js');

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
    var pems = selfsigned.generate(attrs, {
        keySize: 2048, // the size for the private key in bits (default: 1024)
        days: "7d", // how long till expiry of the signed certificate (default: 365)
        algorithm: "RS256",
        extensions: [{ name: 'basicConstraints', cA: true }], // certificate extensions array
    });
  return pems;
}

describe('generateJWTWithActualKey', () => {
    const pems = generatePrivatePublicKeyPair();
    let rsaKey = pems.private;

    it('should generate a valid JWT with a real private key', async () => {
        jest.spyOn(uuid, 'v1').mockReturnValue('123456789');

        const jwtValue = await utils.generateJWT({
            privateKey: rsaKey,
            orgId: 'test_org_id',
            callCenterApiName: 'test_call_center_api_name',
            expiresIn: '10m'
        });

        expect(jwtValue).toBeTruthy();
        expect(jwtValue).not.toBeNull();
        expect(typeof jwtValue).toBe('string');
    });
});
