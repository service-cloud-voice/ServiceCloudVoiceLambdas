package com.amazonaws.kvstranscribestreaming;

import com.amazonaws.services.simplesystemsmanagement.AWSSimpleSystemsManagement;
import com.amazonaws.services.simplesystemsmanagement.AWSSimpleSystemsManagementClientBuilder;
import com.amazonaws.services.simplesystemsmanagement.model.GetParameterResult;
import io.jsonwebtoken.Jwts;
import org.junit.Rule;
import org.junit.contrib.java.lang.system.EnvironmentVariables;
import org.junit.jupiter.api.Test;
import static com.github.stefanbirkner.systemlambda.SystemLambda.withEnvironmentVariable;
import static org.junit.Assert.assertEquals;
import static org.mockito.Mockito.*;
import org.mockito.MockedStatic;
import org.mockito.Mockito;


/**
 *
 * Unit tests for TranscribedSegmentWriter
 *
 * @author nan.shao
 */
public class TranscribedSegmentWriterTest {
    @Rule
    public final EnvironmentVariables environmentVariables = new EnvironmentVariables();
    
    @Test
    void sendMessageTest() {
        try{
            withEnvironmentVariable("SALESFORCE_ORG_ID", "00DRM000000HT6d")
                    .and("PRIVATE_KEY_PARAM_NAME", "HVCC228-scrt-jwt-auth-private-key")
                    .and("CALL_CENTER_API_NAME", "HVCC228")
                    .and("SCRT_ENDPOINT_BASE", "https://228com3.my.stmfa.stm.salesforce-scrt.com/telephony/v1")
                    .execute(
                            () -> {
                                assertEquals("00DRM000000HT6d", System.getenv("SALESFORCE_ORG_ID"));
                                String instanceARN = "arn:aws:connect:us-east-1:123456789012:instance/b6070940-51ab-4aa2-97df-6e6bf6950458";
                                String voiceCallId = "a4a471f8-dcd5-444d-bdbc-1a81e188adf7";
                                long audioStartTimestamp = 1599287207;
                                String customerPhoneNumber = "+18586667777";
                                TranscribedSegmentWriter tsw = new TranscribedSegmentWriter(instanceARN, voiceCallId, true, audioStartTimestamp, customerPhoneNumber);
                                String message = "test message";
                                String messageId = "e1dc4239-94d4-4143-86ea-418f4eeb63b8";
                                long startTime = audioStartTimestamp;
                                long endTime = audioStartTimestamp + 1000;
                                
                                MockedStatic<AWSSimpleSystemsManagementClientBuilder> awsSimpleSystemsManagementClientBuilderMockedStatic = Mockito.mockStatic(AWSSimpleSystemsManagementClientBuilder.class);
                                AWSSimpleSystemsManagement client = mock(AWSSimpleSystemsManagement.class);
                                awsSimpleSystemsManagementClientBuilderMockedStatic.when(() -> AWSSimpleSystemsManagementClientBuilder.defaultClient()).thenReturn(client);

                                GetParameterResult getParameterResult = mock(GetParameterResult.class, RETURNS_DEEP_STUBS);
                                doReturn(getParameterResult).when(client).getParameter(any());
                                String key = "-----BEGIN RSA PRIVATE KEY-----\n" +
                                        "MIICXAIBAAKBgQCqGKukO1De7zhZj6+H0qtjTkVxwTCpvKe4eCZ0FPqri0cb2JZfXJ/DgYSF6vUp\n" +
                                        "wmJG8wVQZKjeGcjDOL5UlsuusFncCzWBQ7RKNUSesmQRMSGkVb1/3j+skZ6UtW+5u09lHNsj6tQ5\n" +
                                        "1s1SPrCBkedbNf0Tp0GbMJDyR4e9T04ZZwIDAQABAoGAFijko56+qGyN8M0RVyaRAXz++xTqHBLh\n" +
                                        "3tx4VgMtrQ+WEgCjhoTwo23KMBAuJGSYnRmoBZM3lMfTKevIkAidPExvYCdm5dYq3XToLkkLv5L2\n" +
                                        "pIIVOFMDG+KESnAFV7l2c+cnzRMW0+b6f8mR1CJzZuxVLL6Q02fvLi55/mbSYxECQQDeAw6fiIQX\n" +
                                        "GukBI4eMZZt4nscy2o12KyYner3VpoeE+Np2q+Z3pvAMd/aNzQ/W9WaI+NRfcxUJrmfPwIGm63il\n" +
                                        "AkEAxCL5HQb2bQr4ByorcMWm/hEP2MZzROV73yF41hPsRC9m66KrheO9HPTJuo3/9s5p+sqGxOlF\n" +
                                        "L0NDt4SkosjgGwJAFklyR1uZ/wPJjj611cdBcztlPdqoxssQGnh85BzCj/u3WqBpE2vjvyyvyI5k\n" +
                                        "X6zk7S0ljKtt2jny2+00VsBerQJBAJGC1Mg5Oydo5NwD6BiROrPxGo2bpTbu/fhrT8ebHkTz2epl\n" +
                                        "U9VQQSQzY1oZMVX8i1m5WUTLPz2yLJIBQVdXqhMCQBGoiuSoSjafUhV7i1cEGpb88h5NBYZzWXGZ\n" +
                                        "37sJ5QsW+sJyoNde3xH8vdXhzU7eT82D6X/scw9RZz+/6rCJ4p0=\n" +
                                        "-----END RSA PRIVATE KEY-----";
                                when(getParameterResult.getParameter().getValue()).thenReturn(key);

                                MockedStatic<Jwts> jwtsMockedStatic = Mockito.mockStatic(Jwts.class, RETURNS_DEEP_STUBS);
                                jwtsMockedStatic.when(() -> Jwts.builder().setAudience(any()).setIssuedAt(any()).setExpiration(any()).setIssuer(any()).setSubject(any()).setId(any()).signWith(any(), anyString()).compact()).thenReturn("sample-jwtToken");
                                
                                tsw.sendMessage(message, messageId, startTime, endTime);
                            }
                    );
        } catch (Exception e) {
            System.out.println(e.getMessage());
        }
    }
}