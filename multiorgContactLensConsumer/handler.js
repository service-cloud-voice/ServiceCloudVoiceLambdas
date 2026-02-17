const SCVLoggingUtil = require("./SCVLoggingUtil");
const AWS = require("aws-sdk");
const config = require("./config");
const cacheUtils = require("./cacheUtils");

const lambda = new AWS.Lambda();

exports.handler = async (event) => {
  SCVLoggingUtil.debug({
    message: "ContactLensConsumer event received ",
    context: { payload: event },
  });
  // Update existing ContactLens consumer Lambda to only process events from Kinesis and
  // Invoke a new processor Lambda with the event payload.
  if (event && event.Records) {
    if (event.Records.length > 5) {
      SCVLoggingUtil.error({
        message: `ContactLensConsumer batch size is more than the recommended limit of 5. Actual batch size - ${event.Records.length}`,
        context: {},
      });

      return { data: { result: "Success" } };
    }

    await Promise.all(event.Records.map(async (record) => {
      try {
        // Decode the base64 kinesis data
        const decodedData = Buffer.from(record.kinesis.data, 'base64').toString('utf-8');
        const parsedData = JSON.parse(decodedData);
        const contactId = parsedData.ContactId;
        // Get secretName from cache
        const cacheData = await cacheUtils.retrieveFromCache(contactId);
        if (cacheData && cacheData.secretName) {
          record.secretName = cacheData.secretName;
        } else {
          SCVLoggingUtil.error({
            message: "No secretName found in cache for ContactId",
            context: { contactId },
          });
        }
      } catch (error) {
        SCVLoggingUtil.error({
          message: "Error processing kinesis record",
          context: { error: error.message, record },
        });
      }
    }));

    const params = {
      FunctionName: config.contactLensProcessorFunctionArn,
      InvocationType: "Event",
      Payload: JSON.stringify(event),
    };

    const result = await lambda.invoke(params).promise();

    SCVLoggingUtil.info({
      message: "Sent kinesis event to the processor lambda",
      context: { payload: result },
    });
  }
  return { data: { result: "Success" } };
};