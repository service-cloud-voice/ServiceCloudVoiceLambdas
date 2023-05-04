const SCVLoggingUtil = require("./SCVLoggingUtil");
const AWS = require('aws-sdk');
const lambda = new AWS.Lambda();

exports.handler = async (event) => {
  SCVLoggingUtil.debug({
    category: "contactLensConsumer.handler",
    message: "Received event",
    context: event,
  });
  // Update existing ContactLens consumer Lambda to only process events from Kinesis and 
  // Invoke a new processor Lambda with the event payload.
  if (event && event.Records) {
    if (event.Records.length > 5) {
      SCVLoggingUtil.error({
        message: `ContactLensConsumer batch size is more than the recommended limit of 5. Actual batch size - ${event.Records.length}`,
        eventType: "TRANSCRIPTION",
        context: {},
        category: "contactLensConsumer.handler",
      });

      return { data: { result: "Success" } };
    }
    const params = {
      FunctionName: process.env.CONTACT_LENS_PROCESSOR_FUNCTION_ARN,
      InvocationType: 'Event',
      Payload: JSON.stringify(event),
    };
    
    const result = await lambda.invoke(params).promise();
    
    SCVLoggingUtil.info({
      category: "contactLensConsumer.handler",
      eventType: "TRANSCRIPTION",
      message: "Sent kinesis event to the processor lambda",
      context: { response: result },
    });
  }
 return { data: { result: "Success" } };
};
