module.exports = {
  logLevel: process.env.LOG_LEVEL,
  invokeTelephonyIntegrationApiArn:
    process.env.INVOKE_TELEPHONY_INTEGRATION_API_ARN,
  secretCacheS3: process.env.SECRET_CACHE_S3,
  audience: 'https://scrt.salesforce.com',
  tokenValidFor: '5m',
};