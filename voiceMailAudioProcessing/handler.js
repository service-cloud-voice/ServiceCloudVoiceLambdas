const { Decoder } = require("ebml");
const AWS = require("aws-sdk");

const s3 = new AWS.S3();
const Writer = require("wav").Writer;
const SCVLoggingUtil = require("./SCVLoggingUtil");

const kinesisVideo = new AWS.KinesisVideo({
  region: process.env.aws_region,
});
const kinesisVideoMedia = new AWS.KinesisVideoMedia({
  region: process.env.aws_region,
});
const BUCKET_NAME = process.env.s3_recordings_bucket;
const AUDIO_MIME_TYPE = "audio/x-wav";
const RECORDINGS_FOLDER = "voicemail_recordings";
const WRITER_CONFIG = {
  sampleRate: 8000,
  channels: 1,
  bitDepth: 16,
};

let wavBufferArray = [];
let wavOutputStream;
let decoder;
let fileDataLength = 0;
let attrTagContainer = "";

// This Lambda requires env variables aws_region, s3_recordings_bucket and a triger bridge for CTR streams
async function parseNextFragmentNew(streamArn, fragmentNumber) {
  const fragmentParamsData = {
    StartSelector: {
      StartSelectorType: "FRAGMENT_NUMBER",
      AfterFragmentNumber: fragmentNumber,
    },
    StreamName: streamArn.split("/")[1],
  };

  return new Promise((resolve) => {
    const listener = AWS.EventListeners.Core.HTTP_DATA;
    const request = kinesisVideoMedia.getMedia(fragmentParamsData);
    request.removeListener("httpData", listener);
    request.on("httpData", (chunk) => {
      decoder.write(chunk);
    });
    request.on("httpDone", () => {
      wavOutputStream.write(Buffer.concat(wavBufferArray));
      wavOutputStream.end();
      fileDataLength += parseInt(wavOutputStream.dataLength, 10);
      resolve({});
    });
    request.send();
  });
}

/* function that returns a promise to wait until the stream is done writing to the S3 bucket because tries to reduce the init time lambda runs the same function that was already in memory or container. */
let streamFinished = false;
const done = () =>
  new Promise((resolve) => {
    const checkFinished = () => {
      if (streamFinished) {
        resolve();
      } else {
        setTimeout(checkFinished, 500);
      }
    };
    setTimeout(checkFinished, 500);
  });

