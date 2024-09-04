require("dotenv").config();
const config = require("../config.js");
jest.mock("../axiosWrapper");
const axiosWrapper = require("../axiosWrapper.js");

jest.mock("../utils");
const utils = require("../utils.js");

const queryEngine = require("../queryEngine.js");
const api = require("../sfRestApi.js");

afterEach(() => {
  jest.clearAllMocks();
});

describe("createRecord", () => {
  it("creates a record sucessfully using the api", async () => {
    const data = {
      id: "1234",
      errors: [],
      success: true,
    };
    utils.getAccessToken.mockImplementationOnce(() =>
      Promise.resolve("test1234")
    );
    axiosWrapper.apiEndpoint.mockImplementationOnce(() =>
      Promise.resolve({ data: data })
    );

    const responseData = {
      recordId: "1234",
      success: true,
    };

    await expect(
      await api.createRecord(("Account", { Name: "Test Account 1" }))
    ).toEqual(responseData);
  });

  it("creates a record on an erroneous object using the api", async () => {
    const error = {
      response: {
        success: false,
        status: 404,
        statusText: "not found",
        data: [
          {
            message: "The requested resource does not exist",
            errorCode: "NOT_FOUND",
          },
        ],
      },
    };
    utils.getAccessToken.mockImplementationOnce(() =>
      Promise.resolve("test1234")
    );
    axiosWrapper.apiEndpoint.mockImplementationOnce(() =>
      Promise.reject(error)
    );

    const errorResponse = {
      success: false,
      status: 404,
      statusText: "not found",
      errorMessage: "The requested resource does not exist",
      errorCode: "NOT_FOUND",
    };

    await expect(
      await api.createRecord("Accountttt", { Name: "Test Account 1" })
    ).toEqual(errorResponse);
  });
});

describe("updateRecord", () => {
  it("updates a record sucessfully using the api", async () => {
    const data = "";
    utils.getAccessToken.mockImplementationOnce(() =>
      Promise.resolve("test1234")
    );
    axiosWrapper.apiEndpoint.mockImplementationOnce(() =>
      Promise.resolve({ data: "" })
    );

    const responseData = {
      success: true,
    };

    await expect(
      await api.updateRecord(("Account", "1234", { Name: "Test Account 1" }))
    ).toEqual(responseData);
  });

  it("updates a record on an erroneous object using the api", async () => {
    const error = {
      response: {
        success: false,
        status: 404,
        statusText: "not found",
        data: [
          {
            message: "The requested resource does not exist",
            errorCode: "NOT_FOUND",
          },
        ],
      },
    };
    utils.getAccessToken.mockImplementationOnce(() =>
      Promise.resolve("test1234")
    );
    axiosWrapper.apiEndpoint.mockImplementationOnce(() =>
      Promise.reject(error)
    );

    const errorResponse = {
      success: false,
      status: 404,
      statusText: "not found",
      errorMessage: "The requested resource does not exist",
      errorCode: "NOT_FOUND",
    };

    await expect(
      await api.updateRecord("Accountttt", "1234", { Name: "Test Account 1" })
    ).toEqual(errorResponse);
  });
});

