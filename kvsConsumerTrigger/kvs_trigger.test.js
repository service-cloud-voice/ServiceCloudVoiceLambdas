const AWS = require("aws-sdk");

AWS.config = {};

const mockInvoke = jest.fn();
/*eslint-disable */
jest.mock("aws-sdk", () => ({
  Lambda: function() {
    this.invoke = mockInvoke
  },
}));
/* eslint-enable */
const myHandler = require("./kvs_trigger").handler;

describe("Unit tests for kvs_trigger.js", () => {
  const inputEvent = {
    Details: {
      ContactData: {
        MediaStreams: {
          Customer: {
            Audio: {
              StreamARN: "arn:aws:kinesis:*:111122223333:stream/my-stream",
              StartFragmentNumber: 1,
              StartTimestamp: "2004-05-01 12:03:34",
            },
          },
        },
        CustomerEndpoint: {
          Address: "123-456-7890",
        },
        ContactId: "7bf73129-1428-4cd3-a780-95db273d1602",
        Attributes: {
          streamAudioFromCustomer: true,
          streamAudioToCustomer: true,
          languageCode: "en-US",
        },
        InstanceARN:
          "arn:aws:connect:us-east-1:123456789012:instance/b6070940-51ab-4aa2-97df-6e6bf6950458",
      },
      Parameters: {},
    },
  };

  const inputEventCustom = JSON.parse(JSON.stringify(inputEvent));
  inputEventCustom.Details.Parameters = {
    vocabularyName: "VocabName",
    vocabularyFilterName: "VocabFilterName",
    vocabularyFilterMethod: "MASK",
  };

  const inputEventMedical = JSON.parse(JSON.stringify(inputEvent));
  inputEventMedical.Details.Parameters = {
    engine: "medical",
    specialty: "ONCOLOGY",
  };

  const inputEventWithSecretName = JSON.parse(JSON.stringify(inputEvent));
  inputEventWithSecretName.Details.ContactData.Attributes.secretName = "custom-secret-name";

  beforeEach(() => {
    mockInvoke.mockImplementation(() => ({ lambdaResult: "Success" }));
    mockInvoke.mockClear(); // Ensure we clear previous calls
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  function assertParams(params) {
    expect(params.streamARN).toBe(
      "arn:aws:kinesis:*:111122223333:stream/my-stream"
    );
    expect(params.startFragmentNum).toBe(1);
    expect(params.audioStartTimestamp).toBe("2004-05-01 12:03:34");
    expect(params.customerPhoneNumber).toBe("123-456-7890");
    expect(params.voiceCallId).toBe("7bf73129-1428-4cd3-a780-95db273d1602");
    expect(params.languageCode).toBe("en-US");
    expect(params.streamAudioFromCustomer).toBe(true);
    expect(params.streamAudioToCustomer).toBe(true);
    expect(params.instanceARN).toBe(
      "arn:aws:connect:us-east-1:123456789012:instance/b6070940-51ab-4aa2-97df-6e6bf6950458"
    );
  }

  it("should be invoked once", () => {
    process.env.SECRET_NAME = "test-secret-name";
    myHandler(inputEvent, {}, (err, data) => data);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    delete process.env.SECRET_NAME;
  });

  it("should return expected message", () => {
    process.env.SECRET_NAME = "test-secret-name";
    myHandler(inputEvent, {}, (err, data) => data);
    expect(mockInvoke()).toStrictEqual({ lambdaResult: "Success" });
    delete process.env.SECRET_NAME;
  });

  it("should be called with expected params", () => {
    process.env.SECRET_NAME = "test-secret-name";
    myHandler(inputEvent, {}, (err, data) => data);
    let actualParams = mockInvoke.mock.calls[0][0];
    actualParams = JSON.parse(actualParams.Payload);
    assertParams(actualParams);
    expect(actualParams.InvocationType === "Event");
    expect(actualParams.engine).toBe("standard");
    expect(actualParams.secretName).toBe("test-secret-name");
    delete process.env.SECRET_NAME;
  });

  it("should be called with expected custom params", () => {
    process.env.SECRET_NAME = "test-secret-name";
    myHandler(inputEventCustom, {}, (err, data) => data);
    let actualParams = mockInvoke.mock.calls[0][0];
    actualParams = JSON.parse(actualParams.Payload);
    assertParams(actualParams);
    expect(actualParams.vocabularyName).toBe("VocabName");
    expect(actualParams.vocabularyFilterName).toBe("VocabFilterName");
    expect(actualParams.vocabularyFilterMethod).toBe("MASK");
    expect(actualParams.InvocationType === "Event");
    expect(actualParams.secretName).toBe("test-secret-name");
    delete process.env.SECRET_NAME;
  });

  it("should be called with expected medical params", () => {
    process.env.SECRET_NAME = "test-secret-name";
    myHandler(inputEventMedical, {}, (err, data) => data);
    let actualParams = mockInvoke.mock.calls[0][0];
    actualParams = JSON.parse(actualParams.Payload);
    assertParams(actualParams);
    expect(actualParams.engine).toBe("medical");
    expect(actualParams.specialty).toBe("ONCOLOGY");
    expect(actualParams.InvocationType === "Event");
    expect(actualParams.secretName).toBe("test-secret-name");
    delete process.env.SECRET_NAME;
  });

  it("should be called with secretName when provided in call attributes", () => {
    myHandler(inputEventWithSecretName, {}, (err, data) => data);
    let actualParams = mockInvoke.mock.calls[0][0];
    actualParams = JSON.parse(actualParams.Payload);
    assertParams(actualParams);
    expect(actualParams.secretName).toBe("custom-secret-name");
    expect(actualParams.InvocationType === "Event");
  });

  it("should use SECRET_NAME environment variable when not provided in call attributes", () => {
    process.env.SECRET_NAME = "default-secret-name";
    myHandler(inputEvent, {}, (err, data) => data);
    let actualParams = mockInvoke.mock.calls[0][0];
    actualParams = JSON.parse(actualParams.Payload);
    assertParams(actualParams);
    expect(actualParams.secretName).toBe("default-secret-name");
    expect(actualParams.InvocationType === "Event");
    delete process.env.SECRET_NAME;
  });

  it("should throw error when no secretName available from attributes or environment", () => {
    delete process.env.SECRET_NAME;
    expect(() => {
      myHandler(inputEvent, {}, (err, data) => data);
    }).toThrow('Secret name not provided in call attributes or SECRET_NAME environment variable');
  });
});