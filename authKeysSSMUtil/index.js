const selfsigned = require("selfsigned");
const awsParamStore = require("aws-param-store");
const response = require("cfn-response");

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
      value: requestDetails.OrganizationalUnitName
    }
  ];
  const expiresIn = requestDetails.ExpiresIn;

  const pems = selfsigned.generate(attrs, { days: expiresIn });
  return pems;
}

exports.handler = async (event, context) => {
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
        Certificate: pems.cert
      };
      break;
    }
    case "CreateSSMParameter": {
      const ssmParamValue = requestDetails.SSMParamValue;
      putSSMParameter(ssmParamName, ssmParamValue);

      ret = {
        Success: true,
        Message: `The SSM parameter ${ssmParamName} is put successfully.`
      };
      break;
    }
    default: {
      ret = {
        Success: false,
        Message: `Unsupported requestType along with parameter ${ssmParamName}`
      };

      break;
    }
  }

  if (context.url) response.send(event, context, response.SUCCESS, {});

  return ret;
};