describe("queryRecord", () => {
  it("queries a record sucessfully using the api", async () => {
    const data = {
      totalSize: 1,
      done: true,
      records: [
        {
          attributes: {
            type: "Contact",
            url: "/services/data/v38.0/sobjects/Contact/003R000000CkrMNIAZ",
          },
          Name: "Marc Benioff",
        },
      ],
    };

    utils.getAccessToken.mockImplementationOnce(() =>
      Promise.resolve("test1234")
    );

    axiosWrapper.apiEndpoint.mockImplementationOnce(() =>
      Promise.resolve({ data: data })
    );
    const soql = "SELECT NAME FROM CONTACT WHERE NAME = 'MARC BENIOFF'";
    await expect(await api.queryRecord(soql)).toEqual({
      Name: data.records[0].Name,
    });

    expect(axiosWrapper.apiEndpoint).toHaveBeenCalledWith({
      data: undefined,
      headers: { Authorization: "Bearer test1234" },
      method: "get",
      url: "/query/?q=SELECT%20NAME%20FROM%20CONTACT%20WHERE%20NAME%20%3D%20'MARC%20BENIOFF'",
    });
  });
  it("queries a record with an erroneous soql statement", async () => {
    const error = {
      response: {
        success: false,
        status: 400,
        statusText: "Bad Request",
        data: [
          {
            message: "unexpected token",
            errorCode: "Malformed_Query",
          },
        ],
      },
    };
    utils.getAccessToken.mockImplementationOnce(() =>
      Promise.resolve("test1234")
    );
    axiosWrapper.apiEndpoint.mockImplementationOnce(() =>
      Promise.reject(error)
    );
    const soql = "SELECTT NAME FROM CONTACT WHERE NAME = 'MARC BENIOFF'";

    const errorResponse = {
      success: false,
      status: 400,
      statusText: "Bad Request",
      errorMessage: "unexpected token",
      errorCode: "Malformed_Query",
    };
    await expect(await api.queryRecord(soql)).toEqual(errorResponse);
  });
  it("queries a record with no match", async () => {
    const data = {
      totalSize: 0,
      done: true,
      records: [],
    };
    utils.getAccessToken.mockImplementationOnce(() =>
      Promise.resolve("test1234")
    );
    axiosWrapper.apiEndpoint.mockImplementationOnce(() =>
      Promise.resolve({ data: data })
    );
    const soql = "SELECT NAME FROM CONTACT WHERE NAME = 'MARCO BENIOFF'";

    await expect(await api.queryRecord(soql)).toEqual({});
  });
});

describe("searchRecord", () => {
  it("searches a record sucessfully using the api", async () => {
    const data = {
      searchRecords: [
        {
          attributes: {
            type: "Contact",
            url: "/services/data/v38.0/sobjects/User/005R0000000g2oDIAQ",
          },
          FirstName: "Marc",
        },
      ],
    };
    utils.getAccessToken.mockImplementationOnce(() =>
      Promise.resolve("test1234")
    );

    axiosWrapper.apiEndpoint.mockImplementationOnce(() =>
      Promise.resolve({ data: data })
    );
    const sosl = "Find {Marc} In All Fields Returning Contact(FirstName)";
    await expect(await api.searchRecord(sosl)).toEqual(data.searchRecords[0]);

    expect(axiosWrapper.apiEndpoint).toHaveBeenCalledWith({
      data: undefined,
      headers: { Authorization: "Bearer test1234" },
      method: "get",
      url: "/search/?q=Find%20%7BMarc%7D%20In%20All%20Fields%20Returning%20Contact(FirstName)",
    });
  });
  it("searches a record with an erroneous sosl statement", async () => {
    const error = {
      response: {
        success: false,
        status: 400,
        statusText: "Bad Request",
        data: [
          {
            message: "unexpected token",
            errorCode: "Malformed_Search",
          },
        ],
      },
    };
    utils.getAccessToken.mockImplementationOnce(() =>
      Promise.resolve("test1234")
    );
    axiosWrapper.apiEndpoint.mockImplementationOnce(() =>
      Promise.reject(error)
    );
    const sosl = "Find {Marc} In All Fields Returning Contact(FirstName)";

    const errorResponse = {
      success: false,
      status: 400,
      statusText: "Bad Request",
      errorMessage: "unexpected token",
      errorCode: "Malformed_Search",
    };
    await expect(await api.searchRecord(sosl)).toEqual(errorResponse);
  });
  it("searches a record with no match", async () => {
    const data = {
      searchRecords: [],
    };
    utils.getAccessToken.mockImplementationOnce(() =>
      Promise.resolve("test1234")
    );
    axiosWrapper.apiEndpoint.mockImplementationOnce(() =>
      Promise.resolve({ data: data })
    );
    const sosl = "Find {Marco} In All Fields Returning Contact(FirstName)";

    await expect(await api.searchRecord(sosl)).toEqual({});
  });
});

describe("invokeQueryEngine", () => {
  it("Should format the query properly", () => {
    const query = "SELECT {name} FROM Account";
    const args = { name: "Test User" };
    expect(queryEngine.formatQuery(args, query)).toEqual(
      "SELECT Test User FROM Account"
    );
  });
});

