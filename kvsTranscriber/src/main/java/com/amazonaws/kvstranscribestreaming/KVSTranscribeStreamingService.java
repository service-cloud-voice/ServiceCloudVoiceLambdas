package com.amazonaws.kvstranscribestreaming;

import com.amazonaws.auth.AWSCredentialsProvider;
import com.amazonaws.auth.DefaultAWSCredentialsProviderChain;
import com.amazonaws.kinesisvideo.parser.ebml.InputStreamParserByteSource;
import com.amazonaws.kinesisvideo.parser.mkv.StreamingMkvReader;
import com.amazonaws.kinesisvideo.parser.utilities.FragmentMetadataVisitor;
import com.amazonaws.regions.Regions;
import com.amazonaws.services.cloudwatch.AmazonCloudWatchClientBuilder;
import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.transcribestreaming.KVSByteToAudioEventSubscription;
import com.amazonaws.transcribestreaming.StreamTranscriptionBehaviorImpl;
import com.amazonaws.transcribestreaming.TranscribeStreamingRetryClient;
import com.salesforce.scv.SCVLoggingUtil;

import org.reactivestreams.Publisher;
import org.reactivestreams.Subscriber;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.services.transcribestreaming.model.AudioStream;
import software.amazon.awssdk.services.transcribestreaming.model.LanguageCode;
import software.amazon.awssdk.services.transcribestreaming.model.MediaEncoding;
import software.amazon.awssdk.services.transcribestreaming.model.StartStreamTranscriptionRequest;

import java.io.*;
import java.nio.file.Path;
import java.nio.file.Paths;

import java.text.DateFormat;
import java.text.SimpleDateFormat;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Date;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

public class KVSTranscribeStreamingService implements RequestHandler<TranscriptionRequest, String> {

    private static final Regions REGION = Regions.fromName(System.getenv("APP_REGION"));
    private static final Regions TRANSCRIBE_REGION = Regions.fromName(System.getenv("TRANSCRIBE_REGION"));
    private static final String TRANSCRIBE_ENDPOINT = "https://transcribestreaming." + TRANSCRIBE_REGION.getName() + ".amazonaws.com";
    private static final String START_SELECTOR_TYPE = System.getenv("START_SELECTOR_TYPE");
    public static final MetricsUtil metricsUtil = new MetricsUtil(AmazonCloudWatchClientBuilder.defaultClient());
    private static final DateFormat DATE_FORMAT = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ");
    private TranscribedSegmentWriter fromCustomerSegmentWriter = null;
    private TranscribedSegmentWriter toCustomerSegmentWriter = null;


    /**
     * Handler function for the Lambda
     *
     * @param request
     * @param context
     * @return
     */
    @Override
    public String handleRequest(TranscriptionRequest request, Context context) {
        Map<String, String> loggingContext = new HashMap<>();
        loggingContext.put(SCVLoggingUtil.VOICECALL_CONTEXT_KEY.VOICE_CALL_ID.toString(), request.getVoiceCallId());
        try {
        	SCVLoggingUtil.info("com.amazonaws.kvstranscribestreaming.KVSTranscribeStreamingService.handleRequest", SCVLoggingUtil.EVENT_TYPE.PERFORMANCE, "Start Handle Request", loggingContext);
            // validate the request
            request.validate();

            startKVSToTranscribeStreaming(request.getInstanceARN(), request.getStreamARN(), request.getStartFragmentNum(), request.getVoiceCallId(), request.getLanguageCode(),
                    request.getAudioStartTimestamp(), request.getCustomerPhoneNumber(), request.isStreamAudioFromCustomer(), request.isStreamAudioToCustomer());
            SCVLoggingUtil.info("com.amazonaws.kvstranscribestreaming.KVSTranscribeStreamingService.handleRequest", SCVLoggingUtil.EVENT_TYPE.PERFORMANCE, "End Handle Request", loggingContext);
            
            return "{ \"result\": \"Success\" }";

        } catch (Exception e) {
         	SCVLoggingUtil.error("com.amazonaws.kvstranscribestreaming.KVSTranscribeStreamingService.handleRequest", SCVLoggingUtil.EVENT_TYPE.TRANSCRIPTION, e.getMessage(), loggingContext);
            return "{ \"result\": \"Failed\" }";
        }
    }

