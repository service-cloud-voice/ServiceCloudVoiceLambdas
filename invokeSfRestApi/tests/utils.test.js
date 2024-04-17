const utils = require('../utils.js');

jest.mock('jsonwebtoken');
const jwt = require('jsonwebtoken');

jest.mock('uuid/v1');
const uuid = require('uuid');

// TODO (p.chen): Use rewire to test unexported functions.
// const rewiredUtils = rewire('../utils.js');
// rewiredUtils.__set__('jsonwebtoken', {
//     sign: jest.fn()
// });
// const generateJWT = rewiredUtils.__get__('generateJWT');

afterEach(() => {    
  jest.clearAllMocks();
});

describe('generateJWT', () => {
    it('should invoke jwt.sign() with proper arguments', () => {
        jest.spyOn(uuid, 'v1').mockReturnValue('123456789');
        utils.generateJWT('test_payload', 'test_expiresIn', 'test_privateKey');

        expect(jwt.sign).toHaveBeenCalledWith('test_payload', 'test_privateKey', {
            algorithm: 'RS256',
            expiresIn: 'test_expiresIn',
            jwtid: '123456789'
        });
    });

    it('should invoke jwt.sign() once', () => {
        utils.generateJWT('test_payload', 'test_expiresIn', 'test_privateKey');

        expect(jwt.sign).toHaveBeenCalledTimes(1);
    });

    it('should return the result of the jwt.sign() call', () => {
        jwt.sign.mockReturnValueOnce('signed_jwt');

        const result = utils.generateJWT('test_payload', 'test_expiresIn', 'test_privateKey');

        expect(result).toBe('signed_jwt');
    });
});

describe('formatObjectApiName', () => {
    it('should format the API name of an object with only the first letter upper-cased', () => {
        expect(utils.formatObjectApiName('CASE')).toBe('Case');
        expect(utils.formatObjectApiName('account')).toBe('Account');
        expect(utils.formatObjectApiName('CoNtAcT')).toBe('Contact');
    });
});
