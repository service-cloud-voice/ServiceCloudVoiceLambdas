const utils = require('../utils');
const config = require('../config');

jest.mock('jsonwebtoken');
const jwt = require('jsonwebtoken');

// Add secretUtils mock for secret-based logic
jest.mock('../secretUtils', () => ({
  getSecretConfigs: jest.fn().mockResolvedValue({ privateKey: 'test_private_key' })
}));

jest.mock('uuid/v1');
const uuid = require('uuid');

afterEach(() => {
  jest.clearAllMocks();
});

describe('generateJWT', () => {
  let originalDateGetTime;

  beforeEach(() => {
    originalDateGetTime = Date.prototype.getTime;
  });

  it('should invoke jwt.sign() with proper arguments', async () => {
    jest.spyOn(uuid, 'v1').mockReturnValue('123456789');

    await utils.generateJWT({
      privateKey: 'test_private_key',
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

  afterEach(() => {
    Date.prototype.getTime = originalDateGetTime;
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
