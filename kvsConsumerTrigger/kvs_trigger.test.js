const AWS = require("aws-sdk");

AWS.config = {};

const mockInvokeAsync = jest.fn();
/*eslint-disable */
jest.mock("aws-sdk", () => ({
  Lambda: function() {
    this.invokeAsync = mockInvokeAsync
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
              StartTimestamp: "2004-05-01 12:03:34"
            }
          }
        },
        CustomerEndpoint: {
          Address: "123-456-7890"
        },
        ContactId: "7bf73129-1428-4cd3-a780-95db273d1602",
        Attributes: {
          streamAudioFromCustomer: true,
          streamAudioToCustomer: true,
          languageCode: "en-US"
        },
        InstanceARN:
          "arn:aws:connect:us-east-1:123456789012:instance/b6070940-51ab-4aa2-97df-6e6bf6950458"
      },
      Parameters: {}
    }
  };

  const inputEventCustom = JSON.parse(JSON.stringify(inputEvent));
  inputEventCustom.Details.Parameters = {
    vocabularyName: "VocabName",
    vocabularyFilterName: "VocabFilterName",
    vocabularyFilterMethod: "MASK"
  };

  const inputEventMedical = JSON.parse(JSON.stringify(inputEvent));
  inputEventMedical.Details.Parameters = {
    engine: "medical",
    specialty: "ONCOLOGY"
  };

  beforeEach(() => {
    mockInvokeAsync.mockImplementation(() => ({ lambdaResult: "Success" }));
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
    myHandler(inputEvent, {}, (err, data) => data);
    expect(mockInvokeAsync).toHaveBeenCalledTimes(1);
  });

  it("should return expected message", () => {
    myHandler(inputEvent, {}, (err, data) => data);
    expect(mockInvokeAsync()).toStrictEqual({ lambdaResult: "Success" });
  });

  it("should be called with expected params", () => {
    myHandler(inputEvent, {}, (err, data) => data);
    let actualParams = mockInvokeAsync.mock.calls[0][0];
    actualParams = JSON.parse(actualParams.InvokeArgs);
    assertParams(actualParams);
    expect(actualParams.engine).toBe("standard");
  });

  it("should be called with expected custom params", () => {
    myHandler(inputEventCustom, {}, (err, data) => data);
    let actualParams = mockInvokeAsync.mock.calls[0][0];
    actualParams = JSON.parse(actualParams.InvokeArgs);
    assertParams(actualParams);
    expect(actualParams.vocabularyName).toBe("VocabName");
    expect(actualParams.vocabularyFilterName).toBe("VocabFilterName");
    expect(actualParams.vocabularyFilterMethod).toBe("MASK");
  });

  it("should be called with expected medical params", () => {
    myHandler(inputEventMedical, {}, (err, data) => data);
    let actualParams = mockInvokeAsync.mock.calls[0][0];
    actualParams = JSON.parse(actualParams.InvokeArgs);
    assertParams(actualParams);
    expect(actualParams.engine).toBe("medical");
    expect(actualParams.specialty).toBe("ONCOLOGY");
  });
});