    /**
     * Starts streaming between KVS and Transcribe
     * At end of the streaming session, the raw audio is saved as an s3 object
     *
     * @param streamARN
     * @param startFragmentNum
     * @param voiceCallId
     * @param languageCode
     * @throws Exception
     */
    private void startKVSToTranscribeStreaming(String instanceARN, String streamARN, String startFragmentNum, String voiceCallId, Optional<String> languageCode,
                                               long audioStartTimestamp, String customerPhoneNumber, boolean isStreamAudioFromCustomerEnabled, boolean isStreamAudioToCustomerEnabled) throws Exception {
    	SCVLoggingUtil.info("com.amazonaws.kvstranscribestreaming.KVSTranscribeStreamingService.startKVSToTranscribeStreaming", SCVLoggingUtil.EVENT_TYPE.PERFORMANCE, "START KVS Transcribe Streaming", null);
        fromCustomerSegmentWriter = new TranscribedSegmentWriter(instanceARN, voiceCallId, true, audioStartTimestamp, customerPhoneNumber);
        toCustomerSegmentWriter = new TranscribedSegmentWriter(instanceARN, voiceCallId, false, audioStartTimestamp, customerPhoneNumber);

    	String streamName = streamARN.substring(streamARN.indexOf("/") + 1, streamARN.lastIndexOf("/"));

        KVSStreamTrackObject kvsStreamTrackObjectFromCustomer = null;
        KVSStreamTrackObject kvsStreamTrackObjectToCustomer = null;

        if (isStreamAudioFromCustomerEnabled) {
            kvsStreamTrackObjectFromCustomer = getKVSStreamTrackObject(streamName, startFragmentNum, KVSUtils.TrackName.AUDIO_FROM_CUSTOMER.getName(), voiceCallId);
        }
        if (isStreamAudioToCustomerEnabled) {
            kvsStreamTrackObjectToCustomer = getKVSStreamTrackObject(streamName, startFragmentNum, KVSUtils.TrackName.AUDIO_TO_CUSTOMER.getName(), voiceCallId);
        }
        SCVLoggingUtil.info("com.amazonaws.kvstranscribestreaming.KVSTranscribeStreamingService.startKVSToTranscribeStreaming", SCVLoggingUtil.EVENT_TYPE.PERFORMANCE, "START Initialize Transcribe client ", null);
        
        try (TranscribeStreamingRetryClient client = new TranscribeStreamingRetryClient(getTranscribeCredentials(), TRANSCRIBE_ENDPOINT, TRANSCRIBE_REGION, metricsUtil)) {
            CompletableFuture<Void> fromCustomerResult = null;
            CompletableFuture<Void> toCustomerResult = null;
            SCVLoggingUtil.info("com.amazonaws.kvstranscribestreaming.KVSTranscribeStreamingService.startKVSToTranscribeStreaming", SCVLoggingUtil.EVENT_TYPE.PERFORMANCE, "END Initialize Transcribe client ", null);
            
            if (kvsStreamTrackObjectFromCustomer != null) {
            	SCVLoggingUtil.info("com.amazonaws.kvstranscribestreaming.KVSTranscribeStreamingService.getStartStreamingTranscriptionFuture", SCVLoggingUtil.EVENT_TYPE.PERFORMANCE, "START Get Transcribing Future for FROM_CUSTOMER stream", null);
                fromCustomerResult = getStartStreamingTranscriptionFuture(kvsStreamTrackObjectFromCustomer,
                        languageCode, voiceCallId, client, fromCustomerSegmentWriter, KVSUtils.TrackName.AUDIO_FROM_CUSTOMER.getName());
                SCVLoggingUtil.info("com.amazonaws.kvstranscribestreaming.KVSTranscribeStreamingService.getStartStreamingTranscriptionFuture", SCVLoggingUtil.EVENT_TYPE.PERFORMANCE, "START Get Transcribing Future for FROM_CUSTOMER stream", null);
            }

            if (kvsStreamTrackObjectToCustomer != null) {
            	SCVLoggingUtil.info("com.amazonaws.kvstranscribestreaming.KVSTranscribeStreamingService.getStartStreamingTranscriptionFuture", SCVLoggingUtil.EVENT_TYPE.PERFORMANCE, "START Get Transcribing Future for TO_CUSTOMER stream", null);
                toCustomerResult = getStartStreamingTranscriptionFuture(kvsStreamTrackObjectToCustomer,
                        languageCode, voiceCallId, client, toCustomerSegmentWriter, KVSUtils.TrackName.AUDIO_TO_CUSTOMER.getName());
                SCVLoggingUtil.info("com.amazonaws.kvstranscribestreaming.KVSTranscribeStreamingService.getStartStreamingTranscriptionFuture", SCVLoggingUtil.EVENT_TYPE.PERFORMANCE, "START Get Transcribing Future for TO_CUSTOMER stream", null);
            }

            // Synchronous wait for stream to close, and close client connection
            // Timeout of 890 seconds because the Lambda function can be run for at most 15 mins (~890 secs)
            if (null != fromCustomerResult) {
                fromCustomerResult.get(890, TimeUnit.SECONDS);
            }

            if (null != toCustomerResult) {
                toCustomerResult.get(890, TimeUnit.SECONDS);
            }
        } catch (TimeoutException e) {
         	SCVLoggingUtil.error("com.amazonaws.kvstranscribestreaming.KVSTranscribeStreamingService.startKVSToTranscribeStreaming", SCVLoggingUtil.EVENT_TYPE.TRANSCRIPTION, e.getMessage(), null);
        } catch (Exception e) {
         	SCVLoggingUtil.error("com.amazonaws.kvstranscribestreaming.KVSTranscribeStreamingService.startKVSToTranscribeStreaming", SCVLoggingUtil.EVENT_TYPE.TRANSCRIPTION, e.getMessage(), null);
            throw e;	
        }
        SCVLoggingUtil.info("com.amazonaws.kvstranscribestreaming.KVSTranscribeStreamingService.startKVSToTranscribeStreaming", SCVLoggingUtil.EVENT_TYPE.PERFORMANCE, "END KVS Transcribe Streaming", null);
    }

