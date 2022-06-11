const SCVLoggingUtil = require("./SCVLoggingUtil");
const queryEngine = require("./queryEngine");

class SFSPhoneCallFlow {
  static isEmptyObject(obj) {
    // method checks for empty js object. IMPORTANT: if obj is undefined or null will also return true.
    try {
      if (typeof obj === "undefined" || obj === null) return true;
      return JSON.stringify(obj) === "{}";
    } catch (ex) {
      SCVLoggingUtil.error(
        "invokeSfRestApi.handler.handler",
        SCVLoggingUtil.EVENT_TYPE.VOICECALL,
        `isEmptyObject() exception: ${ex.message}`,
        {}
      );
      return true;
    }
  }

  static isValidPhoneNumber(p) {
    try {
      if (!p || p.length < 8 || p.length > 20) return false;
      return /^[+{0,1}][0-9]+$/.test(p); // can have + as first char and only digits after
    } catch (ex) {
      return false;
    }
  }

  static async getInfo(cusPhoneNumber = "") {
    try {
      if (!cusPhoneNumber || cusPhoneNumber === "anonymous") {
        return { success: true, statusCode: 200, status: "ANONYMOUS" };
      }

      if (!SFSPhoneCallFlow.isValidPhoneNumber(cusPhoneNumber)) {
        SCVLoggingUtil.error(
          "invokeSfRestApi.handler.handler",
          SCVLoggingUtil.EVENT_TYPE.VOICECALL,
          `Security test failure: invalid phone number [${cusPhoneNumber}]`,
          {}
        );
        return { success: true, statusCode: 200, status: "ANONYMOUS" };
      }

      const qry = `SELECT ServiceResource.RelatedRecord.Phone
          FROM AssignedResource
          WHERE LocationStatus='EnRoute' AND (ServiceAppointment.Status='En Route') AND (ServiceAppointment.Contact.Phone='${cusPhoneNumber}')`;

      const resx = await queryEngine.invokeQuery(qry, {
        methodName: "queryRecord"
      });

      if (
        SFSPhoneCallFlow.isEmptyObject(resx) ||
        SFSPhoneCallFlow.isEmptyObject(resx.ServiceResource) ||
        SFSPhoneCallFlow.isEmptyObject(resx.ServiceResource.RelatedRecord) ||
        !resx.ServiceResource.RelatedRecord.Phone
      ) {
        return {
          success: true,
          statusCode: 200,
          msg:
            "Assign resource not found or no phone in AssignedResource record",
          status: "PHONE_NOT_FOUND"
        };
      }
      return {
        success: true,
        status: "TRANSFER_CALL",
        statusCode: 200,
        engPhone: resx.ServiceResource.RelatedRecord.Phone
      };
    } catch (ex) {
      SCVLoggingUtil.error(
        "invokeSfRestApi.handler.handler",
        SCVLoggingUtil.EVENT_TYPE.VOICECALL,
        `getInfo() exception: ${ex.msg}`,
        {}
      );
      return {
        success: true,
        statusCode: 200,
        msg: "getInfo() exception",
        status: "PHONE_NOT_FOUND"
      };
    }
  }

  static async classEntryPoint(event) {
    try {
      let cusPhoneNumber = "anonymous";
      if (
        event &&
        event.Details &&
        event.Details.ContactData &&
        event.Details.ContactData.CustomerEndpoint &&
        event.Details.ContactData.CustomerEndpoint.Address
      ) {
        cusPhoneNumber = event.Details.ContactData.CustomerEndpoint.Address;
      }
      const res = await SFSPhoneCallFlow.getInfo(cusPhoneNumber);
      return res;
    } catch (ex) {
      SCVLoggingUtil.error(
        "invokeSfRestApi.handler.handler",
        SCVLoggingUtil.EVENT_TYPE.VOICECALL,
        `entryPoint() exception: ${ex.msg}`,
        {}
      );
      return {
        success: true,
        statusCode: 200,
        msg: "SFSPhoneCallFlow - Lambda event handler exception",
        status: "PHONE_NOT_FOUND"
      };
    }
  }
}

async function entryPoint(event) {
  const ret = await SFSPhoneCallFlow.classEntryPoint(event);
  return ret;
}

module.exports = {
  entryPoint
};
