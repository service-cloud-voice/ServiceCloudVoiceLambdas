module.exports = {
  audience: "https://scrt.salesforce.com", // The audience specified in the claim of the generated JWT token.
  tokenValidFor: "15m", // JWT token valid duration.
  logLevel: process.env.LOG_LEVEL,
  secretCacheS3: process.env.SECRET_CACHE_S3,
};