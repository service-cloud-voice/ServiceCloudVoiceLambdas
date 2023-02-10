const utils = require("./utils");
const api = require("./telephonyIntegrationApi");
const signalConfig = require("./signalConfig");
const SCVLoggingUtil = require("./SCVLoggingUtil");

exports.handler = async (event) => {
  // TODO consider looking at the timestamp of the event and if it's too late then ignore
  const promises = [];
  SCVLoggingUtil.debug({
    category: "contactLensConsumer.handler",
    message: "Received event",
    context: event,
  });
  if (event && event.Records) {
    event.Records.forEach((record) => {
      SCVLoggingUtil.debug({
        category: "contactLensConsumer.handler",
        message: "Processing event record",
        context: record,
      });
      const kinesisPayload = utils.parseData(record.kinesis.data);
      SCVLoggingUtil.debug({
        category: "contactLensConsumer.handler",
        message: "Parsed kinesis payload",
        context: kinesisPayload,
      });
      if (kinesisPayload && kinesisPayload.EventType) {
        utils.logEventReceived(kinesisPayload.EventType);
        if (
          kinesisPayload.EventType === "SEGMENTS" &&
          kinesisPayload.Segments
        ) {
          kinesisPayload.Segments.forEach((segment) => {
            if (segment.Utterance) {
              promises.push(
                api.sendMessage(
                  kinesisPayload.ContactId,
                  utils.buildSendMessagePayload(
                    segment.Utterance,
                    record.kinesis.approximateArrivalTimestamp
                  )
                )
              );
            }
            if (
              signalConfig.voiceIntelligenceEnabled &&
              segment.Categories
            ) {
              promises.push(
                api.sendRealtimeConversationEvents(
                  kinesisPayload.ContactId,
                  utils.buildSendRealtimeConversationEventsPayload(segment.Categories)
                )
              );
            }
          });
        }
      }
    });
  }

  const x = await Promise.all(promises);
  return x;
};
