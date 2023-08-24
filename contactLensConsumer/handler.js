const SCVLoggingUtil = require("./SCVLoggingUtil");
const AWS = require("aws-sdk");
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
    const params = {
      FunctionName: process.env.CONTACT_LENS_PROCESSOR_FUNCTION_ARN,
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
