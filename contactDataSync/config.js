module.exports = {
  orgId: process.env.SALESFORCE_ORG_ID,
  connectInstanceId: process.env.CONNECT_INSTANCE_ID,
  callCenterApiName: process.env.CALL_CENTER_API_NAME,
  maxContactIds: process.env.MAX_CONTACT_IDS,
  invokeSfRestApiArn: process.env.INVOKE_SALESFORCE_REST_API_ARN,
  batchSize: process.env.BATCH_SIZE,
};
