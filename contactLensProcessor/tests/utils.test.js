const utils = require('../utils');
const config = require('../config');

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
      Names: ['test_param_name'],
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

describe('parseData', () => {
    let input = "eyJsYW5nIjogIkVuZ2xpc2gifQ==";
    let expected = {"lang": "English"};
    it('should parse correctly', () => {
        expect(utils.parseData(input)).toStrictEqual(expected);
    });

    let input1 = "eyJmcmVuY2giOiAiU+KAmWlsIHZvdXMgcGxhw650In0=";
    let expected1 = {"french": "S’il vous plaît"};
    it('should parse correctly', () => {
        expect(utils.parseData(input1)).toStrictEqual(expected1);
    });

    let input2 = "eyJHZXJtYW4iOiAiTMOkY2hlbG4ifQ";
    let expected2 = {"German": "Lächeln"};
    it('should parse correctly', () => {
        expect(utils.parseData(input2)).toStrictEqual(expected2);
    });

    let input3 = "eyJNYW5kYXJpbiI6ICLkuIDkupvmma7pgJror50ifQ==";
    let expected3 = {"Mandarin": "一些普通话"};
    it('should parse correctly', () => {
        expect(utils.parseData(input3)).toStrictEqual(expected3);
    });

    let input4 = "eyJKYXBhbmVzZSI6ICLkuIDpg6jjga7ml6XmnKzkuroifQ===";
    let expected4 = {"Japanese": "一部の日本人"};
    it('should parse correctly', () => {
        expect(utils.parseData(input4)).toStrictEqual(expected4);
    });

    let input5 = "eyJTd2VkaXNoIjogIm7DpWdyYSBzdmVuc2thIHNwcsOlayJ9";
    let expected5 = {"Swedish": "några svenska språk"};
    it('should parse correctly', () => {
        expect(utils.parseData(input5)).toStrictEqual(expected5);
    });

    let input6 = "eyJLb3JlYW4iOiAi7ZWc6rWt7Ja0In0=";
    let expected6 = {"Korean": "한국어"};
    it('should parse correctly', () => {
        expect(utils.parseData(input6)).toStrictEqual(expected6);
    });

    let input7 = "eyJJdGFsaWFuIjogIkMnw6ggcXVhbGN1bm8gY2hlIHBhcmxhIGluZ2xlc2UifQ==";
    let expected7 = {"Italian": "C'è qualcuno che parla inglese"};
    it('should parse correctly', () => {
        expect(utils.parseData(input7)).toStrictEqual(expected7);
    });

    let input8 = "eyJQb3J0dWdlc2UiOiAiUG9ydHVndcOqcyBjb211bSJ9";
    let expected8 ={"Portugese": "Português comum"};
    it('should parse correctly', () => {
        expect(utils.parseData(input8)).toStrictEqual(expected8);
    });

    let input9 = "eyJBcmFiaWMiOiAi2KfZhNmE2LrYqSDYp9mE2LnYsdio2YrYqSDYp9mE2YXYtNiq2LHZg9ipIn0=";
    let expected9 = {"Arabic": "اللغة العربية المشتركة"};
    it('should parse correctly', () => {
        expect(utils.parseData(input9)).toStrictEqual(expected9);
    });

    let input10 = "eyJTcGFuaXNoIjogIkVzcGHDsW9sIGNvbcO6biJ9";
    let expected10 = {"Spanish": "Español común"};
    it('should parse correctly', () => {
        expect(utils.parseData(input10)).toStrictEqual(expected10);
    });
});
