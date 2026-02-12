const utils = require('../utils.js');

jest.mock('jsonwebtoken');
const jwt = require('jsonwebtoken');

jest.mock('uuid/v1');
const uuid = require('uuid');

afterEach(() => {
  jest.clearAllMocks();
});

describe('generateJWT', () => {
    it('should invoke jwt.sign() with proper arguments', async () => {
        jest.spyOn(uuid, 'v1').mockReturnValue('123456789');
        jwt.sign.mockReturnValueOnce('test_signed_jwt');

        const result = await utils.generateJWT({
            privateKey: 'test_private_key',
            orgId: 'test_org_id',
            callCenterApiName: 'test_call_center_api_name',
            expiresIn: 'test_expires_in'
        });

        expect(jwt.sign).toHaveBeenCalledWith({}, 'test_private_key', {
            issuer: 'test_org_id',
            subject: 'test_call_center_api_name',
            expiresIn: 'test_expires_in',
            algorithm: 'RS256',
            jwtid: '123456789'
        });
        expect(result).toBe('test_signed_jwt');
    });

    it('should invoke jwt.sign() once', async () => {
        jwt.sign.mockReturnValueOnce('test_signed_jwt');

        await utils.generateJWT({
            privateKey: 'test_private_key',
            orgId: 'test_org_id',
            callCenterApiName: 'test_call_center_api_name',
            expiresIn: 'test_expires_in'
        });

        expect(jwt.sign).toHaveBeenCalledTimes(1);
    });

    it('should return the result of the jwt.sign() call', async () => {
        jwt.sign.mockReturnValueOnce('test_signed_jwt');

        const result = await utils.generateJWT({
            privateKey: 'test_private_key',
            orgId: 'test_org_id',
            callCenterApiName: 'test_call_center_api_name',
            expiresIn: 'test_expires_in'
        });

        expect(result).toBe('test_signed_jwt');
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

    it('should extract flowInputParameters for routeVoiceCall with routingTarget and other params', () => {
        const routeVoiceCallInput = {
            "methodName": "routeVoiceCall",
            "routingTarget": "AGENT-123",
            "fallbackQueue": "QUEUE-456",
            "flowInput-customerSegment": "VIP",
            "flowInput-priority": "High",
            "flowInput-param1": "value1"
        };
        const expected = {
            "customerSegment": "VIP",
            "priority": "High",
            "param1": "value1"
        };
        expect(utils.constructFlowInputParams(routeVoiceCallInput)).toStrictEqual(expected);
    });
});

describe('getCallAttributes', () => {
    it('should filter attributes that start with "sfdc-" prefix, ignore other prefix, handle case, support other characters and data types', () => {
        const input = {
            "sfdc-field1": "value1",
            "other-field": "value2",
            "sfdc-": "value2",
            "sfdc-field-with-dash.dot": "value3",
            "sfdc-numberField": 123,
            "sfdc-booleanField": true,
            "sfdc-nullField": null,
            "sfdc-arrayField": [1, 2, 3],
            "SfDc-field": "value4",
        };
        const expected = JSON.stringify({
            "field1": "value1",
            "": "value2",
            "field-with-dash.dot": "value3",
            "numberField": 123,
            "booleanField": true,
            "nullField": null,
            "arrayField": [1, 2, 3]
        });
        
        const result = utils.getCallAttributes(input);
        expect(result).toBe(expected);
    });

    it('should handle empty input object', () => {
        const input = {};
        const expected = JSON.stringify({});
  
        const result = utils.getCallAttributes(input);
        expect(result).toBe(expected);
    });
});