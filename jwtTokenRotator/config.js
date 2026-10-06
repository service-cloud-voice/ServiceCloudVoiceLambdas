module.exports = {
  logLevel: process.env.LOG_LEVEL,
  secretName: process.env.SECRET_NAME,
  jwtSecretName: process.env.JWT_SECRET_NAME,
  tokenValidFor: '60m',
  includeRolesClaim: process.env.INCLUDE_ROLES_CLAIM === 'true',
};
