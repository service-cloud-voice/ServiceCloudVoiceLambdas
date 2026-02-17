module.exports = {
  connectInstanceId: process.env.CONNECT_INSTANCE_ID,
  secretName: process.env.SECRET_NAME,
  accessTokenSecretName: process.env.ACCESS_SECRET_NAME,
  maxContactIds: process.env.MAX_CONTACT_IDS,
  invokeSfRestApiArn: process.env.INVOKE_SALESFORCE_REST_API_ARN,
  batchSize: process.env.BATCH_SIZE,
  s3BucketTenantResources: process.env.S3_BUCKET_TENANT_RESOURCES,
};