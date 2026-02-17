// Mock environment variables before requiring modules
process.env.LOG_LEVEL = 'debug';
process.env.INVOKE_TELEPHONY_INTEGRATION_API_ARN = 'arn:aws:lambda:us-east-1:123456789012:function:test-invoke-telephony';
process.env.SECRET_CACHE_S3 = 'test-bucket/cache';

const mockLambda = {
  invoke: jest.fn(),
};

jest.mock('aws-sdk', () => ({
  Lambda: jest.fn(() => mockLambda),
}));

// Mock SCVLoggingUtil
jest.mock('../SCVLoggingUtil', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// Mock cacheUtils
const mockCacheUtils = {
  retrieveFromCache: jest.fn(),
};

jest.mock('../cacheUtils', () => mockCacheUtils);

// Mock utils
const mockUtils = {
  isDisconnectedEventForAbandonedCall: jest.fn(),
  isRoutingCriteriaExpiredEventForCall: jest.fn(),
};

jest.mock('../utils', () => mockUtils);

// Mock secretUtils
jest.mock('../secretUtils', () => ({
  getSecretConfigs: jest.fn(),
}));

const handler = require('../handler');
const SCVLoggingUtil = require('../SCVLoggingUtil');
const mockSecretUtils = require('../secretUtils');

describe('MultiorgHandleContactEvents Lambda handler', () => {
  const contactId = 'test-contact-123';
  const secretName = 'test-secret-name';

  beforeEach(() => {
    jest.clearAllMocks();
    mockLambda.invoke.mockReturnValue({
      promise: jest.fn().mockResolvedValue({ StatusCode: 200 }),
    });
  });

  describe('handler', () => {
    it('should process disconnected event with secret from cache', async () => {
      const event = {
        'detail-type': 'Amazon Connect Contact Event',
        detail: {
          contactId: contactId,
          eventType: 'DISCONNECTED',
          initiationMethod: 'INBOUND',
        },
      };

      mockUtils.isDisconnectedEventForAbandonedCall.mockReturnValue(true);
      mockUtils.isRoutingCriteriaExpiredEventForCall.mockReturnValue(false);
      mockCacheUtils.retrieveFromCache.mockResolvedValue({ secretName });

      await handler.handler(event);

      expect(SCVLoggingUtil.debug).toHaveBeenCalledWith({
        message: 'MultiorgHandleContactEvents event received',
        context: event,
      });

      expect(mockCacheUtils.retrieveFromCache).toHaveBeenCalledWith(contactId);

      expect(mockLambda.invoke).toHaveBeenCalledWith({
        FunctionName: 'arn:aws:lambda:us-east-1:123456789012:function:test-invoke-telephony',
        Payload: JSON.stringify({
          Details: {
            Parameters: {
              methodName: 'cancelOmniFlowExecution',
              contactId: contactId,
              fieldValues: {
                secretName: secretName,
              },
            },
          },
        }),
      });
    });

    it('should process routing criteria expired event with secret from cache', async () => {
      const event = {
        'detail-type': 'Amazon Connect Contact Event',
        detail: {
          contactId: contactId,
          eventType: 'CONTACT_DATA_UPDATED',
          initiationMethod: 'INBOUND',
        },
      };

      mockUtils.isDisconnectedEventForAbandonedCall.mockReturnValue(false);
      mockUtils.isRoutingCriteriaExpiredEventForCall.mockReturnValue(true);
      mockCacheUtils.retrieveFromCache.mockResolvedValue({ secretName });

      await handler.handler(event);

      expect(mockCacheUtils.retrieveFromCache).toHaveBeenCalledWith(contactId);

      expect(mockLambda.invoke).toHaveBeenCalledWith({
        FunctionName: 'arn:aws:lambda:us-east-1:123456789012:function:test-invoke-telephony',
        Payload: JSON.stringify({
          Details: {
            Parameters: {
              methodName: 'rerouteFlowExecution',
              contactId: contactId,
              fieldValues: {
                secretName: secretName,
              },
            },
          },
        }),
      });
    });

    it('should handle case when cache returns null (no secret found)', async () => {
      const event = {
        'detail-type': 'Amazon Connect Contact Event',
        detail: {
          contactId: contactId,
          eventType: 'DISCONNECTED',
          initiationMethod: 'INBOUND',
        },
      };

      mockUtils.isDisconnectedEventForAbandonedCall.mockReturnValue(true);
      mockUtils.isRoutingCriteriaExpiredEventForCall.mockReturnValue(false);
      mockCacheUtils.retrieveFromCache.mockResolvedValue(null);

      await handler.handler(event);

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'No secretName found in cache for ContactId',
        context: { contactId },
      });

      // Should still invoke the telephony service with null secretName
      expect(mockLambda.invoke).toHaveBeenCalledWith({
        FunctionName: 'arn:aws:lambda:us-east-1:123456789012:function:test-invoke-telephony',
        Payload: JSON.stringify({
          Details: {
            Parameters: {
              methodName: 'cancelOmniFlowExecution',
              contactId: contactId,
              fieldValues: {
                secretName: null,
              },
            },
          },
        }),
      });
    });

    it('should handle case when cache returns empty object', async () => {
      const event = {
        'detail-type': 'Amazon Connect Contact Event',
        detail: {
          contactId: contactId,
          eventType: 'DISCONNECTED',
          initiationMethod: 'INBOUND',
        },
      };

      mockUtils.isDisconnectedEventForAbandonedCall.mockReturnValue(true);
      mockUtils.isRoutingCriteriaExpiredEventForCall.mockReturnValue(false);
      mockCacheUtils.retrieveFromCache.mockResolvedValue({});

      await handler.handler(event);

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'No secretName found in cache for ContactId',
        context: { contactId },
      });

      // Should still invoke the telephony service with null secretName
      expect(mockLambda.invoke).toHaveBeenCalledWith({
        FunctionName: 'arn:aws:lambda:us-east-1:123456789012:function:test-invoke-telephony',
        Payload: JSON.stringify({
          Details: {
            Parameters: {
              methodName: 'cancelOmniFlowExecution',
              contactId: contactId,
              fieldValues: {
                secretName: null,
              },
            },
          },
        }),
      });
    });

    it('should handle cache retrieval error', async () => {
      const event = {
        'detail-type': 'Amazon Connect Contact Event',
        detail: {
          contactId: contactId,
          eventType: 'DISCONNECTED',
          initiationMethod: 'INBOUND',
        },
      };

      const cacheError = new Error('S3 access denied');
      mockUtils.isDisconnectedEventForAbandonedCall.mockReturnValue(true);
      mockUtils.isRoutingCriteriaExpiredEventForCall.mockReturnValue(false);
      mockCacheUtils.retrieveFromCache.mockRejectedValue(cacheError);

      await handler.handler(event);

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Error retrieving secret name from cache',
        context: { contactId, error: cacheError.message },
      });

      // Should still invoke the telephony service with null secretName
      expect(mockLambda.invoke).toHaveBeenCalledWith({
        FunctionName: 'arn:aws:lambda:us-east-1:123456789012:function:test-invoke-telephony',
        Payload: JSON.stringify({
          Details: {
            Parameters: {
              methodName: 'cancelOmniFlowExecution',
              contactId: contactId,
              fieldValues: {
                secretName: null,
              },
            },
          },
        }),
      });
    });

    it('should not process event that is neither disconnected nor routing expired', async () => {
      const event = {
        'detail-type': 'Amazon Connect Contact Event',
        detail: {
          contactId: contactId,
          eventType: 'OTHER_EVENT',
          initiationMethod: 'INBOUND',
        },
      };

      mockUtils.isDisconnectedEventForAbandonedCall.mockReturnValue(false);
      mockUtils.isRoutingCriteriaExpiredEventForCall.mockReturnValue(false);

      await handler.handler(event);

      expect(mockCacheUtils.retrieveFromCache).not.toHaveBeenCalled();
      expect(mockLambda.invoke).not.toHaveBeenCalled();
    });

    it('should handle Lambda invoke success response', async () => {
      const event = {
        'detail-type': 'Amazon Connect Contact Event',
        detail: {
          contactId: contactId,
          eventType: 'DISCONNECTED',
          initiationMethod: 'INBOUND',
        },
      };

      const successResponse = { StatusCode: 200, Payload: 'success' };
      mockUtils.isDisconnectedEventForAbandonedCall.mockReturnValue(true);
      mockUtils.isRoutingCriteriaExpiredEventForCall.mockReturnValue(false);
      mockCacheUtils.retrieveFromCache.mockResolvedValue({ secretName });
      mockLambda.invoke.mockReturnValue({
        promise: jest.fn().mockResolvedValue(successResponse),
      });

      await handler.handler(event);

      expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
        message: 'cancelOmniFlowExecution response',
        context: successResponse,
      });
    });

    it('should handle Lambda invoke error response', async () => {
      const event = {
        'detail-type': 'Amazon Connect Contact Event',
        detail: {
          contactId: contactId,
          eventType: 'DISCONNECTED',
          initiationMethod: 'INBOUND',
        },
      };

      mockUtils.isDisconnectedEventForAbandonedCall.mockReturnValue(true);
      mockUtils.isRoutingCriteriaExpiredEventForCall.mockReturnValue(false);
      mockCacheUtils.retrieveFromCache.mockResolvedValue({ secretName });

      // Create a promise that rejects, but handle the rejection to prevent Jest interference
      mockLambda.invoke.mockReturnValue({
        promise: jest.fn().mockImplementation(() => {
          const errorPromise = Promise.reject(new Error('Mock invoke error'));
          // Suppress unhandled rejection warning
          errorPromise.catch(() => {});
          return errorPromise;
        }),
      });

      try {
        await handler.handler(event);
      } catch (error) {
        // Expected behavior - handler should handle errors gracefully
      }

      // Wait a bit for the promise chain to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Just verify the error logging method was called with the right message
      expect(SCVLoggingUtil.info).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'cancelOmniFlowExecution error',
        })
      );
    });
  });
});