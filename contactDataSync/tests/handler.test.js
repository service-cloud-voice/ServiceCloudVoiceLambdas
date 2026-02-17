const handler = require("../handler");
const transcriptUploader = require('../transcriptUploader');
const fetchUploadIdsStatus = require('../fetchUploadIdsStatus');

afterEach(() => {
  jest.clearAllMocks();
});

describe("ContactDataSync Lambda handler", () => {
  it("Test invalid operation", async () => {
    const event = {
      operation: "invalid",
      payload: [
        {
          contactId: "8c6258f0-66fa-4137-a61f-68311bb6d300",
          relatedRecords: ["0LQSB000001m5RR"],
        },
        {
          contactId: "0e900fcd-6b3b-4445-8769-b32429eb3537",
          relatedRecords: ["0LQSB000001m5RQ"],
        },
      ],
    };
    const supportedOperations = ["uploadTranscript", "fetchUploadIdsStatus"];
    const expectedResponse = {
      statusCode: 400,
      body: JSON.stringify({
        error: `Unsupported operation:${
          event.operation
        }.Supported operations:${supportedOperations.join()}`,
      }),
    };
    expect(await handler.handler(event)).toMatchObject(expectedResponse);
  });

  it('handles uploadTranscript operation', async () => {
    jest.spyOn(transcriptUploader, 'processTranscript').mockResolvedValue('result');
    const event = { operation: 'uploadTranscript', payload: [{ contactId: 'cid', relatedRecords: ['rec'] }], secretName: 'secret', accessTokenSecretName: 'access' };
    const context = { invokedFunctionArn: 'arn:aws:lambda:region:acct:function:name' };
    const res = await handler.handler(event, context);
    expect(res).toBe('result');
  });

  it('handles fetchUploadIdsStatus operation', async () => {
    jest.spyOn(fetchUploadIdsStatus, 'processFetchUploadIdsStatus').mockResolvedValue('result');
    const event = { operation: 'fetchUploadIdsStatus', uploadIds: ['id'], secretName: 'secret', accessTokenSecretName: 'access' };
    const context = {};
    const res = await handler.handler(event, context);
    expect(res).toBe('result');
  });

  it('returns error for unsupported operation', async () => {
    const event = { operation: 'badOp' };
    const context = {};
    const res = await handler.handler(event, context);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/Unsupported operation/);
  });

  it('returns error for invalid uploadTranscript payload', async () => {
    const event = { operation: 'uploadTranscript', payload: [] };
    const context = {};
    const res = await handler.handler(event, context);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/Malformed request/);
  });

  it('returns error for invalid fetchUploadIdsStatus payload', async () => {
    const event = { operation: 'fetchUploadIdsStatus', uploadIds: [] };
    const context = {};
    const res = await handler.handler(event, context);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/Malformed request/);
  });
});