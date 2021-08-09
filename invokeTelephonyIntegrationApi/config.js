module.exports = {
  // The audience specified in the claim of the generated JWT token.
  audience: "https://scrt.salesforce.com",
  orgId: process.env.SALESFORCE_ORG_ID,
  scrtEndpointBase: process.env.SCRT_ENDPOINT_BASE,
  privateKeyParamName: process.env.PRIVATE_KEY_PARAM_NAME,
  callCenterApiName: process.env.CALL_CENTER_API_NAME,
  // JWT token valid duration.
  tokenValidFor: "5m"
};
