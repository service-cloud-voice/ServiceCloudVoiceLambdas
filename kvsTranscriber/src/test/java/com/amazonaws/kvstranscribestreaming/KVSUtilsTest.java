package com.amazonaws.kvstranscribestreaming;

import com.amazonaws.ResponseMetadata;
import com.amazonaws.auth.AWSCredentialsProvider;
import com.amazonaws.auth.DefaultAWSCredentialsProviderChain;
import com.amazonaws.http.SdkHttpMetadata;
import com.amazonaws.regions.Regions;
import com.amazonaws.services.kinesisvideo.*;
import com.amazonaws.services.kinesisvideo.model.*;
import org.junit.jupiter.api.Test;
import static org.junit.Assert.assertTrue;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import java.io.IOException;
import java.io.InputStream;
import static org.mockito.Mockito.*;

/**
 *
 * Unit tests for KVSUtils
 *
 * @author nan.shao
 */
public class KVSUtilsTest {
    @Mock
    GetDataEndpointResult getDataEndpointResult;

    @Mock
    AmazonKinesisVideoMedia amazonKinesisVideoMedia;

    @Test
    void getInputStreamFromKVSTest() {
        String streamName = "test-stream";
        Regions regions = Regions.valueOf("US_EAST_1");
        String startFragmentNum = "1";
        AWSCredentialsProvider awsCredentialsProvider = DefaultAWSCredentialsProviderChain.getInstance();
        String startSelectorType = "FRAGMENT_NUMBER";

        MockedStatic<AmazonKinesisVideoClientBuilder> amazonKinesisVideoClientBuilderMockedStatic = Mockito.mockStatic(AmazonKinesisVideoClientBuilder.class, RETURNS_DEEP_STUBS);
        AmazonKinesisVideo amazonKinesisVideo = mock(AmazonKinesisVideo.class);
        amazonKinesisVideoClientBuilderMockedStatic.when(() -> AmazonKinesisVideoClientBuilder.standard().build()).thenReturn(amazonKinesisVideo);

        getDataEndpointResult = mock(GetDataEndpointResult.class);
        doReturn(getDataEndpointResult).when(amazonKinesisVideo).getDataEndpoint(any());
        doReturn("sample-endpoint").when(getDataEndpointResult).getDataEndpoint();
        when(amazonKinesisVideo.getDataEndpoint(any()).getDataEndpoint()).thenReturn("sample-endpoint");

        amazonKinesisVideoMedia = mock(AmazonKinesisVideoMedia.class);
        MockedStatic<AmazonKinesisVideoMediaClientBuilder> amazonKinesisVideoMediaClientBuilderMockedStatic = Mockito.mockStatic(AmazonKinesisVideoMediaClientBuilder.class, RETURNS_DEEP_STUBS);
        AmazonKinesisVideoMediaClientBuilder amazonKinesisVideoMediaClientBuilder = mock(AmazonKinesisVideoMediaClientBuilder.class);
        amazonKinesisVideoMediaClientBuilderMockedStatic.when(() -> AmazonKinesisVideoMediaClientBuilder.standard().withEndpointConfiguration(any()).withCredentials(any())).thenReturn(amazonKinesisVideoMediaClientBuilder);
        when(amazonKinesisVideoMediaClientBuilder.build()).thenReturn(amazonKinesisVideoMedia);

        SdkHttpMetadata sdkHttpMetadata = mock(SdkHttpMetadata.class);
        ResponseMetadata responseMetadata = mock(ResponseMetadata.class);
        GetMediaResult getMediaResult = new GetMediaResult();
        getMediaResult.setPayload(new InputStream() {
            @Override
            public int read() throws IOException {
                return 0;
            }
        });
        getMediaResult.setSdkHttpMetadata(sdkHttpMetadata);
        getMediaResult.setSdkResponseMetadata(responseMetadata);
        when(sdkHttpMetadata.getHttpStatusCode()).thenReturn(200);
        when(responseMetadata.getRequestId()).thenReturn("sample-id");
        doReturn(getMediaResult).when(amazonKinesisVideoMedia).getMedia(new GetMediaRequest()
                .withStreamName(streamName)
                .withStartSelector(new StartSelector()
                        .withStartSelectorType(StartSelectorType.FRAGMENT_NUMBER)
                        .withAfterFragmentNumber(startFragmentNum)));

        InputStream kvsInputStream = KVSUtils.getInputStreamFromKVS(streamName, regions, startFragmentNum, awsCredentialsProvider, startSelectorType);

        assertTrue(kvsInputStream.toString().contains("com.amazonaws.kvstranscribestreaming.KVSUtilsTest"));
    }
}