    /**
     * Create all objects necessary for KVS streaming from each track
     *
     * @param streamName
     * @param startFragmentNum
     * @param trackName
     * @param contactId
     * @return object necessary for KVS streaming from each track
     * @throws FileNotFoundException
     */
    private KVSStreamTrackObject getKVSStreamTrackObject(String streamName, String startFragmentNum, String trackName,
                                                         String contactId) throws FileNotFoundException {
    	SCVLoggingUtil.info("com.amazonaws.kvstranscribestreaming.KVSTranscribeStreamingService.getKVSStreamTrackObject", SCVLoggingUtil.EVENT_TYPE.PERFORMANCE, "START Get KVS Stream Tracking Object for Track " + trackName, null);
        
        InputStream kvsInputStream = KVSUtils.getInputStreamFromKVS(streamName, REGION, startFragmentNum, getAWSCredentials(), START_SELECTOR_TYPE);
        StreamingMkvReader streamingMkvReader = StreamingMkvReader.createDefault(new InputStreamParserByteSource(kvsInputStream));

        FragmentMetadataVisitor.BasicMkvTagProcessor tagProcessor = new FragmentMetadataVisitor.BasicMkvTagProcessor();
        FragmentMetadataVisitor fragmentVisitor = FragmentMetadataVisitor.create(Optional.of(tagProcessor));
        SCVLoggingUtil.info("com.amazonaws.kvstranscribestreaming.KVSTranscribeStreamingService.getKVSStreamTrackObject", SCVLoggingUtil.EVENT_TYPE.PERFORMANCE, "END Get KVS Stream Tracking Object for Track " + trackName, null);
        
        return new KVSStreamTrackObject(kvsInputStream, streamingMkvReader, tagProcessor, fragmentVisitor, trackName);
    }


