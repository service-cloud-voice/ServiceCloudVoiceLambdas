const aws = require("aws-sdk");
const SCVLoggingUtil = require("./SCVLoggingUtil");
const lambda = new aws.Lambda();
const connect = new aws.Connect();
const s3 = new aws.S3();
const participantMap = {
  CUSTOMER: "END_USER",
  AGENT: "VIRTUAL_AGENT",
};

/**
 * Gets the transcripts from the contactlens object and returns the transcripts in a format that can be used for the SCV
 * @param clObject - ContactLens object from the contactlens s3 file
 * @param  contactIdRelatedRecordMap - Map of contactIds to related record Ids
 @returns - Conversation transcript entries
 */
async function getTranscript(clObject, contactIdRelatedRecordMap) {
  const describeContactParams = {
    ContactId: clObject.CustomerMetadata.ContactId,
    InstanceId: clObject.CustomerMetadata.InstanceId,
  };
  const describeContactResponse = await describeContact(describeContactParams);
  // Contact Lens offsets are relative to the start of the recording, which begins when the agent connects
  const connectedToAgentTimestamp =
    describeContactResponse.Contact.AgentInfo.ConnectedToAgentTimestamp;
  SCVLoggingUtil.debug({
    message: "Contact connected to agent timestamp",
    context: {
      payload: { connectedToAgentTimestamp: connectedToAgentTimestamp },
    },
  });
  const connectedToAgentMillis = new Date(connectedToAgentTimestamp).getTime();
  const conversationEntries = [];
  const transcripts = clObject.Transcript;
  for (let i = 0; i < transcripts.length; i++) {
    const transcript = transcripts[i];
    const id = transcript.Id;
    const clientSentTimestamp =
      connectedToAgentMillis + Number(transcript.BeginOffsetMillis);
    const subject =
      clObject.CustomerMetadata.ContactId +
      participantMap[transcript.ParticipantId];
    const role =
      transcript.ParticipantId === "CUSTOMER"
        ? participantMap[transcript.ParticipantId]
        : transcript.ParticipantId;

    const entryTranscriptTemplate = {
      type: "conversationEntry",
      payload: {
        conversationId: clObject.CustomerMetadata.ContactId,
        id,
        clientSentTimestamp,
        clientDuration: 1,
        messageText: transcript.Content,
        sender: {
          appType: "TELEPHONY_INTEGRATION",
          subject,
          role,
        },
        relatedRecords:
          contactIdRelatedRecordMap[clObject.CustomerMetadata.ContactId],
      },
    };
    conversationEntries.push(entryTranscriptTemplate);
  }
  return conversationEntries;
}

/*
  Gets Contact Lens files from S3
  @param bucketName - S3 Bucket name containing contact lens files
  @param contactIds - List of contact ids to get contact lens files from S3
  @param instanceId - Connect instanceId
  @returns List of Contact Lens files
 */
async function getContactLensS3Path(bucketName, eventPayload, instanceId) {
  let filePaths = [];
  const contactIds = eventPayload.map((x) => x.contactId);
  const contactLensFilePathPrefixDate = [];
  for (let i = 0; i < contactIds.length; i++) {
    const contactId = contactIds[i];
    const matched = contactLensFilePathPrefixDate.filter((s) =>
      s.includes(contactId)
    );
    if (matched.length > 0) {
      filePaths = filePaths.concat(matched);
      SCVLoggingUtil.info({
        message: "Found contact id in the exisiting S3 prefix.",
        context: { contactId: contactId },
      });
    } else {
      const describeContactParams = {
        ContactId: contactId,
        InstanceId: instanceId,
      };
      const describeContactResponse = await describeContact(
        describeContactParams
      );
      if (!describeContactResponse?.Contact?.AgentInfo?.ConnectedToAgentTimestamp) {
        SCVLoggingUtil.warn({
          message: `Skipping back-filling transcripts for contactId:${contactId} as AgentInfo.ConnectedToAgentTimestamp is not available in describeContactResponse for instanceId:${instanceId}.`,
          context: { describeContactResponse },
        });
        continue; // eslint-disable-line
      }
      // Contact Lens files are stored under the UTC date the agent connected, not the date the contact started
      const connectedToAgentTimestamp =
        describeContactResponse.Contact.AgentInfo.ConnectedToAgentTimestamp;
      const date = new Date(connectedToAgentTimestamp);
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      const day = String(date.getUTCDate()).padStart(2, "0");
      const prefixDate = year + "/" + month + "/" + day;

      const s3Params = {
        Bucket: bucketName,
        Prefix: "Analysis/Voice/" + prefixDate + "/",
      };
      const s3Data = await s3.listObjectsV2(s3Params).promise();

      const filteredFiles = s3Data.Contents.filter((s3file) => {
        return s3file.Key.includes(contactId);
      });
      if (filteredFiles.length === 0) {
        SCVLoggingUtil.warn({
          message: `Did not find contact lens json file in the S3 bucket:${s3Params.Bucket} with prefix ${s3Params.Prefix} for contactId:${contactId}.`,
          context: { contactId },
        });
      }
      const contactLensFilePaths = filteredFiles.map((file) => file.Key);
      // add key to contactLensS3Keys
      s3Data.Contents.forEach((s3file) => {
        contactLensFilePathPrefixDate.push(s3file.Key);
      });
      filePaths = filePaths.concat(contactLensFilePaths);
    }
  }
  return filePaths;
}

async function describeContact(describeContactParams) {
  try {
    const describeContactResponse = await connect
      .describeContact(describeContactParams)
      .promise();
    SCVLoggingUtil.debug({
      message:
        "Successfully fetched the result from the describeContact API call.",
      context: describeContactResponse,
    });
    return describeContactResponse;
  } catch (err) {
    const message = `Error fetching information for ContactId:${describeContactParams.ContactId} and InstanceId:${describeContactParams.InstanceId}. Check if ContactId is valid or retry request by removing it.`;
    SCVLoggingUtil.error({
      category: [],
      message,
      context: err,
    });
    throw new Error(message);
  }
}

async function getS3Object(params) {
  return s3.getObject(params).promise();
}

async function invokeLambdaFunction(params) {
  return lambda.invoke(params).promise();
}

module.exports = {
  getContactLensS3Path,
  getTranscript,
  getS3Object,
  invokeLambdaFunction,
};