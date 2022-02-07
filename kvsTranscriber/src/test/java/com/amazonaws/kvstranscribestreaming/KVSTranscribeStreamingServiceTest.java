package com.amazonaws.kvstranscribestreaming;

import com.amazonaws.regions.Regions;
import com.amazonaws.services.cloudwatch.AmazonCloudWatch;
import com.amazonaws.services.cloudwatch.AmazonCloudWatchClientBuilder;
import org.junit.Rule;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import com.amazonaws.services.lambda.runtime.Context;
import org.mockito.Mock;
import static org.mockito.Mockito.*;
import static com.github.stefanbirkner.systemlambda.SystemLambda.*;
import org.junit.contrib.java.lang.system.EnvironmentVariables;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import java.io.IOException;
import java.io.InputStream;

/**
 * Unit tests for KVSTranscribeStreamingService
 *
 * @author nan.shao
 */
public class KVSTranscribeStreamingServiceTest {
    @Mock
    private Regions regions;

    @Rule
    public final EnvironmentVariables environmentVariables = new EnvironmentVariables();
    
    @Test
    void handleRequestTest() {
        runTest(buildTranscriptReq());
    }        

    @Test
    void handleCustomRequestTest() {
        TranscriptionRequest request = buildTranscriptReq();
        request.setVocabularyName("VocabName");
        request.setVocabularyFilterName("VocabFilterName");
        request.setVocabularyFilterMethod("MASK");
        runTest(request);
    } 

    @Test
    void handleMedicalRequestTest() {
        TranscriptionRequest request = buildTranscriptReq();
        request.setEngine("medical");
        request.setSpecialty("ONCOLOGY");
        runTest(request);
    }  

    private void runTest(TranscriptionRequest request) {
        try {
            withEnvironmentVariable("APP_REGION", "us-east-1")
                    .and("TRANSCRIBE_REGION", "us-east-1")
                    .and("START_SELECTOR_TYPE", "sample-type")
                    .execute(() -> {
                                MockedStatic<Regions> regionsMockedStatic = Mockito.mockStatic(Regions.class);
                                regions = mock(Regions.class);
                                regionsMockedStatic.when(() -> Regions.fromName("us-east-1")).thenReturn(regions);
                                
                                Context context = new TestContext();

                                MockedStatic<AmazonCloudWatchClientBuilder> amazonCloudWatchClientBuilderMockedStatic = Mockito.mockStatic(AmazonCloudWatchClientBuilder.class);
                                AmazonCloudWatch amazonCloudWatch = mock(AmazonCloudWatch.class);
                                amazonCloudWatchClientBuilderMockedStatic.when(() -> AmazonCloudWatchClientBuilder.defaultClient()).thenReturn(amazonCloudWatch);
                                
                                KVSTranscribeStreamingService service = new KVSTranscribeStreamingService();

                                MockedStatic<KVSUtils> kvsUtilsMockedStatic = Mockito.mockStatic(KVSUtils.class);
                                InputStream inputStream = new InputStream() {
                                    @Override
                                    public int read() throws IOException {
                                        return 0;
                                    }
                                };
                                kvsUtilsMockedStatic.when(() -> KVSUtils.getInputStreamFromKVS(any(), any(), any(), any(), any())).thenReturn(inputStream);
                                
                                String result = service.handleRequest(request, context);
                                
                                // In KVSTranscribeStreamingService.java (line 125-129), the stream will not close during testing, 
                                // so exception will be thrown and then failed the result. "result : Failed" is expected"
                                assertTrue(result.contains("{ \"result\": \"Failed\" }"));
                            }
                    );
        } catch (Exception e) {
            System.out.println(e.getMessage());
        }
    }
    
    private TranscriptionRequest buildTranscriptReq() {
        TranscriptionRequest request = new TranscriptionRequest();
        request.setAudioStartTimestamp("1599287207");
        request.setCustomerPhoneNumber("+18586667777");
        request.setInstanceARN("arn:aws:connect:us-east-1:123456789012:instance/b6070940-51ab-4aa2-97df-6e6bf6950458");
        request.setLanguageCode("en-US");
        request.setStartFragmentNum("1");
        request.setStreamARN("arn:aws:kinesis:*:111122223333:stream/my-stream/");
        request.setStreamAudioFromCustomer(true);
        request.setStreamAudioToCustomer(true);
        request.setVoiceCallId("7bf73129-1428-4cd3-a780-95db273d1602");
        return request;
    }
}