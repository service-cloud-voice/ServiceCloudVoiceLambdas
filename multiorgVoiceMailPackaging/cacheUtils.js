const AWS = require('aws-sdk');
const { secretCacheS3 } = require('./config');
const SCVLoggingUtil = require('./SCVLoggingUtil');

const s3 = new AWS.S3();

/**
 * Reads the secret cache for a given contactId from S3.
 * @param {string} contactId - The contact ID to retrieve cache for
 * @returns {Promise<Object|null>} Parsed secret cache object, or null if not found.
 */
async function retrieveFromCache(contactId) {
  // Input validation
  if (!contactId || typeof contactId !== 'string') {
    SCVLoggingUtil.error({
      message: 'Invalid contactId provided to retrieveFromCache',
      context: { contactId },
    });
    return null;
  }

  if (!secretCacheS3) {
    SCVLoggingUtil.error({
      message: 'SECRET_CACHE_S3 environment variable is not set',
      context: { contactId },
    });
    return null;
  }

  // secretCacheS3 is in the form 'bucketName/directory' or just 'bucketName'
  const [bucket, ...dirParts] = secretCacheS3.split('/');
  const directory = dirParts.join('/');
  const key = directory ? `${directory}/${contactId}` : `${contactId}`;

  const params = {
    Bucket: bucket,
    Key: key,
  };

  try {
    const data = await s3.getObject(params).promise();
    const body = data.Body.toString('utf-8');
    return JSON.parse(body);
  } catch (err) {
    if (err.code === 'NoSuchKey' || err.code === 'NotFound') {
      SCVLoggingUtil.warn({
        message: `Secret cache not found in S3 for contactId: ${contactId}`,
        context: { bucket, key },
      });
      return null;
    }
    SCVLoggingUtil.error({
      message: `Error reading secret cache from S3 for contactId: ${contactId}`,
      context: { bucket, key, error: err.message, errorCode: err.code },
    });
    return null;
  }
}

module.exports = {
  retrieveFromCache,
};