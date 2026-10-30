const config = require('../config');
const freshConfig = require("../config");

describe('config', () => {
  it('exports process.env values', () => {
    process.env.CONNECT_INSTANCE_ID = 'inst';
    process.env.MAX_CONTACT_IDS = '5';
    process.env.INVOKE_SALESFORCE_REST_API_ARN = 'arn';
    process.env.BATCH_SIZE = '2';
    process.env.S3_BUCKET_TENANT_RESOURCES = 'callCenter-1234567890';
    process.env.USE_REDACTED_TRANSCRIPT = 'true';
    jest.resetModules();
    const freshConfig = require('../config');
    expect(freshConfig.connectInstanceId).toBe('inst');
    expect(freshConfig.maxContactIds).toBe('5');
    expect(freshConfig.invokeSfRestApiArn).toBe('arn');
    expect(freshConfig.batchSize).toBe('2');
    expect(freshConfig.s3BucketTenantResources).toBe('callCenter-1234567890');
    expect(freshConfig.useRedactedTranscript).toBe(true);
  });
});