describe("sendRealtimeAlertEvent", () => {
  it("sends realtime alert event with missing mandatory field", async () => {
    const error = {
      response: {
        success: false,
        status: 400,
        statusText: "Bad Request",
        data: [
          {
            message: "You must enter a value: AlertName",
            errorCode: "REQUIRED_FIELD_MISSING",
            fields: ["AlertName"],
          },
        ],
      },
    };
    utils.getAccessToken.mockImplementationOnce(() =>
      Promise.resolve("test1234")
    );
    axiosWrapper.apiEndpoint.mockImplementationOnce(() =>
      Promise.reject(error)
    );

    const responseData = {
      success: false,
      status: 400,
      statusText: "Bad Request",
      errorMessage: "You must enter a value: AlertName",
      errorCode: "REQUIRED_FIELD_MISSING",
    };
    await expect(
      await api.sendRealtimeAlertEvent({
        AlertName: "lambda error",
        AlertDescription: "errors in lambda invocation",
        Source: "source",
        Severity: "Critical",
        AlertInfo: "alert info",
        AlertDateTime: "2021-10-18T10:34:24.000Z",
      })
    ).toEqual(responseData);
  });

  it("sends realtime alert platform event successfully", async () => {
    const data = {
      success: true,
      id: "0rexx0000000001AAA",
      errors: [
        {
          statusCode: "OPERATION_ENQUEUED",
          message: "f418b2b4-25bf-460e-b3c2-b895ddee7454",
          fields: [],
        },
      ],
    };

    utils.getAccessToken.mockImplementationOnce(() =>
      Promise.resolve("test1234")
    );
    axiosWrapper.apiEndpoint.mockImplementationOnce(() =>
      Promise.resolve({ data: data })
    );

    const responseData = {
      success: true,
      id: "0rexx0000000001AAA",
      errors: [
        {
          statusCode: "OPERATION_ENQUEUED",
          message: "f418b2b4-25bf-460e-b3c2-b895ddee7454",
          fields: [],
        },
      ],
    };
    await expect(
      await api.sendRealtimeAlertEvent({
        AlertName: "lambda error",
        AlertDescription: "errors in lambda invocation",
        Source: "source",
        Severity: "Critical",
        AlertInfo: "alert info",
        AlertDateTime: "2021-10-18T10:34:24.000Z",
      })
    ).toEqual(responseData);
  });
});

describe("uploadTranscript", () => {
  it("uploadTranscript successfully", async () => {
    const data = {
      StatusCode: 200,
      Payload:
        '{"conversationBulkUploadsResults":[{"conversationIdentifier":"faaa3a21-5990-48cd-a035-e85ca8c861ff","errorDetail":null,"status":"SUCCESS","uploadId":"5a144ac1-3774-3018-896e-ccae9c86cdfc"}]}',
    };

    utils.getAccessToken.mockImplementationOnce(() =>
      Promise.resolve("test1234")
    );
    axiosWrapper.apiEndpoint.mockImplementationOnce(() =>
      Promise.resolve({ data: data })
    );

    const responseData = {
      StatusCode: 200,
      Payload:
        '{"conversationBulkUploadsResults":[{"conversationIdentifier":"faaa3a21-5990-48cd-a035-e85ca8c861ff","errorDetail":null,"status":"SUCCESS","uploadId":"5a144ac1-3774-3018-896e-ccae9c86cdfc"}]}',
    };

    const payload = new Map();
    const convTranscripts =
      '{"type": "conversation", "payload": {"conversationId": "faaa3a21-5990-48cd-a035-e85ca8c861ff"}}\n' +
      '{"type": "conversationEntry", "payload": {"conversationId": "faaa3a21-5990-48cd-a035-e85ca8c861ff", "id": "4", "clientSentTimestamp": 1704397759228, "clientDuration": 1, "messageText":"Hi there","sender": {"appType": "TELEPHONY_INTEGRATION", "subject": "faaa3a21-5990-48cd-a035-e85ca8c861ffEND_USER","role": "END_USER"}, "relatedRecords": ["0LQSB000001m5RR"] }}';
    payload.set("faaa3a21-5990-48cd-a035-e85ca8c861ff", convTranscripts);
    const request = JSON.stringify(Array.from(payload.entries()));
    await expect(await api.uploadTranscript(request)).toEqual(responseData);
  });
});