    private CompletableFuture<Void> getStartStreamingTranscriptionFuture(KVSStreamTrackObject kvsStreamTrackObject, Optional<String> languageCode,
                                                                         String contactId, TranscribeStreamingRetryClient client,
                                                                         TranscribedSegmentWriter transcribedSegmentWriter,
                                                                         String channel) {
    	return client.startStreamTranscription(
                // since we're definitely working with telephony audio, we know that's 8 kHz
                getRequest(8000, languageCode),
                new KVSAudioStreamPublisher(
                        kvsStreamTrackObject.getStreamingMkvReader(),
                        contactId,
                        kvsStreamTrackObject.getTagProcessor(),
                        kvsStreamTrackObject.getFragmentVisitor(),
                        kvsStreamTrackObject.getTrackName()),
                new StreamTranscriptionBehaviorImpl(transcribedSegmentWriter),
                channel
        );
    }

    

    /**
     * @return AWS credentials to be used to connect to s3 (for fetching and uploading audio) and KVS
     */
    private static AWSCredentialsProvider getAWSCredentials() {
        return DefaultAWSCredentialsProviderChain.getInstance();
    }

    /**
     * @return AWS credentials to be used to connect to Transcribe service. This example uses the default credentials
     * provider, which looks for environment variables (AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY) or a credentials
     * file on the system running this program.
     */
    private static AwsCredentialsProvider getTranscribeCredentials() {
        return DefaultCredentialsProvider.create();
    }

    /**
     * Build StartStreamTranscriptionRequestObject containing required parameters to open a streaming transcription
     * request, such as audio sample rate and language spoken in audio
     *
     * @param mediaSampleRateHertz sample rate of the audio to be streamed to the service in Hertz
     * @param languageCode the language code to be used for Transcription (optional; see https://docs.aws.amazon.com/transcribe/latest/dg/API_streaming_StartStreamTranscription.html#API_streaming_StartStreamTranscription_RequestParameters )
     * @return StartStreamTranscriptionRequest to be used to open a stream to transcription service
     */
    private static StartStreamTranscriptionRequest getRequest(Integer mediaSampleRateHertz, Optional <String> languageCode) {
        return StartStreamTranscriptionRequest.builder()
                .languageCode(languageCode.isPresent() ? languageCode.get() : LanguageCode.EN_US.toString())
                .mediaEncoding(MediaEncoding.PCM)
                .mediaSampleRateHertz(mediaSampleRateHertz)
                .build();
    }

    /**
     * KVSAudioStreamPublisher implements audio stream publisher.
     * It emits audio events from a KVS stream asynchronously in a separate thread
     */
    private static class KVSAudioStreamPublisher implements Publisher<AudioStream> {
        private final StreamingMkvReader streamingMkvReader;
        private String contactId;
        private OutputStream outputStream;
        private FragmentMetadataVisitor.BasicMkvTagProcessor tagProcessor;
        private FragmentMetadataVisitor fragmentVisitor;
        private String track;

        private KVSAudioStreamPublisher(StreamingMkvReader streamingMkvReader, String contactId,
                                        FragmentMetadataVisitor.BasicMkvTagProcessor tagProcessor, FragmentMetadataVisitor fragmentVisitor,
                                        String track) {
            this.streamingMkvReader = streamingMkvReader;
            this.contactId = contactId;
            this.tagProcessor = tagProcessor;
            this.fragmentVisitor = fragmentVisitor;
            this.track = track;
        }

        @Override
        public void subscribe(Subscriber<? super AudioStream> s) {
            s.onSubscribe(new KVSByteToAudioEventSubscription(s, streamingMkvReader, contactId, tagProcessor, fragmentVisitor, track));
        }
    }
}
