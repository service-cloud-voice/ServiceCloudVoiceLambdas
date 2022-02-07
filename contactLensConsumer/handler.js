const utils = require("./utils");
const api = require("./telephonyIntegrationApi");

exports.handler = async event => {
  // TODO consider looking at the timestamp of the event and if it's too late then ignore
  const promises = [];

  if (event && event.Records) {
    event.Records.forEach(record => {
      const kinesisPayload = JSON.parse(
        Buffer.from(record.kinesis.data, "base64").toString("ascii")
      );

      if (kinesisPayload && kinesisPayload.EventType) {
        utils.logEventReceived(kinesisPayload.EventType);

        if (
          kinesisPayload.EventType === "SEGMENTS" &&
          kinesisPayload.Segments
        ) {
          kinesisPayload.Segments.forEach(segment => {
            if (segment.Transcript) {
              promises.push(
                api.sendMessage(
                  kinesisPayload.ContactId,
                  utils.buildSendMessagePayload(
                    segment.Transcript,
                    record.kinesis.approximateArrivalTimestamp
                  )
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
