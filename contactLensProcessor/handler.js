const utils = require("./utils");
const api = require("./telephonyIntegrationApi");
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

  if (event && event.Records) {
    event.Records.forEach((record) => {
      SCVLoggingUtil.debug({
        message: "Processing event Contact",
        context: { payload: record },
      });
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
            }
            if (signalConfig.voiceIntelligenceEnabled && segment.Categories) {
              SCVLoggingUtil.info({
                message:
                  "Events payload added for realtimeConversationEvents api",
                context: { contactId: kinesisPayload.ContactId },
              });
              promises.push(
                api.sendRealtimeConversationEvents(
                  kinesisPayload.ContactId,
                  utils.buildSendRealtimeConversationEventsPayload(
                    segment.Categories
                  )
                )
              );
            }
          });
        }
      }
    });

    // Iterate through contactIdMessagesMap and construct the request payload for BulkSendMessages
    for (var key in contactIdToMessagesMap) {
      const bulkSendMessagePayload = {};

      bulkSendMessagePayload.vendorCallKey = key;
      bulkSendMessagePayload.messages = contactIdToMessagesMap[key];

      // Add to the bulkSendMessagesPayload.entries array
      bulkSendMessagesPayload.entries.push(bulkSendMessagePayload);
    }

    //Call the BulkSendMessages API
    if (bulkSendMessagesPayload.entries.length > 0) {
      promises.push(api.sendMessagesInBulk(bulkSendMessagesPayload));
    }
  }

  const result = await Promise.all(promises);
  return result;
};
