module.exports = {
  logLevel: process.env.LOG_LEVEL,
  invokeTelephonyIntegrationApiArn:
    process.env.INVOKE_TELEPHONY_INTEGRATION_API_ARN,
  delayBeforeRoutingVmSec: process.env.DELAY_BEFORE_ROUTING_VM_SEC || 60,
  secretName: process.env.SECRET_NAME,
  secretCacheS3: process.env.SECRET_CACHE_S3,
};