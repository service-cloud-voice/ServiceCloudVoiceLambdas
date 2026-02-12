jest.mock('../SCVLoggingUtil');
const SCVLoggingUtil = require('../SCVLoggingUtil');

jest.mock('../axiosWrapper');
const axiosWrapper = require('../axiosWrapper');

// Mock the axiosWrapper methods
const mockPost = jest.fn();
const mockPatch = jest.fn();
axiosWrapper.getScrtEndpoint = jest.fn(() => ({
  post: mockPost,
  patch: mockPatch
}));

jest.mock('../utils');
const utils = require('../utils');

jest.mock('../config', () => ({
  privateKeyParamName: 'test-private-key-param',
  orgId: 'test-org-id',
  callCenterApiName: 'test-call-center',
  tokenValidFor: '5m',
  audience: 'https://scrt.salesforce.com',
  scrtEndpointBase: 'https://test-scrt-endpoint.com'
}));

const api = require('../telephonyIntegrationApi');

afterEach(() => {
  jest.clearAllMocks();
});

describe('telephonyIntegrationApi', () => {

  // Mock config data that the API functions expect
  const mockConfigData = {
    orgId: 'test-org-id',
    callCenterApiName: 'test-call-center',
    tokenValidFor: '5m',
    privateKey: 'test-private-key',
    scrtEndpointBase: 'https://test-scrt-endpoint.com',
    audience: 'https://scrt.salesforce.com'
  };

  describe('createVoiceCall', () => {
    const mockFieldValues = {
      callCenterApiName: 'test-call-center',
      vendorCallKey: 'test-contact-id',
      to: '+1234567890',
      from: '+0987654321',
      initiationMethod: 'Inbound',
      startTime: '2023-01-01T00:00:00.000Z',
      callSubtype: 'PSTN',
      callAttributes: '{}',
      participants: [
        {
          participantKey: '+0987654321',
          type: 'END_USER'
        }
      ]
    };

    it('should successfully create voice call', async () => {
      const expectedResponse = { voiceCallRecordId: 'voice-call-id' };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPost.mockResolvedValue(mockAxiosResponse);

      const result = await api.createVoiceCall(mockFieldValues, mockConfigData);
      
      verifyGenerateJWT();
      expect(mockPost).toHaveBeenCalledWith(
        '/voiceCalls',
        {
          ...mockFieldValues,
          callCenterApiName: 'test-call-center'
        },
        { 
          headers: { ...buildAuthHeaders(), 'Telephony-Provider-Name': 'amazon-connect' }
        }
      );
      verifySCVLoggingUtilInfo('CreateVoiceCall');
      expect(result).toEqual(expectedResponse);
    });

    it('should handle error when creating voice call', async () => {
      const mockError = new Error('API Error');
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPost.mockRejectedValue(mockError);

      await expect(api.createVoiceCall(mockFieldValues, mockConfigData)).rejects.toThrow('Error creating VoiceCall record');

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Error creating VoiceCall record',
        context: { payload: mockError }
      });
    });

    it('should create voice call with different fieldValues object reference', async () => {
      const fieldValsCopy = { ...mockFieldValues };
      const expectedResponse = { voiceCallRecordId: 'voice-call-id' };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPost.mockResolvedValue(mockAxiosResponse);

      const result = await api.createVoiceCall(fieldValsCopy, mockConfigData);

      expect(fieldValsCopy.callCenterApiName).toBe('test-call-center');
      expect(result).toEqual(expectedResponse);
    });

    it('should create voice call and verify response data extraction', async () => {
      const expectedResponse = { voiceCallRecordId: 'voice-call-id', errors: [] };
      const mockAxiosResponse = { data: expectedResponse, status: 200, headers: {} };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPost.mockResolvedValue(mockAxiosResponse);

      const result = await api.createVoiceCall(mockFieldValues, mockConfigData);

      expect(result).toEqual(expectedResponse);
      expect(result).not.toHaveProperty('status');
      expect(result).not.toHaveProperty('headers');
    });
  });

  describe('updateVoiceCall', () => {
    const contactId = 'test-contact-id';
    const fieldValues = {
      status: 'completed',
      endTime: '2023-01-01T01:00:00.000Z'
    };

    it('should successfully update voice call', async () => {
      const expectedResponse = { success: true };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockResolvedValue(mockAxiosResponse);

      const result = await api.updateVoiceCall(contactId, fieldValues, mockConfigData);

      verifyGenerateJWT();
      expect(mockPatch).toHaveBeenCalledWith(
        `/voiceCalls/${contactId}`,
        fieldValues,
        { headers: { ...buildAuthHeaders(), 'Telephony-Provider-Name': 'amazon-connect' } }
      );
      verifySCVLoggingUtilInfo('updateVoiceCall');
      expect(result).toEqual(expectedResponse);
    });

    it('should handle error when updating voice call', async () => {
      const mockError = new Error('Update Error');
      
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockRejectedValue(mockError);

      await expect(api.updateVoiceCall(contactId, fieldValues, mockConfigData)).rejects.toThrow('Error updating VoiceCall record.');

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Error updating VoiceCall record',
        context: { payload: mockError }
      });
    });

    it('should update voice call with empty fieldValues', async () => {
      const emptyFieldValues = {};
      const expectedResponse = { success: true };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockResolvedValue(mockAxiosResponse);

      const result = await api.updateVoiceCall(contactId, emptyFieldValues, mockConfigData);

      expect(mockPatch).toHaveBeenCalledWith(
        `/voiceCalls/${contactId}`,
        emptyFieldValues,
        { headers: { ...buildAuthHeaders(), 'Telephony-Provider-Name': 'amazon-connect' } }
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should update voice call and verify response data extraction', async () => {
      const expectedResponse = { success: true, updatedFields: ['status', 'endTime'] };
      const mockAxiosResponse = { data: expectedResponse, status: 200 };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockResolvedValue(mockAxiosResponse);

      const result = await api.updateVoiceCall(contactId, fieldValues, mockConfigData);

      expect(result).toEqual(expectedResponse);
      expect(result).not.toHaveProperty('status');
    });
  });

  describe('executeOmniFlow', () => {
    const contactId = 'test-contact-id';
    const payload = {
      flowDevName: 'TestFlow',
      fallbackQueue: 'TestQueue',
      transferTarget: "TestTransferTarget",
      dialedNumber: '+1234567890',
      flowInputParameters: { param1: 'value1' }
    };

    it('should successfully execute omni flow', async () => {
      const expectedResponse = { flowExecutionId: 'flow-exec-id' };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockResolvedValue(mockAxiosResponse);

      const result = await api.executeOmniFlow(contactId, payload, mockConfigData);
      
      verifyGenerateJWT();
      expect(mockPatch).toHaveBeenCalledWith(
        `/voiceCalls/${contactId}/omniFlow`,
        payload,
        { headers: { ...buildAuthHeaders(), 'Telephony-Provider-Name': 'amazon-connect' } }
      );
      verifySCVLoggingUtilInfo('executeOmniFlow');
      expect(result).toEqual(expectedResponse);
    });

    it('should handle error when executing omni flow', async () => {
      const mockError = new Error('Flow Error');
      
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockRejectedValue(mockError);

      await expect(api.executeOmniFlow(contactId, payload, mockConfigData)).rejects.toThrow('Error executing Omni Flow');

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: `Error executing Omni Flow with ${contactId}`,
        context: { payload: mockError }
      });
    });

    it('should execute omni flow with minimal payload', async () => {
      const minimalPayload = {
        flowDevName: 'TestFlow'
      };
      const expectedResponse = { flowExecutionId: 'flow-exec-id' };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockResolvedValue(mockAxiosResponse);

      const result = await api.executeOmniFlow(contactId, minimalPayload, mockConfigData);

      expect(mockPatch).toHaveBeenCalledWith(
        `/voiceCalls/${contactId}/omniFlow`,
        minimalPayload,
        { headers: { ...buildAuthHeaders(), 'Telephony-Provider-Name': 'amazon-connect' } }
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should execute omni flow and verify response data extraction', async () => {
      const expectedResponse = { flowExecutionId: 'flow-exec-id', status: 'running' };
      const mockAxiosResponse = { data: expectedResponse, status: 200 };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockResolvedValue(mockAxiosResponse);

      const result = await api.executeOmniFlow(contactId, payload, mockConfigData);

      expect(result).toEqual(expectedResponse);
      expect(result).not.toHaveProperty('status', 200);
    });
  });

  describe('sendMessage', () => {
    const contactId = 'test-contact-id';
    const payload = {
      message: 'Test message',
      callCenterApiName: 'test-call-center'
    };

    it('should successfully send message', async () => {
      const expectedResponse = { messageId: 'msg-id' };
      const mockAxiosResponse = { data: expectedResponse };

      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPost.mockResolvedValue(mockAxiosResponse);

      const result = await api.sendMessage(contactId, payload, mockConfigData);

      verifyGenerateJWT();
      expect(mockPost).toHaveBeenCalledWith(
        `/voiceCalls/${contactId}/messages`,
        payload,
        { headers: { ...buildAuthHeaders(), 'Telephony-Provider-Name': 'amazon-connect' } }
      );
      verifySCVLoggingUtilInfo('sendMessage');
      expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
        message: `Successfully sent transcript with ${contactId}`,
        context: { payload: mockAxiosResponse }
      });
      expect(result).toEqual(expectedResponse);
    });

    it('should handle error when sending message and return error result', async () => {
      const mockError = new Error('Send Error');
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPost.mockRejectedValue(mockError);

      const result = await api.sendMessage(contactId, payload, mockConfigData);

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: `Error sending transcript with ${contactId}`,
        context: { payload: mockError }
      });
      expect(result).toEqual({ result: 'Error' });
    });

    it('should send message and verify success logging path', async () => {
      const expectedResponse = { messageId: 'msg-id', timestamp: '2023-01-01T00:00:00Z' };
      const mockAxiosResponse = { data: expectedResponse, status: 200 };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPost.mockResolvedValue(mockAxiosResponse);

      const result = await api.sendMessage(contactId, payload, mockConfigData);

      expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
        message: `Successfully sent transcript with ${contactId}`,
        context: { payload: mockAxiosResponse }
      });
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('cancelOmniFlowExecution', () => {
    const contactId = 'test-contact-id';

    it('should successfully cancel omni flow execution', async () => {
      const expectedResponse = { success: true };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockResolvedValue(mockAxiosResponse);

      const result = await api.cancelOmniFlowExecution(contactId, mockConfigData);

      verifyGenerateJWT();
      expect(mockPatch).toHaveBeenCalledWith(
        `/voiceCalls/${contactId}/clearRouting`,
        null,
        { headers: buildAuthHeaders() }
      );
      verifySCVLoggingUtilInfo('cancelOmniFlowExecution');
      expect(result).toEqual(expectedResponse);
    });

    it('should handle error when cancelling omni flow execution', async () => {
      const mockError = new Error('Cancel Error');
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockRejectedValue(mockError);

      await expect(api.cancelOmniFlowExecution(contactId, mockConfigData)).rejects.toThrow('Error cancelling OmniFlowExecution');

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: `Error cancelling OmniFlowExecution with ${contactId}`,
        context: { payload: mockError }
      });
    });

    it('should cancel omni flow execution and verify response data extraction', async () => {
      const expectedResponse = { success: true, cancelledAt: '2023-01-01T00:00:00Z' };
      const mockAxiosResponse = { data: expectedResponse, status: 200 };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockResolvedValue(mockAxiosResponse);

      const result = await api.cancelOmniFlowExecution(contactId, mockConfigData);

      expect(result).toEqual(expectedResponse);
      expect(result).not.toHaveProperty('status', 200);
    });

    it('should cancel omni flow execution with different contactId format', async () => {
      const sobjectId = '00aXX000000XXXXXAAA';
      const expectedResponse = { success: true };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockResolvedValue(mockAxiosResponse);

      const result = await api.cancelOmniFlowExecution(sobjectId, mockConfigData);

      expect(mockPatch).toHaveBeenCalledWith(
        `/voiceCalls/${sobjectId}/clearRouting`,
        null,
        { headers: buildAuthHeaders() }
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('rerouteFlowExecution', () => {
    const contactId = 'test-contact-id';

    it('should successfully reroute flow execution', async () => {
      const expectedResponse = { success: true };
      const mockAxiosResponse = { data: expectedResponse };

      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockResolvedValue(mockAxiosResponse);

      const result = await api.rerouteFlowExecution(contactId, mockConfigData);

      verifyGenerateJWT();
      expect(mockPatch).toHaveBeenCalledWith(
        `/voiceCalls/${contactId}/reroute`,
        null,
        { headers: buildAuthHeaders() }
      );
      verifySCVLoggingUtilInfo('rerouteFlowExecution');
      expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
        message: `Successfully triggered call rerouting for ${contactId}`,
        context: { payload: mockAxiosResponse }
      });
      expect(result).toEqual(expectedResponse);
    });

    it('should handle error when rerouting flow execution', async () => {
      const mockError = new Error('Reroute Error');
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockRejectedValue(mockError);

      await expect(api.rerouteFlowExecution(contactId, mockConfigData)).rejects.toThrow('Error in Reroute Flow Execution');

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: `Error in Reroute Flow Execution with ${contactId}`,
        context: { payload: mockError }
      });
    });

    it('should reroute flow execution and verify success logging path', async () => {
      const expectedResponse = { success: true, rerouteId: 'reroute-123' };
      const mockAxiosResponse = { data: expectedResponse, status: 200 };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockResolvedValue(mockAxiosResponse);

      const result = await api.rerouteFlowExecution(contactId, mockConfigData);

      expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
        message: `Successfully triggered call rerouting for ${contactId}`,
        context: { payload: mockAxiosResponse }
      });
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('callbackExecution', () => {
    const contactId = 'test-contact-id';
    const payload = {
      callbackNumber: '+1234567890'
    };

    it('should successfully execute callback', async () => {
      const expectedResponse = { callbackId: 'callback-id' };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPost.mockResolvedValue(mockAxiosResponse);

      const result = await api.callbackExecution(contactId, payload, mockConfigData);

      verifyGenerateJWT();
      expect(mockPost).toHaveBeenCalledWith(
        `/voiceCalls/${contactId}/requestCallback`,
        payload,
        { headers: buildAuthHeaders() }
      );
      verifySCVLoggingUtilInfo('Callback');
      expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
        message: `Successfully triggered callback request for ${contactId}`,
        context: { payload: mockAxiosResponse }
      });
      expect(result).toEqual(expectedResponse);
    });

    it('should handle error when executing callback', async () => {
      const mockError = new Error('Callback Error');
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPost.mockRejectedValue(mockError);

      await expect(api.callbackExecution(contactId, payload, mockConfigData)).rejects.toThrow('Error in Callback Execution');

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: `Error in Callback request execution with ${contactId}`,
        context: { payload: mockError }
      });
    });

    it('should execute callback and verify success logging path', async () => {
      const expectedResponse = { callbackId: 'callback-id', scheduledTime: '2023-01-01T00:00:00Z' };
      const mockAxiosResponse = { data: expectedResponse, status: 200 };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPost.mockResolvedValue(mockAxiosResponse);

      const result = await api.callbackExecution(contactId, payload, mockConfigData);

      expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
        message: `Successfully triggered callback request for ${contactId}`,
        context: { payload: mockAxiosResponse }
      });
      expect(result).toEqual(expectedResponse);
    });

    it('should execute callback with different phone number format', async () => {
      const differentPayload = {
        callbackNumber: '1234567890'
      };
      const expectedResponse = { callbackId: 'callback-id' };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPost.mockResolvedValue(mockAxiosResponse);

      const result = await api.callbackExecution(contactId, differentPayload, mockConfigData);

      expect(mockPost).toHaveBeenCalledWith(
        `/voiceCalls/${contactId}/requestCallback`,
        differentPayload,
        { headers: buildAuthHeaders() }
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('routeVoiceCall', () => {
    const contactId = 'test-contact-id';
    const payload = {
      routingTarget: 'AGENT-123',
      fallbackQueue: 'QUEUE-456',
      flowInputParameters: { param1: 'value1' }
    };

    it('should successfully route voice call', async () => {
      const expectedResponse = { status: 'Success' };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockResolvedValue(mockAxiosResponse);

      const result = await api.routeVoiceCall(contactId, payload, mockConfigData);

      verifyGenerateJWT();
      expect(mockPatch).toHaveBeenCalledWith(
        `/voiceCalls/route/${contactId}`,
        payload,
        { headers: { ...buildAuthHeaders(), 'Telephony-Provider-Name': 'amazon-connect' } }
      );
      verifySCVLoggingUtilInfo('Route Voice Call');
      expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
        message: `Successfully routed voice call for ${contactId}`,
        context: { payload: mockAxiosResponse }
      });
      expect(result).toEqual(expectedResponse);
    });

    it('should handle error when routing voice call', async () => {
      const mockError = new Error('Routing Error');
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockRejectedValue(mockError);

      await expect(api.routeVoiceCall(contactId, payload, mockConfigData)).rejects.toThrow('Error routing voice call');

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: `Error routing voice call with ${contactId}`,
        context: { payload: mockError }
      });
    });

    it('should route voice call with only routingTarget', async () => {
      const minimalPayload = {
        routingTarget: 'QUEUE-789'
      };
      const expectedResponse = { status: 'Success' };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockResolvedValue(mockAxiosResponse);

      const result = await api.routeVoiceCall(contactId, minimalPayload, mockConfigData);

      expect(mockPatch).toHaveBeenCalledWith(
        `/voiceCalls/route/${contactId}`,
        minimalPayload,
        { headers: { ...buildAuthHeaders(), 'Telephony-Provider-Name': 'amazon-connect' } }
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should route voice call with flow input parameters only', async () => {
      const flowPayload = {
        routingTarget: 'Flow.Example_Flow',
        flowInputParameters: { customerSegment: 'VIP', priority: 'High' }
      };
      const expectedResponse = { status: 'Success' };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockResolvedValue(mockAxiosResponse);

      const result = await api.routeVoiceCall(contactId, flowPayload, mockConfigData);

      expect(mockPatch).toHaveBeenCalledWith(
        `/voiceCalls/route/${contactId}`,
        flowPayload,
        { headers: { ...buildAuthHeaders(), 'Telephony-Provider-Name': 'amazon-connect' } }
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should route voice call with different contactId format', async () => {
      const sobjectId = '00aXX000000XXXXXAAA';
      const expectedResponse = { status: 'Success' };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPatch.mockResolvedValue(mockAxiosResponse);

      const result = await api.routeVoiceCall(sobjectId, payload, mockConfigData);

      expect(mockPatch).toHaveBeenCalledWith(
        `/voiceCalls/route/${sobjectId}`,
        payload,
        { headers: { ...buildAuthHeaders(), 'Telephony-Provider-Name': 'amazon-connect' } }
      );
      expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
        message: `Successfully routed voice call for ${sobjectId}`,
        context: { payload: mockAxiosResponse }
      });
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('JWT generation', () => {
    it('should generate JWT with correct parameters for all API calls', async () => {
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPost.mockResolvedValue({ data: {} });

      await api.createVoiceCall({
        callCenterApiName: 'test-call-center',
        vendorCallKey: 'test-contact-id'
      }, mockConfigData);
      verifyGenerateJWT();
    });
  });
});

function verifyGenerateJWT() {
    expect(utils.generateJWT).toHaveBeenCalledWith({
        orgId: 'test-org-id',
        callCenterApiName: 'test-call-center',
        expiresIn: '5m',
        privateKey: 'test-private-key'
    });
}

function verifySCVLoggingUtilInfo(methodName) {
    expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
        message: methodName + ' Request created',
        context: { contactId: 'test-contact-id' }
    });
}

function buildAuthHeaders() {
    return {
        Authorization: 'Bearer test-jwt-token',
        'Content-Type': 'application/json'
    };
}