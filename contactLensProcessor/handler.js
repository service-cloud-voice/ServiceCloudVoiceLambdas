const utils = require("./utils");
const api = require("./telephonyIntegrationApi");
const secretUtils = require("./secretUtils");
const signalConfig = require("./signalConfig");
const SCVLoggingUtil = require("./SCVLoggingUtil");

exports.handler = async (event) => {
  // TODO consider looking at the timestamp of the event and if it's too late then ignore
  const promises = [];
  SCVLoggingUtil.debug({
    message: "ContactLensProcessor event received",
    context: { payload: event },
  });

  const bulkSendMessagesPayload = {};
  bulkSendMessagesPayload.entries = [];
  const contactIdToMessagesMap = {};
  const contactIdToSecretMap = {}
  if (event && event.Records) {
    event.Records.forEach((record) => {
      SCVLoggingUtil.debug({
        message: "Processing event Contact",
        context: { payload: record },
      });
      const secretName = record?.secretName || process.env.SECRET_NAME;
      const kinesisPayload = utils.parseData(record.kinesis.data);
      SCVLoggingUtil.debug({
        message: "Parsed kinesis payload for Contact ",
        context: { payload: kinesisPayload },
      });
      if (kinesisPayload && kinesisPayload.EventType) {
        utils.logEventReceived(
          kinesisPayload.EventType,
          kinesisPayload.ContactId
        );
        if (
          kinesisPayload.EventType === "SEGMENTS" &&
          kinesisPayload.Segments
        ) {
          kinesisPayload.Segments.forEach((segment) => {
            if (segment.Utterance) {
              contactIdToMessagesMap[kinesisPayload.ContactId] =
                contactIdToMessagesMap[kinesisPayload.ContactId] || [];
              SCVLoggingUtil.info({
                message: "Send Message payload added for the bulk transcript",
                context: { contactId: kinesisPayload.ContactId },
              });
              contactIdToMessagesMap[kinesisPayload.ContactId].push(
                utils.buildSendMessagePayload(
                  segment.Utterance,
                  record.kinesis.approximateArrivalTimestamp
                )
              );
              contactIdToSecretMap[kinesisPayload.ContactId] = secretName;
            }
            SCVLoggingUtil.info({
              message:
                  "Segment catagories",
              context: { categories: segment.Categories },
            });
            if (signalConfig.voiceIntelligenceEnabled && segment.Categories) {
              SCVLoggingUtil.info({
                message:
                  "Events payload added for realtimeConversationEvents api",
                context: { contactId: kinesisPayload.ContactId},
              });
              promises.push(
                api.sendRealtimeConversationEvents(
                  kinesisPayload.ContactId,
                  utils.buildSendRealtimeConversationEventsPayload(
                    segment.Categories
                  ), secretName
                )
              );
            }
          });
        }
      }
    });
    SCVLoggingUtil.debug({
      message:
          "contactIdToSecretMap details",
      context: { contactId: contactIdToSecretMap },
    });
    const secretNameToContactIdMap = {}
    for(var contactId in contactIdToSecretMap){
      var secretName = contactIdToSecretMap[contactId];
      if(!secretNameToContactIdMap[secretName]){
        secretNameToContactIdMap[secretName] = [];
      }
      secretNameToContactIdMap[secretName].push(contactId);
    }
    SCVLoggingUtil.debug({
      message:
          "secretNameToContactIdMap details",
      context: { contactId: secretNameToContactIdMap},
    });
    // Iterate through contactIdMessagesMap and construct the request payload for BulkSendMessages
    for(var secretName in secretNameToContactIdMap){
      var contactIds = secretNameToContactIdMap[secretName];
      // here we are making sure that we are first getting secretName and then grouping contactIds associated with that secretName.
      for (var key of contactIds) {
      const bulkSendMessagePayload = {};
      bulkSendMessagePayload.vendorCallKey = key;
      bulkSendMessagePayload.messages = contactIdToMessagesMap[key];

      // Add to the bulkSendMessagesPayload.entries array
      bulkSendMessagesPayload.secretName = secretName
      bulkSendMessagesPayload.entries.push(bulkSendMessagePayload);
    }
    }

    SCVLoggingUtil.debug({
      message:
          "bulkSendMessagesPayload details",
      context: { contactId: bulkSendMessagesPayload },
    });

    //Call the BulkSendMessages API
    if (bulkSendMessagesPayload.entries.length > 0) {
      promises.push(api.sendMessagesInBulk(bulkSendMessagesPayload));
    }
  }

  const result = await Promise.all(promises);
  return result;
};