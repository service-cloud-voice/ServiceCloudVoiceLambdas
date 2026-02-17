const AWS = require('aws-sdk');
const { secretCacheS3 } = require('./config');
const SCVLoggingUtil = require('./SCVLoggingUtil');

const s3 = new AWS.S3();

/**
 * Reads the secret cache for a given contactId from S3.
 * @param {string} contactId
 * @returns {Promise<Object|null>} Parsed secret cache object, or null if not found.
 */
async function retrieveFromCache(contactId) {
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
    const parsedData = JSON.parse(body);
    return parsedData;
  } catch (err) {
    if (err.code === 'NoSuchKey' || err.code === 'NotFound') {
      SCVLoggingUtil.warn({
        message: `Secret cache not found in S3 for contactId: ${contactId}`,
        context: { bucket, key },
      });
      return null;
    }
    SCVLoggingUtil.error({
      message: `Error reading secret cache from S3 for contactId: ${contactId}. Error: ${err}`,
      context: { bucket, key, error: err },
    });
    return null;
  }
}

/**
 * Stores the secret cache for a given contactId in S3.
 * @param {string} contactId
 * @param {Object} cacheData
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
async function storeInCache(contactId, cacheData) {
  if (!secretCacheS3) {
    SCVLoggingUtil.error({
      message: 'SECRET_CACHE_S3 environment variable is not set',
      context: { contactId },
    });
    return false;
  }

  // secretCacheS3 is in the form 'bucketName/directory' or just 'bucketName'
  const [bucket, ...dirParts] = secretCacheS3.split('/');
  const directory = dirParts.join('/');
  const key = directory ? `${directory}/${contactId}` : `${contactId}`;

  const params = {
    Bucket: bucket,
    Key: key,
    Body: JSON.stringify(cacheData),
    ContentType: 'application/json',
  };

  try {
    await s3.putObject(params).promise();
    SCVLoggingUtil.info({
      message: `Secret cache stored successfully for contactId: ${contactId}`,
      context: { bucket, key },
    });
    return true;
  } catch (err) {
    SCVLoggingUtil.error({
      message: `Error storing secret cache in S3 for contactId: ${contactId}. Error: ${err}`,
      context: { bucket, key, error: err },
    });
    return false;
  }
}

module.exports = {
  retrieveFromCache,
  storeInCache,
};