const selfsigned = require("selfsigned");
const awsParamStore = require("aws-param-store");

function putSSMParameter(name, value) {
  awsParamStore.putParameterSync(name, value, "SecureString");
}

function generatePrivatePublicKeyPair(requestDetails) {
  const attrs = [
    { name: "countryName", value: "US" },
    { name: "stateOrProvinceName", value: "CA" },
    { name: "localityName", value: "San Francisco" },
    { name: "organizationName", value: "salesforce.com" },
    { name: "commonName", value: "www.salesforce.com" },
    {
      name: "organizationalUnitName",
      value: requestDetails.OrganizationalUnitName,
    },
  ];
  const expiresIn = requestDetails.ExpiresIn;

  var pems = selfsigned.generate(attrs, {
    keySize: 2048, // the size for the private key in bits (default: 1024)
    days: expiresIn, // how long till expiry of the signed certificate (default: 365)
    algorithm: "RS256",
    extensions: [{ name: "basicConstraints", cA: true }], // certificate extensions array
  });
  return pems;
}

exports.handler = async (event) => {
  const parameters = event.ResourceProperties.Parameters;

  const requestType = parameters.RequestType;
  const requestDetails = parameters.Details;
  const ssmParamName = requestDetails.SSMParamName;

  let ret = {};
  switch (requestType) {
    case "GeneratePrivatePublicKeyPair": {
      const pems = generatePrivatePublicKeyPair(requestDetails);
      putSSMParameter(ssmParamName, pems.private);

      ret = {
        Success: true,
        Certificate: pems.cert,
      };
      break;
    }
    case "CreateSSMParameter": {
      const ssmParamValue = requestDetails.SSMParamValue;
      putSSMParameter(ssmParamName, ssmParamValue);

      ret = {
        Success: true,
        Message: `The SSM parameter ${ssmParamName} is put successfully.`,
      };
      break;
    }
    default: {
      ret = {
        Success: false,
        Message: `Unsupported requestType along with parameter ${ssmParamName}`,
      };

      break;
    }
  }

  return ret;
};
