const SCVLoggingUtil = require("./SCVLoggingUtil");
const queryEngine = require("./queryEngine");

class SFSPhoneCallFlow {
  static isEmptyObject(obj) {
    // method checks for empty js object. IMPORTANT: if obj is undefined or null will also return true.
    try {
      if (typeof obj === "undefined" || obj === null) return true;
      return JSON.stringify(obj) === "{}";
    } catch (ex) {
      SCVLoggingUtil.error({
        message: `isEmptyObject() exception: ${ex.message}`,
        context: { payload: ex },
      });
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

  static logx(msg) {
    if (!msg) return;
    SCVLoggingUtil.error({
      message: `\n--- ${msg}`,
      context: { payload: msg },
    });
  }

  static async getInfo(cusPhoneNumber = "", secretName, accessTokenSecretName) {
    try {
      let qry;
      let resx;

      SFSPhoneCallFlow.logx("version: 1.0.1");

      if (!cusPhoneNumber || cusPhoneNumber === "anonymous") {
        SFSPhoneCallFlow.logx("cusPhoneNumber===anonymous");
        return { success: true, statusCode: 200, status: "ANONYMOUS" };
      }

      if (!SFSPhoneCallFlow.isValidPhoneNumber(cusPhoneNumber)) {
        SFSPhoneCallFlow.logx(
          `Security test failure: invalid phone number [${cusPhoneNumber}]`
        );
        return { success: true, statusCode: 200, status: "ANONYMOUS" };
      }

      let ApptAssistantStatus = "";
      qry = "SELECT ApptAssistantStatus FROM FieldServiceOrgSettings";
      resx = await queryEngine.invokeQuery(qry, { methodName: "queryRecord" }, secretName, accessTokenSecretName);

      if (!SFSPhoneCallFlow.isEmptyObject(resx)) {
        ApptAssistantStatus = resx.ApptAssistantStatus;
        SFSPhoneCallFlow.logx(
          `ApptAssistantStatus fetched from DB as [${ApptAssistantStatus}]`
        );
      }

      if (!ApptAssistantStatus) {
        SFSPhoneCallFlow.logx(
          "ApptAssistantStatus not found in DB, Assigned to [En Route]"
        );
        ApptAssistantStatus = "En Route";
      }

      qry = `SELECT ServiceResource.RelatedRecord.Phone
              FROM AssignedResource
              WHERE (LocationStatus in ('EnRoute', 'LastMile'))
          	    AND (ServiceAppointment.Status='${ApptAssistantStatus}')
          	    AND (ServiceAppointment.Contact.Phone='${cusPhoneNumber}')
              ORDER BY AssignedResourceNumber DESC
              LIMIT 1`;

      SFSPhoneCallFlow.logx(qry);

      resx = await queryEngine.invokeQuery(qry, { methodName: "queryRecord" }, secretName, accessTokenSecretName);

      if (
        SFSPhoneCallFlow.isEmptyObject(resx) ||
        SFSPhoneCallFlow.isEmptyObject(resx.ServiceResource) ||
        SFSPhoneCallFlow.isEmptyObject(resx.ServiceResource.RelatedRecord) ||
        !resx.ServiceResource.RelatedRecord.Phone
      ) {
        SFSPhoneCallFlow.logx(
          "Assign resource not found or no phone in AssignedResource record"
        );
        return {
          success: true,
          statusCode: 200,
          msg: "Assign resource not found or no phone in AssignedResource record",
          status: "PHONE_NOT_FOUND",
        };
      }

      SFSPhoneCallFlow.logx(
        `SUCCESS: engineer's phone number found: ${resx.ServiceResource.RelatedRecord.Phone}`
      );

      return {
        success: true,
        status: "TRANSFER_CALL",
        statusCode: 200,
        engPhone: resx.ServiceResource.RelatedRecord.Phone,
      };
    } catch (ex) {
      SFSPhoneCallFlow.logx(`getInfo() exception: ${ex.message}`);
      return {
        success: true,
        statusCode: 200,
        msg: "getInfo() exception",
        status: "PHONE_NOT_FOUND",
      };
    }
  }

  static async classEntryPoint(event, secretName, accessTokenSecretName) {
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
      const res = await SFSPhoneCallFlow.getInfo(cusPhoneNumber, secretName, accessTokenSecretName);
      return res;
    } catch (ex) {
      SFSPhoneCallFlow.logx(`entryPoint() exception: ${ex.message}`);
      return {
        success: true,
        statusCode: 200,
        msg: "SFSPhoneCallFlow - Lambda event handler exception",
        status: "PHONE_NOT_FOUND",
      };
    }
  }
}

async function entryPoint(event, secretName, accessTokenSecretName) {
  const ret = await SFSPhoneCallFlow.classEntryPoint(event, secretName, accessTokenSecretName);
  return ret;
}

module.exports = {
  entryPoint,
};
