module.exports = {
  audience: "https://scrt.salesforce.com", // The audience specified in the claim of the generated JWT token.
  orgId: process.env.SALESFORCE_ORG_ID,
  scrtEndpointBase: process.env.SCRT_ENDPOINT_BASE,
  privateKeyParamName: process.env.PRIVATE_KEY_PARAM_NAME,
  callCenterApiName: process.env.CALL_CENTER_API_NAME,
  tokenValidFor: "5m", // JWT token valid duration.
};
