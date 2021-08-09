const AWS = require("aws-sdk");

AWS.config = {};

const mockInvokeAsync = jest.fn();
/*eslint-disable */
jest.mock('aws-sdk', () => ({
    Lambda: function() {
        this.invokeAsync = mockInvokeAsync
    },
}));
/* eslint-enable */
const myHandler = require("./kvs_trigger").handler;

describe("Unit test for kvs_trigger.js", () => {
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
      }
    }
  };

  beforeEach(() => {
    mockInvokeAsync.mockImplementation(() => ({ lambdaResult: "Success" }));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("lambda should be invoked once", () => {
    myHandler(inputEvent, {}, (err, data) => data);
    expect(mockInvokeAsync).toHaveBeenCalledTimes(1);
  });

  it("lambda should return expected message", () => {
    myHandler(inputEvent, {}, (err, data) => data);
    expect(mockInvokeAsync()).toStrictEqual({ lambdaResult: "Success" });
  });

  it("lambda should be called with expected params", () => {
    myHandler(inputEvent, {}, (err, data) => data);
    let actualParams = mockInvokeAsync.mock.calls[0][0];
    actualParams = JSON.parse(actualParams.InvokeArgs);
    expect(actualParams.streamARN).toBe(
      "arn:aws:kinesis:*:111122223333:stream/my-stream"
    );
    expect(actualParams.startFragmentNum).toBe(1);
    expect(actualParams.audioStartTimestamp).toBe("2004-05-01 12:03:34");
    expect(actualParams.customerPhoneNumber).toBe("123-456-7890");
    expect(actualParams.voiceCallId).toBe(
      "7bf73129-1428-4cd3-a780-95db273d1602"
    );
    expect(actualParams.languageCode).toBe("en-US");
    expect(actualParams.streamAudioFromCustomer).toBe(true);
    expect(actualParams.streamAudioToCustomer).toBe(true);
    expect(actualParams.instanceARN).toBe(
      "arn:aws:connect:us-east-1:123456789012:instance/b6070940-51ab-4aa2-97df-6e6bf6950458"
    );
  });
});
