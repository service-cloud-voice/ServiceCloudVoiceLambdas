# Overview
This repo contains the AWS artifacts required for integrating with the Salesforce Service Cloud Voice (SCV) product.

## Build, Deploy, and Publish AWS Lambda Functions
**Prerequisite** - Install gradle:
```
brew install gradle
```
**Step 1** - Build the serverless application:
```
cd ..
sam build
```
**Step 2** - Package the serverless application:
```
sam package --template-file ServiceCloudVoiceLambdas.yaml --output-template-file packaged.yaml --s3-bucket bucketname
```

**Step 3.1** - Deploy the serverless application:
```
sam deploy --template-file packaged.yaml --region <region> --capabilities CAPABILITY_IAM --stack-name stack-name --parameter-overrides SalesforceOrgId=[Salesforce Org Id]
```
