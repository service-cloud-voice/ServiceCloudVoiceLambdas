const utils = require('../utils.js');

jest.mock('jsonwebtoken');
const jwt = require('jsonwebtoken');

jest.mock('aws-sdk/clients/ssm');
const SSM = require('aws-sdk/clients/ssm');

jest.mock('uuid/v1');
const uuid = require('uuid');

afterEach(() => {    
  jest.clearAllMocks();
});

describe('getSSMParameterValue', () => {
    let originalSSMPrototype;

    beforeEach(() => {
        originalSSMPrototype = SSM.prototype;
    });

    it('should invoke SSM.prototype.getParameters() with proper arguments', () => {
        SSM.prototype.getParameters = jest.fn();

        utils.getSSMParameterValue('test_param_name', true);

        expect(SSM.prototype.getParameters.mock.calls.length).toBe(1);
        expect(SSM.prototype.getParameters.mock.calls[0][0]).toEqual({
            Names:  [ 'test_param_name' ],
            WithDecryption: true
        });
    });

    it('should return a parameter value from SSM', async () => {
        SSM.prototype.getParameters = jest.fn((query, callback) => {
            callback.call(null, undefined, {
                Parameters: [{ Value: 'test_param_value' }]
            });
        });

        const paramValue = await utils.getSSMParameterValue('test_param_name', true);

        expect(paramValue).toBe('test_param_value');
    });

    it('should return null if SSM parameter retrieval failed', async () => {
        SSM.prototype.getParameters = jest.fn((query, callback) => {
            callback.call(null, 'test_ssm_error', undefined);
        });

        const paramValue = await utils.getSSMParameterValue('test_param_name', true);

        expect(paramValue).toBe(null);
    });

    afterEach(() => {
        SSM.prototype = originalSSMPrototype;
    });
});

describe('generateJWT', () => {
    let originalDateGetTime;
    let originalSSMGetParameters;

    beforeEach(() => {
        originalDateGetTime = Date.prototype.getTime;
        originalSSMGetParameters = SSM.prototype.getParameters;
    });

    it('should invoke jwt.sign() with proper arguments', async () => {
        SSM.prototype.getParameters = jest.fn((query, callback) => {
            callback.call(null, undefined, {
                Parameters: [{ Value: 'test_private_key' }]
            });
        });
        jest.spyOn(uuid, 'v1').mockReturnValue('123456789');

        await utils.generateJWT({
            privateKeyParamName: 'test_param_name',
            orgId: 'test_org_id',
            callCenterApiName: 'test_call_center_api_name',
            expiresIn: 'test_expires_in'
        });

        expect(jwt.sign).toHaveBeenCalledWith({}, 'test_private_key', {
            issuer: 'test_org_id',
            subject:  'test_call_center_api_name',
            expiresIn:  'test_expires_in',
            algorithm:  'RS256',
            jwtid: '123456789'
        });
    });

    it('should invoke jwt.sign() once', async () => {
        SSM.prototype.getParameters = jest.fn((query, callback) => {
            callback.call(null, undefined, {
                Parameters: [{ Value: 'test_private_key' }]
            });
        });

        await utils.generateJWT({
            privateKeyParamName: 'test_param_name',
            orgId: 'test_org_id',
            callCenterApiName: 'test_call_center_api_name',
            expiresIn: 'test_expires_in'
        });

        expect(jwt.sign).toHaveBeenCalledTimes(1);
    });

    it('should return the result of the jwt.sign() call', async () => {
        SSM.prototype.getParameters = jest.fn((query, callback) => {
            callback.call(null, undefined, {
                Parameters: [{ Value: 'test_private_key' }]
            });
        });
        jwt.sign.mockReturnValueOnce('test_signed_jwt');

        const result = await utils.generateJWT({
            privateKeyParamName: 'test_param_name',
            orgId: 'test_org_id',
            callCenterApiName: 'test_call_center_api_name',
            expiresIn: 'test_expires_in'
        });

        expect(result).toBe('test_signed_jwt');
    });

    afterEach(() => {
        Date.prototype.getTime = originalDateGetTime;
        SSM.prototype.getParameters = originalSSMGetParameters;
    });
});

describe('constructFlowInputParams', () => {
    let input = {
        "flowInput-field1":"field1",
        "flowInput-field2":"field2",
        "flowInput-field3":"field3",
        "flowInput-field4":"field4",
        "field5":"field5"
    };
    let expected = {"field1": "field1", "field2": "field2", "field3": "field3", "field4": "field4"};
    it('should get Parameters that start with flowInput- and ignore the other attributes', () => {
        expect(utils.constructFlowInputParams(input)).toStrictEqual(expected);
    });

    let input2 = {
        "flowInpu-field1":"field1",
        "flowInputfield2":"field2",
        "flow-field3":"field3",
        "Input-field4":"field4",
        "field5":"field5"
    };
    let expected2 = {};
    it('Parameters should be empty as none of them start with flowInput-', () => {
        expect(utils.constructFlowInputParams(input2)).toStrictEqual(expected2);
    });
}); 
