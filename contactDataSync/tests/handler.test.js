const handler = require("../handler");

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
});