exports.handler = async (event) => {
  SCVLoggingUtil.debug({
    message: "VoiceMailAudioProcessing event received",
    context: { payload: event },
  });
  // Establish a response container
  const responseContainer = {};

  // Set counters for final status
  let totalRecordCount = 0;
  let processedRecordCount = 0;

  // Process incoming records
  for (const record of event.Records) {
    let shouldProcessKvs = true;
    let currentTagName = "";
    let currentFragment = BigInt(0);

    // Increment record counter
    totalRecordCount += 1;
    let currentContactID;
    let vmrecord;

    // Grab the data from the event for the record, decode it, grab the attributes we need, and check if this is a voicemail to process
    try {
      // Decode the payload
      const payload = Buffer.from(record.kinesis.data, "base64").toString();
      SCVLoggingUtil.debug({
        message: "Decoded payload",
        context: { payload: payload },
      });
      vmrecord = JSON.parse(payload);
      currentContactID = vmrecord.ContactId;
    } catch (e) {
      SCVLoggingUtil.error({
        message: "FAIL: Record extraction failed",
        context: { payload: e },
      });
      responseContainer[`record${totalRecordCount}result`] =
        "Failed to extract record and/or decode";
      return;
    }

    // Check for the positive vmFlag attribute so we know that this is a vm to process
    try {
      const vmFlag = vmrecord.Attributes.vm_flag || "99";
      if (vmFlag === "0") {
        responseContainer[
          `record ${totalRecordCount}result`
        ] = ` ContactID: ${currentContactID} - IGNORE - voicemail already processed`;
        processedRecordCount += 1;
        return;
      }
      if (
        // The record is a valid VM record if the flag is "1" and it has the lang and from values populated
        vmFlag === "1" &&
        vmrecord.Attributes.vm_lang &&
        vmrecord.Attributes.vm_from
      ) {
        SCVLoggingUtil.info({
          message: `Processing a Voicemail chunk for record #${totalRecordCount} with contactId ${currentContactID}`,
          context: { contactId: currentContactID },
        });
      } else {
        responseContainer[
          `record${totalRecordCount}result`
        ] = ` ContactID: ${currentContactID} - IGNORE - voicemail flag not valid`;
        processedRecordCount += 1;
        continue; // eslint-disable-line
      }
    } catch (err) {
      SCVLoggingUtil.error({
        message: "Some other bad thing happened with the attribute comparison",
        context: { payload: err },
      });
      responseContainer[
        `record${totalRecordCount}result`
      ] = ` ContactID: ${currentContactID} - IGNORE - Some other bad thing happened with the attribute comparison.`;
      processedRecordCount += 1;
      return;
    }

    // Grab kvs stream data
    let startFragmentNum;
    let streamARN;
    let stopFragmentNum;
    let streamName;
    try {
      streamARN = vmrecord.Recordings[0].Location;
      startFragmentNum = BigInt(vmrecord.Recordings[0].FragmentStartNumber);
      stopFragmentNum = BigInt(vmrecord.Recordings[0].FragmentStopNumber);
      streamName = vmrecord.Recordings[0].Location.substring(
        streamARN.indexOf("/") + 1,
        streamARN.lastIndexOf("/")
      );
    } catch (err) {
      SCVLoggingUtil.error({
        message: "FAIL: Counld not identify KVS info",
        context: { payload: err },
      });
      responseContainer[`record${totalRecordCount}result`] =
        "Failed to extract KVS info";
      return;
    }

    // Iterate through the attributes to get the tags
    try {
      attrTagContainer += `vm_lang=${encodeURIComponent(
        vmrecord.Attributes.vm_lang
      )}&vm_dialedNumber=${encodeURIComponent(
        vmrecord.SystemEndpoint.Address
      )}&vm_initTimestamp=${encodeURIComponent(
        vmrecord.InitiationTimestamp
      )}&vm_endTimestamp=${encodeURIComponent(vmrecord.DisconnectTimestamp)}&`;
      attrTagContainer = attrTagContainer.replace(/&\s*$/, "");
    } catch (err) {
      SCVLoggingUtil.error({
        message: "FAIL: Counld not extract vm tags",
        context: { payload: err },
      });
      responseContainer[`record${totalRecordCount}result`] =
        "Failed to extract vm tags";
      return;
    }

    // Process audio and write to S3
    try {
      // Establish decoder and start listening. AS we get data, push it  into the array to be processed by writer
      decoder = new Decoder();
      decoder.on("data", (chunk) => {
        /**
         * Check the shouldProcessKvs field.  If it's true, then proceed with looking at this chunk.  If it's
         * false, then don't look at this chunk at all.
         *
         * This will be set to false once the current fragment number greater than the stop fragment number
         * indicating that we've gone as far as we should go in this KVS.
         *
         */

        const { name, value } = chunk[1];

        if (shouldProcessKvs) {
          switch (name) {
            case "TagName":
              currentTagName = value;
              break;

            case "TagString":
              /**
               * This chunk contains a tag string containing the value of the tag name above.  If the
               * current tag name is AWS_KINESISVIDEO_FRAGMENT_NUMBER we know that this tag string is
               * the value of the AWS_KINESISVIDEO_FRAGMENT_NUMBER.
               *
               * Store the BigInt value of the chunk in the currentFragment field.  Fragment numbers are
               * very large and require a BigInt data type.
               *
               */
              if (currentTagName === "AWS_KINESISVIDEO_FRAGMENT_NUMBER") {
                currentFragment = BigInt(value);

                /**
                 * If the current fragment number is after the stop fragment number from the CTR, then
                 * set the shouldProcessKvs field to false to tell the system to not look at this
                 * stream in this Lambda execution any longer.
                 *
                 */
                if (currentFragment > stopFragmentNum) {
                  SCVLoggingUtil.info({
                    message: `KVS processing completed for chunk [currentFragment: ${currentFragment}, stopFragmentNum: ${stopFragmentNum}].`,
                    context: { contactId: currentContactID },
                  });
                  shouldProcessKvs = false;
                }
              }
              break;

            case "Block":
            case "SimpleBlock":
              /**
               * This chunk contains audio data so write it to the wav file buffer.
               */
              wavBufferArray.push(chunk[1].payload);
              break;

            default:
              break;
          }
        }
      });

      // Establish the writer which transforms PCM data from KVS to wav using the defined params
      wavOutputStream = new Writer({
        sampleRate: 8000,
        channels: 1,
        bitDepth: 16,
      });

      // Receive chunk data and push it to a simple Array
      let s3ObjectData = [];
      wavOutputStream.on("data", (d) => {
        s3ObjectData.push(d);
      });

      // Receive the end of the KVS chunk and process it
      wavOutputStream.on("finish", async () => {
        // calculating recording time in sec: FileLength / (Sample Rate * Channels * Bits per sample /8)
        const vmDuration = Math.ceil(
          fileDataLength /
            (WRITER_CONFIG.sampleRate *
              WRITER_CONFIG.channels *
              (WRITER_CONFIG.bitDepth / 8))
        );
        const key = `${RECORDINGS_FOLDER}/${currentContactID}.wav`;
        const vmLocation = encodeURIComponent(`${BUCKET_NAME}/${key}`);
        const s3Params = {
          Bucket: BUCKET_NAME,
          Key: key,
          Body: Buffer.concat(s3ObjectData),
          ContentType: AUDIO_MIME_TYPE,
          Tagging: `${attrTagContainer}&vm_duration=${vmDuration}&vm_recordingUrl=${vmLocation}&`,
        };
        await s3.putObject(s3Params).promise();

        // Whack the data so we have a clean start point
        s3ObjectData = [];
        wavBufferArray = [];
        attrTagContainer = "";
        fileDataLength = 0;

        // Increment processed records
        processedRecordCount += 1;
        SCVLoggingUtil.info({
          message: `Write complete for chunk (contact ID ${currentContactID})`,
          context: { contactId: currentContactID },
        });
        responseContainer[
          `record${totalRecordCount}result`
        ] = ` ContactID: ${currentContactID} -  Write complete`;
        streamFinished = true;
      });

      // Set params for the stream
      const streamParams = {
        APIName: "GET_MEDIA",
        StreamName: streamName,
      };

      // Extract data from stream for processing using the data extraction function
      const data = await kinesisVideo.getDataEndpoint(streamParams).promise();
      kinesisVideoMedia.endpoint = new AWS.Endpoint(data.DataEndpoint);

      await parseNextFragmentNew(streamARN, startFragmentNum.toString(), null);

      // waiting until the recorded stream
      await done();
    } catch (err) {
      SCVLoggingUtil.error({
        message: "FAIL: Counld write audio to S3",
        context: { payload: err },
      });
      responseContainer[
        `record${totalRecordCount}result`
      ] = ` ContactID: ${currentContactID} -  Failed to write audio to S3`;
      return;
    }
  }

  // log the response for ALL records
  SCVLoggingUtil.info({
    message: "voiceMailAudioProcessing response",
    context: {
      statusCode: 200,
      body: {
        status: `Complete. Processed ${processedRecordCount} of ${totalRecordCount} records.`,
        recordResults: responseContainer,
      },
    },
  });
};
