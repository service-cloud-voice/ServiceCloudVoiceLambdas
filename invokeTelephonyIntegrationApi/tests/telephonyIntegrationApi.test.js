jest.mock('../SCVLoggingUtil');
const SCVLoggingUtil = require('../SCVLoggingUtil');

jest.mock('../axiosWrapper');
const axiosWrapper = require('../axiosWrapper');

// Mock the axiosWrapper methods
const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockGet = jest.fn();
axiosWrapper.getScrtEndpoint = jest.fn(() => ({
  post: mockPost,
  patch: mockPatch,
  get: mockGet
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

    it('should execute callback with scheduled date time', async () => {
      const payloadWithScheduledDateTime = {
        ...payload,
        scheduledRoutingDateTime: '2026-02-02T10:00:00Z'
      };
      const expectedResponse = { callbackId: 'callback-id' };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockPost.mockResolvedValue(mockAxiosResponse);

      const result = await api.callbackExecution(contactId, payloadWithScheduledDateTime, mockConfigData);

      expect(mockPost).toHaveBeenCalledWith(
        `/voiceCalls/${contactId}/requestCallback`,
        payloadWithScheduledDateTime,
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

  describe('getVoicemailDrop', () => {
    const contactId = 'test-contact-id';

    it('should successfully get voicemail drop', async () => {
      const expectedResponse = { recordingUrl: 'https://s3.amazonaws.com/voicemail-recordings/recording.wav' };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockGet.mockResolvedValue(mockAxiosResponse);

      const result = await api.getVoicemailDrop(contactId, mockConfigData);

      verifyGenerateJWT();
      expect(mockGet).toHaveBeenCalledWith(
        `/voiceCalls/${contactId}/voicemailDrop`,
        {
          headers: {
            ...buildAuthHeaders(),
            'Telephony-Provider-Name': 'amazon-connect'
          }
        }
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should return recordingUrl "Not found" when backend returns 404', async () => {
      const mock404Error = { response: { status: 404 } };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockGet.mockRejectedValue(mock404Error);

      const result = await api.getVoicemailDrop(contactId, mockConfigData);

      expect(result).toEqual({ recordingUrl: 'Not found' });
      expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
        message: `Voicemail drop not found for ${contactId}`,
        context: { contactId }
      });
      expect(SCVLoggingUtil.error).not.toHaveBeenCalled();
    });

    it('should handle error when getting voicemail drop', async () => {
      const mockError = new Error('API Error');
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockGet.mockRejectedValue(mockError);

      await expect(api.getVoicemailDrop(contactId, mockConfigData)).rejects.toThrow('Error getting voicemail drop');

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: `Error getting voicemail drop for ${contactId}`,
        context: { payload: mockError }
      });
    });

    it('should throw when backend returns non-404 error status', async () => {
      const mock500Error = { response: { status: 500 }, message: 'Internal Server Error' };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockGet.mockRejectedValue(mock500Error);

      await expect(api.getVoicemailDrop(contactId, mockConfigData)).rejects.toThrow('Error getting voicemail drop');

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: `Error getting voicemail drop for ${contactId}`,
        context: { payload: mock500Error }
      });
    });

    it('should get voicemail drop and verify response data extraction', async () => {
      const expectedResponse = {
        recordingUrl: 'https://s3.amazonaws.com/voicemail-recordings/standard-greeting.wav'
      };
      const mockAxiosResponse = { data: expectedResponse, status: 200, headers: {} };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockGet.mockResolvedValue(mockAxiosResponse);

      const result = await api.getVoicemailDrop(contactId, mockConfigData);

      expect(result).toEqual(expectedResponse);
      expect(result).not.toHaveProperty('status');
    });
  });

  describe('getDefaultOutboundPhoneNumber', () => {
    const externalRepId = 'arn:aws:connect:us-east-1:123456789012:instance/xxx/agent/yyy';

    it('should successfully get default outbound phone number with externalRepId query param', async () => {
      const expectedResponse = { phoneNumber: '+15551234567' };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockGet.mockResolvedValue(mockAxiosResponse);

      const result = await api.getDefaultOutboundPhoneNumber(externalRepId, mockConfigData);

      verifyGenerateJWT();
      expect(mockGet).toHaveBeenCalledWith(
        `/voiceCalls/defaultOutboundPhoneNumber?externalRepId=${encodeURIComponent(externalRepId)}`,
        {
          headers: {
            ...buildAuthHeaders(),
            'Telephony-Provider-Name': 'amazon-connect'
          }
        }
      );
      expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
        message: 'Successfully retrieved default outbound phone number',
        context: { payload: mockAxiosResponse }
      });
      expect(result).toEqual(expectedResponse);
    });

    it('should handle error when getting default outbound phone number', async () => {
      const mockError = new Error('API Error');
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockGet.mockRejectedValue(mockError);

      await expect(
        api.getDefaultOutboundPhoneNumber(externalRepId, mockConfigData)
      ).rejects.toThrow('Error getting default outbound phone number');

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Error getting default outbound phone number',
        context: { payload: mockError }
      });
    });
  });

  describe('getVoicemailGreeting', () => {
    const toPhoneNumber = '+15551234567';

    it('should successfully get voicemail greeting with query param', async () => {
      const expectedResponse = { greetingUrl: 'https://s3.example.com/greeting.wav' };
      const mockAxiosResponse = { data: expectedResponse };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockGet.mockResolvedValue(mockAxiosResponse);

      const result = await api.getVoicemailGreeting(toPhoneNumber, mockConfigData);

      verifyGenerateJWT();
      expect(mockGet).toHaveBeenCalledWith(
        `/voiceCalls/voicemailGreeting?toPhoneNumber=${encodeURIComponent(toPhoneNumber)}`,
        {
          headers: {
            ...buildAuthHeaders(),
            'Telephony-Provider-Name': 'amazon-connect'
          }
        }
      );
      expect(SCVLoggingUtil.info).toHaveBeenCalledWith({
        message: 'Successfully retrieved voicemail greeting',
        context: { payload: mockAxiosResponse }
      });
      expect(result).toEqual(expectedResponse);
    });

    it('should encode toPhoneNumber in query string', async () => {
      const numberWithSpecialChars = '+1 (555) 123-4567';
      const mockAxiosResponse = { data: {} };
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockGet.mockResolvedValue(mockAxiosResponse);

      await api.getVoicemailGreeting(numberWithSpecialChars, mockConfigData);

      expect(mockGet).toHaveBeenCalledWith(
        `/voiceCalls/voicemailGreeting?toPhoneNumber=${encodeURIComponent(numberWithSpecialChars)}`,
        expect.any(Object)
      );
    });

    it('should handle error when getting voicemail greeting', async () => {
      const mockError = new Error('API Error');
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      mockGet.mockRejectedValue(mockError);

      await expect(
        api.getVoicemailGreeting(toPhoneNumber, mockConfigData)
      ).rejects.toThrow('Error getting voicemail greeting');

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
        message: 'Error getting voicemail greeting',
        context: { payload: mockError }
      });
    });
  });

  describe('reserveRoutableNumber', () => {
    const baseParameters = {
      countryCode: 'US',
      fromNumber: '+11800999932',
      toNumber: '+15551234567',
      callId: '0LQLT000001jmnt',
      transactionId: 'tx-123',
    };

    beforeEach(() => {
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      utils.isValidE164.mockImplementation(
        (n) => typeof n === 'string' && /^\+[1-9]\d{1,14}$/.test(n)
      );
    });

    it('should validate, build payload, and return a shaped response', async () => {
      mockPost.mockResolvedValue({
        data: {
          handle: { routableNumber: '+14155560999', uid: 'uid-1', expiresAt: '2026-06-09T18:21:28Z' },
          mode: 'number',
        },
      });

      const result = await api.reserveRoutableNumber(baseParameters, {}, mockConfigData);

      verifyGenerateJWT();
      expect(mockPost).toHaveBeenCalledWith(
        '/voiceCalls/reserveRoutableNumber',
        {
          countryCode: 'US',
          fromNumber: '+11800999932',
          context: {
            scrt2Domain: 'https://test-scrt-endpoint.com',
            toNumber: '+15551234567',
            callId: '0LQLT000001jmnt',
            transactionId: 'tx-123',
          },
        },
        { headers: { ...buildAuthHeaders(), 'Telephony-Provider-Name': 'amazon-connect' } }
      );
      expect(result).toEqual({
        statusCode: 200,
        routableNumber: '+14155560999',
        uid: 'uid-1',
        expiresAt: '2026-06-09T18:21:28Z',
        mode: 'number',
      });
    });

    it('should omit callId and transactionId from context when not provided in params or attributes', async () => {
      mockPost.mockResolvedValue({ data: { handle: {}, mode: 'number' } });

      await api.reserveRoutableNumber(
        { countryCode: 'US', fromNumber: '+11800999932', toNumber: '+15551234567' },
        {},
        mockConfigData
      );

      const sentPayload = mockPost.mock.calls[0][1];
      expect(sentPayload.context).toEqual({
        scrt2Domain: 'https://test-scrt-endpoint.com',
        toNumber: '+15551234567',
      });
    });

    it('should fall back to attributes for countryCode, callId, transactionId', async () => {
      mockPost.mockResolvedValue({ data: { handle: {}, mode: 'number' } });

      await api.reserveRoutableNumber(
        { fromNumber: '+11800999932', toNumber: '+15551234567' },
        { countryCode: 'GB', callId: 'attr-call-id', transactionId: 'attr-tx-id' },
        mockConfigData
      );

      expect(mockPost).toHaveBeenCalledWith(
        '/voiceCalls/reserveRoutableNumber',
        expect.objectContaining({
          countryCode: 'GB',
          context: expect.objectContaining({
            callId: 'attr-call-id',
            transactionId: 'attr-tx-id',
          }),
        }),
        expect.anything()
      );
    });

    it('should derive scrt2Domain.origin from configData.scrtEndpointBase even when it has a path', async () => {
      const customConfig = {
        ...mockConfigData,
        scrtEndpointBase: 'https://my-org.salesforce-scrt.com/telephony/v1',
      };
      mockPost.mockResolvedValue({ data: { handle: {}, mode: 'number' } });

      await api.reserveRoutableNumber(baseParameters, {}, customConfig);

      expect(mockPost).toHaveBeenCalledWith(
        '/voiceCalls/reserveRoutableNumber',
        expect.objectContaining({
          context: expect.objectContaining({
            scrt2Domain: 'https://my-org.salesforce-scrt.com',
          }),
        }),
        expect.anything()
      );
    });

    it('should throw when fromNumber is missing', async () => {
      await expect(
        api.reserveRoutableNumber(
          { countryCode: 'US', toNumber: '+15551234567' },
          {},
          mockConfigData
        )
      ).rejects.toThrow(/Invalid or missing fromNumber/);
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should throw when fromNumber is not in E.164 format', async () => {
      await expect(
        api.reserveRoutableNumber(
          { countryCode: 'US', fromNumber: '1800999932', toNumber: '+15551234567' },
          {},
          mockConfigData
        )
      ).rejects.toThrow(/Invalid or missing fromNumber/);
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should throw when toNumber is missing', async () => {
      await expect(
        api.reserveRoutableNumber(
          { countryCode: 'US', fromNumber: '+11800999932' },
          {},
          mockConfigData
        )
      ).rejects.toThrow(/Invalid or missing toNumber/);
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should throw when toNumber is not in E.164 format', async () => {
      await expect(
        api.reserveRoutableNumber(
          { countryCode: 'US', fromNumber: '+11800999932', toNumber: '5551234567' },
          {},
          mockConfigData
        )
      ).rejects.toThrow(/Invalid or missing toNumber/);
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should throw when countryCode is missing from both params and attributes', async () => {
      await expect(
        api.reserveRoutableNumber(
          { fromNumber: '+11800999932', toNumber: '+15551234567' },
          {},
          mockConfigData
        )
      ).rejects.toThrow('countryCode is required for reserveRoutableNumber');
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should throw a tagged error and log details when POST fails', async () => {
      const axiosError = new Error('API Error');
      axiosError.response = {
        status: 429,
        headers: { 'retry-after': '30' },
        data: { code: 'RATE_LIMITED' },
      };
      mockPost.mockRejectedValue(axiosError);

      let caught;
      try {
        await api.reserveRoutableNumber(baseParameters, {}, mockConfigData);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeDefined();
      expect(caught.message).toBe('Error reserving routable number');
      expect(caught.status).toBe(429);
      expect(caught.retryAfter).toBe('30');
      expect(caught.responseData).toEqual({ code: 'RATE_LIMITED' });

      expect(SCVLoggingUtil.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Error reserving routable number',
          context: expect.objectContaining({
            status: 429,
            retryAfter: '30',
            data: { code: 'RATE_LIMITED' },
          }),
        })
      );
    });

    it('should propagate originalFromNumber from params to payload.context.originalFromNumber', async () => {
      mockPost.mockResolvedValue({ data: { handle: {}, mode: 'number' } });

      await api.reserveRoutableNumber(
        { ...baseParameters, originalFromNumber: '+14155551111' },
        {},
        mockConfigData
      );

      const sentPayload = mockPost.mock.calls[0][1];
      expect(sentPayload.context.originalFromNumber).toBe('+14155551111');
    });

    it('should fall back to attributes.originalFromNumber when absent from params', async () => {
      mockPost.mockResolvedValue({ data: { handle: {}, mode: 'number' } });

      await api.reserveRoutableNumber(
        { countryCode: 'US', fromNumber: '+11800999932', toNumber: '+15551234567' },
        { originalFromNumber: '+14155552222' },
        mockConfigData
      );

      const sentPayload = mockPost.mock.calls[0][1];
      expect(sentPayload.context.originalFromNumber).toBe('+14155552222');
    });

    it('should omit originalFromNumber from context when not provided in params or attributes', async () => {
      mockPost.mockResolvedValue({ data: { handle: {}, mode: 'number' } });

      await api.reserveRoutableNumber(
        { countryCode: 'US', fromNumber: '+11800999932', toNumber: '+15551234567' },
        {},
        mockConfigData
      );

      const sentPayload = mockPost.mock.calls[0][1];
      expect(sentPayload.context).not.toHaveProperty('originalFromNumber');
    });

    it('should throw when originalFromNumber is present but not E.164, before any POST', async () => {
      await expect(
        api.reserveRoutableNumber(
          { ...baseParameters, originalFromNumber: '4155551111' },
          {},
          mockConfigData
        )
      ).rejects.toThrow(/Invalid originalFromNumber/);
      expect(mockPost).not.toHaveBeenCalled();
    });
  });

  describe('createVoiceCallContext', () => {
    const baseParameters = {
      fromNumber: '+14155551111',
      toNumber: '+15551234567',
      callId: '0LQxx0000004ABcGAM',
    };

    beforeEach(() => {
      utils.generateJWT.mockResolvedValue('test-jwt-token');
      utils.isValidE164.mockImplementation(
        (n) => typeof n === 'string' && /^\+[1-9]\d{1,14}$/.test(n)
      );
    });

    it('should validate, build the minimal payload, and return a shaped response', async () => {
      mockPost.mockResolvedValue({
        data: {
          status: 'success',
          mode: 'correlationID',
          handle: {
            correlationId: 'a3f2c4d8-9b7e-4c6f-8e1d-2f5a9c3b7e4d',
            expiresAt: '2026-07-15T18:45:11Z',
          },
        },
      });

      const result = await api.createVoiceCallContext(baseParameters, {}, mockConfigData);

      verifyGenerateJWT();
      expect(mockPost).toHaveBeenCalledWith(
        '/voiceCalls/createVoiceCallContext',
        {
          fromNumber: '+14155551111',
          context: {
            scrt2Domain: 'https://test-scrt-endpoint.com',
            toNumber: '+15551234567',
            callId: '0LQxx0000004ABcGAM',
          },
        },
        { headers: { ...buildAuthHeaders(), 'Telephony-Provider-Name': 'amazon-connect' } }
      );
      expect(result).toEqual({
        statusCode: 200,
        correlationId: 'a3f2c4d8-9b7e-4c6f-8e1d-2f5a9c3b7e4d',
        expiresAt: '2026-07-15T18:45:11Z',
        mode: 'correlationID',
      });
    });

    it('should fall back to attributes for callId and transactionId when absent from params', async () => {
      mockPost.mockResolvedValue({ data: { handle: {}, mode: 'correlationID' } });

      await api.createVoiceCallContext(
        { fromNumber: '+14155551111', toNumber: '+15551234567' },
        { callId: 'attr-call-id', transactionId: 'attr-tx-id' },
        mockConfigData
      );

      const sentPayload = mockPost.mock.calls[0][1];
      expect(sentPayload.context.callId).toBe('attr-call-id');
      expect(sentPayload.context.transactionId).toBe('attr-tx-id');
    });

    it('should include transactionId in context when provided in params', async () => {
      mockPost.mockResolvedValue({ data: { handle: {}, mode: 'correlationID' } });

      await api.createVoiceCallContext(
        { ...baseParameters, transactionId: 'tx-123' },
        {},
        mockConfigData
      );

      const sentPayload = mockPost.mock.calls[0][1];
      expect(sentPayload.context.transactionId).toBe('tx-123');
    });

    it('should omit transactionId from context when not provided in params or attributes', async () => {
      mockPost.mockResolvedValue({ data: { handle: {}, mode: 'correlationID' } });

      await api.createVoiceCallContext(baseParameters, {}, mockConfigData);

      const sentPayload = mockPost.mock.calls[0][1];
      expect(sentPayload.context).not.toHaveProperty('transactionId');
    });

    it('should derive scrt2Domain origin from configData.scrtEndpointBase even when it has a path', async () => {
      const customConfig = {
        ...mockConfigData,
        scrtEndpointBase: 'https://my-org.salesforce-scrt.com/telephony/v1',
      };
      mockPost.mockResolvedValue({ data: { handle: {}, mode: 'correlationID' } });

      await api.createVoiceCallContext(baseParameters, {}, customConfig);

      const sentPayload = mockPost.mock.calls[0][1];
      expect(sentPayload.context.scrt2Domain).toBe('https://my-org.salesforce-scrt.com');
    });

    it('should throw when fromNumber is missing', async () => {
      await expect(
        api.createVoiceCallContext(
          { toNumber: '+15551234567', callId: '0LQxx0000004ABcGAM' },
          {},
          mockConfigData
        )
      ).rejects.toThrow(/Invalid or missing fromNumber/);
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should throw when fromNumber is not E.164', async () => {
      await expect(
        api.createVoiceCallContext(
          { fromNumber: '4155551111', toNumber: '+15551234567', callId: '0LQxx0000004ABcGAM' },
          {},
          mockConfigData
        )
      ).rejects.toThrow(/Invalid or missing fromNumber/);
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should throw when toNumber is not E.164', async () => {
      await expect(
        api.createVoiceCallContext(
          { fromNumber: '+14155551111', toNumber: '5551234567', callId: '0LQxx0000004ABcGAM' },
          {},
          mockConfigData
        )
      ).rejects.toThrow(/Invalid or missing toNumber/);
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should omit callId from context when missing from both params and attributes', async () => {
      mockPost.mockResolvedValue({ data: { handle: {}, mode: 'correlationID' } });

      await api.createVoiceCallContext(
        { fromNumber: '+14155551111', toNumber: '+15551234567' },
        {},
        mockConfigData
      );

      const sentPayload = mockPost.mock.calls[0][1];
      expect(sentPayload.context).toEqual({
        scrt2Domain: 'https://test-scrt-endpoint.com',
        toNumber: '+15551234567',
      });
    });

    it('should throw a tagged error and log status + retry-after when POST returns 429', async () => {
      const axiosError = new Error('API Error');
      axiosError.response = {
        status: 429,
        headers: { 'retry-after': '30' },
        data: { code: 'RATE_LIMITED' },
      };
      mockPost.mockRejectedValue(axiosError);

      let caught;
      try {
        await api.createVoiceCallContext(baseParameters, {}, mockConfigData);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeDefined();
      expect(caught.message).toBe('Error creating voice call context');
      expect(caught.status).toBe(429);
      expect(caught.retryAfter).toBe('30');
      expect(caught.responseData).toEqual({ code: 'RATE_LIMITED' });
      expect(SCVLoggingUtil.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Error creating voice call context',
          context: expect.objectContaining({
            status: 429,
            retryAfter: '30',
            data: { code: 'RATE_LIMITED' },
          }),
        })
      );
    });

    it('should tag error with status 403 when POST returns 403', async () => {
      const axiosError = new Error('Forbidden');
      axiosError.response = { status: 403, headers: {}, data: { code: 'PERM_MISSING' } };
      mockPost.mockRejectedValue(axiosError);

      let caught;
      try {
        await api.createVoiceCallContext(baseParameters, {}, mockConfigData);
      } catch (err) {
        caught = err;
      }

      expect(caught.status).toBe(403);
      expect(caught.responseData).toEqual({ code: 'PERM_MISSING' });
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