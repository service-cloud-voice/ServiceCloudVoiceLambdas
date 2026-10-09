const SCVLoggingUtil = require("./SCVLoggingUtil");
const { readSecret, writeSecret } = require("./secretUtils");
const { generateJWT } = require("./utils");
const config = require("./config");

// Keys used to look up signing inputs inside the existing per-contact-center
// secret (${CallCenterApiName}-salesforce-secret). Mirrors the field names
// invokeTelephonyIntegrationApi/secretUtils.js already relies on, so this
// lambda can reuse the exact same secret without any new provisioning.
const SALESFORCE_ORG_ID_KEY = "SALESFORCE_ORG_ID";
const CALL_CENTER_API_NAME_KEY = "CALL_CENTER_API_NAME";

exports.handler = async (event) => {
  SCVLoggingUtil.debug({
    message: "JwtTokenRotator invocation started",
    context: { payload: event },
  });

  // Shared/multiorg deployments invoke a single pooled Lambda for many call
  // centers, so the target secrets are passed per-invocation via the
  // EventBridge rule's Input payload. Single-tenant deployments keep using
  // the SECRET_NAME/JWT_SECRET_NAME env vars fixed at deploy time.
  const secretName = (event && event.secretName) || config.secretName;
  const jwtSecretName = (event && event.jwtSecretName) || config.jwtSecretName;

  if (!secretName) {
    throw new Error("SECRET_NAME configuration is not set");
  }
  if (!jwtSecretName) {
    throw new Error("JWT_SECRET_NAME configuration is not set");
  }

  const secretData = await readSecret(secretName);

  const orgId = secretData[SALESFORCE_ORG_ID_KEY];
  const callCenterApiName = secretData[CALL_CENTER_API_NAME_KEY];
  const privateKey = callCenterApiName
    ? secretData[`${callCenterApiName}-scrt-jwt-auth-private-key`]
    : undefined;

  if (!orgId || !callCenterApiName || !privateKey) {
    const errMsg = `Missing required secret fields for JWT generation in secret ${secretName}`;
    SCVLoggingUtil.error({
      message: errMsg,
      context: {
        secretName,
        hasOrgId: !!orgId,
        hasCallCenterApiName: !!callCenterApiName,
        hasPrivateKey: !!privateKey,
      },
    });
    throw new Error(errMsg);
  }

  const token = await generateJWT({
    orgId,
    callCenterApiName,
    expiresIn: config.tokenValidFor,
    privateKey,
    includeRolesClaim: config.includeRolesClaim,
  });

  // The rotated token is written as plain text to its own dedicated secret;
  // config (org id, call center name, private key) stays in secretName.
  await writeSecret(jwtSecretName, token);

  SCVLoggingUtil.info({
    message: `JWT token rotated successfully for ${callCenterApiName}`,
    context: { secretName, jwtSecretName, callCenterApiName },
  });

  return {
    statusCode: 200,
    message: "JWT token rotated successfully",
  };
};
