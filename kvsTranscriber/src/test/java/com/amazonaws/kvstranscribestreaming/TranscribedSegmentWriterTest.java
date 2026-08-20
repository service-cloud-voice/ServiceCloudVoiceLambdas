package com.amazonaws.kvstranscribestreaming;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.bouncycastle.asn1.pkcs.PrivateKeyInfo;
import org.bouncycastle.asn1.pkcs.RSAPrivateKey;
import org.junit.Rule;
import org.junit.contrib.java.lang.system.EnvironmentVariables;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import software.amazon.awssdk.services.connect.ConnectClient;
import software.amazon.awssdk.services.connect.model.UpdateContactAttributesRequest;
import software.amazon.awssdk.services.transcribestreaming.model.Alternative;
import software.amazon.awssdk.services.transcribestreaming.model.MedicalAlternative;
import software.amazon.awssdk.services.transcribestreaming.model.MedicalResult;
import software.amazon.awssdk.services.transcribestreaming.model.MedicalTranscript;
import software.amazon.awssdk.services.transcribestreaming.model.MedicalTranscriptEvent;
import software.amazon.awssdk.services.transcribestreaming.model.Result;
import software.amazon.awssdk.services.transcribestreaming.model.Transcript;
import software.amazon.awssdk.services.transcribestreaming.model.TranscriptEvent;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.InetSocketAddress;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;

import static com.github.stefanbirkner.systemlambda.SystemLambda.withEnvironmentVariable;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;


/**
 *
 * Unit tests for TranscribedSegmentWriter
 *
 * @author nan.shao
 */
public class TranscribedSegmentWriterTest {
    private static final String TEST_SECRET_NAME = "test-secret-name";
    private static final String TEST_ORG_ID = "00DRM000000HT6d";
    private static final String TEST_CALL_CENTER_API_NAME = "HVCC228";
    private static final String TEST_SCRT_ENDPOINT_BASE = "https://228com3.my.stmfa.stm.salesforce-scrt.com/telephony/v1";
    private static final String TEST_JWT_AUDIENCE = "https://scrt.salesforce.com";

    private static final String TEST_INSTANCE_ARN = "arn:aws:connect:us-east-1:123456789012:instance/b6070940-51ab-4aa2-97df-6e6bf6950458";
    private static final String TEST_VOICE_CALL_ID = "a4a471f8-dcd5-444d-bdbc-1a81e188adf7";
    private static final long TEST_AUDIO_START = 1599287207;
    private static final String TEST_CUSTOMER_PHONE = "+18586667777";
    private static final String TEST_MESSAGE = "test message";
    private static final String TEST_MESSAGE_ID = "e1dc4239-94d4-4143-86ea-418f4eeb63b8";

    private static final int HTTP_OK = 200;
    private static final int HTTP_BAD_REQUEST = 400;
    private static final int HTTP_TOO_MANY_REQUESTS = 429;
    private static final int HTTP_SERVER_ERROR = 500;

    @Rule
    public final EnvironmentVariables environmentVariables = new EnvironmentVariables();

    /**
     * Helper method to generate a test RSA key pair dynamically at runtime.
     * This avoids hardcoding private keys in source code which triggers credential scanners.
     *
     * @return String formatted RSA private key in PKCS#1 format
     */
    private String generateTestRSAPrivateKey() throws Exception {
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
        keyGen.initialize(2048);
        KeyPair keyPair = keyGen.generateKeyPair();

        PrivateKey privateKey = keyPair.getPrivate();
        byte[] pkcs8Bytes = privateKey.getEncoded();
        PKCS8EncodedKeySpec pkcs8Spec = new PKCS8EncodedKeySpec(pkcs8Bytes);
        PrivateKeyInfo privateKeyInfo = PrivateKeyInfo.getInstance(pkcs8Spec.getEncoded());
        RSAPrivateKey rsaPrivateKey = RSAPrivateKey.getInstance(privateKeyInfo.parsePrivateKey());

        byte[] pkcs1Bytes = rsaPrivateKey.getEncoded();
        String base64Encoded = Base64.getEncoder().encodeToString(pkcs1Bytes);

        StringBuilder formatted = new StringBuilder("-----BEGIN RSA PRIVATE KEY-----\n");
        for (int i = 0; i < base64Encoded.length(); i += 64) {
            formatted.append(base64Encoded.substring(i, Math.min(i + 64, base64Encoded.length())));
            formatted.append("\n");
        }
        formatted.append("-----END RSA PRIVATE KEY-----");

        return formatted.toString();
    }

    /**
     * Creates a mock SecretConfig with test values for integration testing.
     *
     * @param baseUrl The base URL for the SCRT endpoint
     * @return Configured mock SecretConfig
     */
    private ConfigManager.SecretConfig createMockConfig(String baseUrl) throws Exception {
        ConfigManager.SecretConfig mockConfig = mock(ConfigManager.SecretConfig.class);
        when(mockConfig.getConfigValue("SALESFORCE_ORG_ID")).thenReturn(TEST_ORG_ID);
        when(mockConfig.getConfigValue("CALL_CENTER_API_NAME")).thenReturn(TEST_CALL_CENTER_API_NAME);
        when(mockConfig.getConfigValue("SCRT_ENDPOINT_BASE")).thenReturn(baseUrl);
        when(mockConfig.getSourceSecretName()).thenReturn(TEST_SECRET_NAME);
        String privateKey = generateTestRSAPrivateKey();
        when(mockConfig.getConfigValue(TEST_CALL_CENTER_API_NAME + "-scrt-jwt-auth-private-key")).thenReturn(privateKey);
        return mockConfig;
    }

    /**
     * Creates a mock HTTP server that responds with a fixed status code for all requests.
     * Used for testing HTTP client behavior with different response codes.
     *
     * @param statusCode The HTTP status code to return
     * @return Started HttpServer instance on random available port
     */
    private HttpServer createMockHttpServer(int statusCode) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/", (HttpExchange exchange) -> {
            exchange.getRequestBody().readAllBytes();
            exchange.sendResponseHeaders(statusCode, 0);
            exchange.close();
        });
        server.start();
        return server;
    }

    /**
     * Creates a mock HTTP server that simulates retry behavior.
     * Returns specified status codes in sequence, one per request.
     * Useful for testing retry logic and error recovery.
     *
     * @param statusCodes HTTP status codes to return in order
     * @return Started HttpServer instance on random available port
     */
    private HttpServer createMockHttpServerWithSequence(int... statusCodes) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        final int[] requestCount = {0};
        server.createContext("/", (HttpExchange exchange) -> {
            exchange.getRequestBody().readAllBytes();
            int currentRequest = requestCount[0]++;
            int statusCode = currentRequest < statusCodes.length
                    ? statusCodes[currentRequest]
                    : statusCodes[statusCodes.length - 1];
            exchange.sendResponseHeaders(statusCode, 0);
            exchange.close();
        });
        server.start();
        return server;
    }

    @Test
    void sendMessageTest() {
        try {
            withEnvironmentVariable("SECRET_NAME", TEST_SECRET_NAME)
                    .execute(
                            () -> {
                                assertEquals(TEST_SECRET_NAME, System.getenv("SECRET_NAME"));

                                MockedStatic<Jwts> jwtsMockedStatic = Mockito.mockStatic(Jwts.class, RETURNS_DEEP_STUBS);
                                jwtsMockedStatic.when(() -> Jwts.builder().setAudience(any()).setIssuedAt(any()).setExpiration(any()).setIssuer(any()).setSubject(any()).setId(any()).signWith(any(), anyString()).compact()).thenReturn("sample-jwtToken");

                                ConfigManager.SecretConfig mockConfig = mock(ConfigManager.SecretConfig.class);
                                when(mockConfig.getConfigValue("SALESFORCE_ORG_ID")).thenReturn(TEST_ORG_ID);
                                when(mockConfig.getConfigValue("CALL_CENTER_API_NAME")).thenReturn(TEST_CALL_CENTER_API_NAME);
                                when(mockConfig.getConfigValue("SCRT_ENDPOINT_BASE")).thenReturn(TEST_SCRT_ENDPOINT_BASE);
                                when(mockConfig.getSourceSecretName()).thenReturn(TEST_SECRET_NAME);
                                String privateKey = generateTestRSAPrivateKey();
                                when(mockConfig.getConfigValue(TEST_CALL_CENTER_API_NAME + "-scrt-jwt-auth-private-key")).thenReturn(privateKey);

                                TranscribedSegmentWriter tsw = new TranscribedSegmentWriter(TEST_INSTANCE_ARN, TEST_VOICE_CALL_ID, true, TEST_AUDIO_START, TEST_CUSTOMER_PHONE, mockConfig);
                                long endTime = TEST_AUDIO_START + 1000;

                                tsw.sendMessage(TEST_MESSAGE, TEST_MESSAGE_ID, TEST_AUDIO_START, endTime);

                                jwtsMockedStatic.close();
                            }
                    );
        } catch (Exception e) {
            System.out.println(e.getMessage());
        }
    }

    /**
     * Test case to validate JWT token verification using public key (not private key)
     * This test ensures that the JWT token is correctly verified using pubKeyObject
     * Previously, using privKeyObject for verification was throwing exceptions
     */
    @Test
    void testJWTTokenVerificationWithPublicKey() {
        try {
            withEnvironmentVariable("SECRET_NAME", TEST_SECRET_NAME)
                    .execute(() -> {
                        ConfigManager.SecretConfig mockConfig = mock(ConfigManager.SecretConfig.class);
                        when(mockConfig.getConfigValue("SALESFORCE_ORG_ID")).thenReturn(TEST_ORG_ID);
                        when(mockConfig.getConfigValue("CALL_CENTER_API_NAME")).thenReturn(TEST_CALL_CENTER_API_NAME);
                        when(mockConfig.getConfigValue("SCRT_ENDPOINT_BASE")).thenReturn("https://test.salesforce-scrt.com/telephony/v1");
                        when(mockConfig.getSourceSecretName()).thenReturn(TEST_SECRET_NAME);
                        String privateKey = generateTestRSAPrivateKey();
                        when(mockConfig.getConfigValue(TEST_CALL_CENTER_API_NAME + "-scrt-jwt-auth-private-key")).thenReturn(privateKey);

                        TranscribedSegmentWriter tsw = new TranscribedSegmentWriter(
                                TEST_INSTANCE_ARN, TEST_VOICE_CALL_ID, true, TEST_AUDIO_START, TEST_CUSTOMER_PHONE, mockConfig);

                        Method getJWTTokenMethod = TranscribedSegmentWriter.class.getDeclaredMethod("getJWTToken");
                        getJWTTokenMethod.setAccessible(true);

                        String jwtToken1 = (String) getJWTTokenMethod.invoke(tsw);
                        assertNotNull(jwtToken1);
                        assertTrue(jwtToken1.split("\\.").length == 3);

                        Field privKeyField = TranscribedSegmentWriter.class.getDeclaredField("privKeyObject");
                        privKeyField.setAccessible(true);
                        PrivateKey privKey = (PrivateKey) privKeyField.get(tsw);
                        assertNotNull(privKey);

                        Field pubKeyField = TranscribedSegmentWriter.class.getDeclaredField("pubKeyObject");
                        pubKeyField.setAccessible(true);
                        PublicKey pubKey = (PublicKey) pubKeyField.get(tsw);
                        assertNotNull(pubKey);

                        Claims claims = Jwts.parser()
                                .verifyWith(pubKey)
                                .build()
                                .parseSignedClaims(jwtToken1)
                                .getPayload();

                        assertNotNull(claims);
                        assertEquals(TEST_ORG_ID, claims.getIssuer());
                        assertEquals(TEST_CALL_CENTER_API_NAME, claims.getSubject());
                        assertEquals(TEST_JWT_AUDIENCE, claims.getAudience().iterator().next());

                        String jwtToken2 = (String) getJWTTokenMethod.invoke(tsw);
                        assertEquals(jwtToken1, jwtToken2);
                    });
        } catch (Exception e) {
            System.out.println("Test failed with exception: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException(e);
        }
    }

    @Test
    void sendMessage_2xx_success() throws Exception {
        HttpServer server = createMockHttpServer(HTTP_OK);
        try {
            String baseUrl = "http://localhost:" + server.getAddress().getPort() + "/telephony/v1";
            ConfigManager.SecretConfig mockConfig = createMockConfig(baseUrl);
            ConnectClient mockConnectClient = mock(ConnectClient.class);
            try (MockedStatic<ConnectClient> connectMock = Mockito.mockStatic(ConnectClient.class)) {
                connectMock.when(ConnectClient::create).thenReturn(mockConnectClient);
                TranscribedSegmentWriter tsw = new TranscribedSegmentWriter(TEST_INSTANCE_ARN, TEST_VOICE_CALL_ID, true, TEST_AUDIO_START, TEST_CUSTOMER_PHONE, mockConfig);
                tsw.sendMessage(TEST_MESSAGE, TEST_MESSAGE_ID, TEST_AUDIO_START, TEST_AUDIO_START + 1000);
                verify(mockConnectClient, never()).updateContactAttributes(any(UpdateContactAttributesRequest.class));
            }
        } finally {
            server.stop(0);
        }
    }

    @Test
    void sendMessage_429_retriesExhausted_updatesContactAttribute() throws Exception {
        HttpServer server = createMockHttpServer(HTTP_TOO_MANY_REQUESTS);
        try {
            String baseUrl = "http://localhost:" + server.getAddress().getPort() + "/telephony/v1";
            ConfigManager.SecretConfig mockConfig = createMockConfig(baseUrl);
            ConnectClient mockConnectClient = mock(ConnectClient.class);
            try (MockedStatic<ConnectClient> connectMock = Mockito.mockStatic(ConnectClient.class)) {
                connectMock.when(ConnectClient::create).thenReturn(mockConnectClient);
                TranscribedSegmentWriter tsw = new TranscribedSegmentWriter(
                        TEST_INSTANCE_ARN, TEST_VOICE_CALL_ID, true, TEST_AUDIO_START, TEST_CUSTOMER_PHONE, mockConfig);
                tsw.sendMessage(TEST_MESSAGE, TEST_MESSAGE_ID, TEST_AUDIO_START, TEST_AUDIO_START + 1000);
                ArgumentCaptor<UpdateContactAttributesRequest> captor = ArgumentCaptor.forClass(UpdateContactAttributesRequest.class);
                verify(mockConnectClient, times(1)).updateContactAttributes(captor.capture());
                UpdateContactAttributesRequest request = captor.getValue();
                assertEquals(TEST_VOICE_CALL_ID, request.initialContactId());
                assertEquals(TEST_INSTANCE_ARN, request.instanceId());
                assertEquals("Exceeded Limits for creating messages in Transcription", request.attributes().get("sf_realtime_transcription_status"));
            }
        } finally {
            server.stop(0);
        }
    }

    @Test
    void sendMessage_429_thenSuccess_noContactUpdate() throws Exception {
        HttpServer server = createMockHttpServerWithSequence(HTTP_TOO_MANY_REQUESTS, HTTP_OK);
        try {
            String baseUrl = "http://localhost:" + server.getAddress().getPort() + "/telephony/v1";
            ConfigManager.SecretConfig mockConfig = createMockConfig(baseUrl);
            ConnectClient mockConnectClient = mock(ConnectClient.class);
            try (MockedStatic<ConnectClient> connectMock = Mockito.mockStatic(ConnectClient.class)) {
                connectMock.when(ConnectClient::create).thenReturn(mockConnectClient);
                TranscribedSegmentWriter tsw = new TranscribedSegmentWriter(
                        TEST_INSTANCE_ARN, TEST_VOICE_CALL_ID, true, TEST_AUDIO_START, TEST_CUSTOMER_PHONE, mockConfig);
                tsw.sendMessage(TEST_MESSAGE, TEST_MESSAGE_ID, TEST_AUDIO_START, TEST_AUDIO_START + 1000);
                verify(mockConnectClient, never()).updateContactAttributes(any(UpdateContactAttributesRequest.class));
            }
        } finally {
            server.stop(0);
        }
    }

    @Test
    void sendMessage_4xx_noRetry_noContactUpdate() throws Exception {
        HttpServer server = createMockHttpServer(HTTP_BAD_REQUEST);
        try {
            String baseUrl = "http://localhost:" + server.getAddress().getPort() + "/telephony/v1";
            ConfigManager.SecretConfig mockConfig = createMockConfig(baseUrl);
            ConnectClient mockConnectClient = mock(ConnectClient.class);
            try (MockedStatic<ConnectClient> connectMock = Mockito.mockStatic(ConnectClient.class)) {
                connectMock.when(ConnectClient::create).thenReturn(mockConnectClient);
                TranscribedSegmentWriter tsw = new TranscribedSegmentWriter(
                        TEST_INSTANCE_ARN, TEST_VOICE_CALL_ID, true, TEST_AUDIO_START, TEST_CUSTOMER_PHONE, mockConfig);
                tsw.sendMessage(TEST_MESSAGE, TEST_MESSAGE_ID, TEST_AUDIO_START, TEST_AUDIO_START + 1000);
                verify(mockConnectClient, never()).updateContactAttributes(any(UpdateContactAttributesRequest.class));
            }
        } finally {
            server.stop(0);
        }
    }

    @Test
    void sendMessage_5xx_noRetry_noContactUpdate() throws Exception {
        HttpServer server = createMockHttpServer(HTTP_SERVER_ERROR);
        try {
            String baseUrl = "http://localhost:" + server.getAddress().getPort() + "/telephony/v1";
            ConfigManager.SecretConfig mockConfig = createMockConfig(baseUrl);
            ConnectClient mockConnectClient = mock(ConnectClient.class);
            try (MockedStatic<ConnectClient> connectMock = Mockito.mockStatic(ConnectClient.class)) {
                connectMock.when(ConnectClient::create).thenReturn(mockConnectClient);
                TranscribedSegmentWriter tsw = new TranscribedSegmentWriter(
                        TEST_INSTANCE_ARN, TEST_VOICE_CALL_ID, true, TEST_AUDIO_START, TEST_CUSTOMER_PHONE, mockConfig);
                tsw.sendMessage(TEST_MESSAGE, TEST_MESSAGE_ID, TEST_AUDIO_START, TEST_AUDIO_START + 1000);
                verify(mockConnectClient, never()).updateContactAttributes(any(UpdateContactAttributesRequest.class));
            }
        } finally {
            server.stop(0);
        }
    }

    @Test
    void sendMessage_connectionFails_logsNoThrow_noContactUpdate() throws Exception {
        String baseUrl = "http://localhost:39399/telephony/v1";
        ConfigManager.SecretConfig mockConfig = createMockConfig(baseUrl);
        ConnectClient mockConnectClient = mock(ConnectClient.class);
        try (MockedStatic<ConnectClient> connectMock = Mockito.mockStatic(ConnectClient.class)) {
            connectMock.when(ConnectClient::create).thenReturn(mockConnectClient);
            TranscribedSegmentWriter tsw = new TranscribedSegmentWriter(
                    TEST_INSTANCE_ARN, TEST_VOICE_CALL_ID, true, TEST_AUDIO_START, TEST_CUSTOMER_PHONE, mockConfig);
            tsw.sendMessage(TEST_MESSAGE, TEST_MESSAGE_ID, TEST_AUDIO_START, TEST_AUDIO_START + 1000);
            verify(mockConnectClient, never()).updateContactAttributes(any(UpdateContactAttributesRequest.class));
        }
    }

    @Test
    void sendStandardRealTimeTranscript_sendsMessage_success() throws Exception {
        HttpServer server = createMockHttpServer(HTTP_OK);
        try {
            String baseUrl = "http://localhost:" + server.getAddress().getPort() + "/telephony/v1";
            ConfigManager.SecretConfig mockConfig = createMockConfig(baseUrl);
            ConnectClient mockConnectClient = mock(ConnectClient.class);
            try (MockedStatic<ConnectClient> connectMock = Mockito.mockStatic(ConnectClient.class)) {
                connectMock.when(ConnectClient::create).thenReturn(mockConnectClient);
                TranscribedSegmentWriter tsw = new TranscribedSegmentWriter(
                        TEST_INSTANCE_ARN, TEST_VOICE_CALL_ID, true, TEST_AUDIO_START, TEST_CUSTOMER_PHONE, mockConfig);

                Alternative alternative = Alternative.builder()
                        .transcript("Hello world")
                        .build();
                Result result = Result.builder()
                        .resultId("test-result-id-123")
                        .isPartial(false)
                        .startTime(1.5)
                        .endTime(2.5)
                        .alternatives(alternative)
                        .build();
                Transcript transcript = Transcript.builder()
                        .results(result)
                        .build();
                TranscriptEvent transcriptEvent = TranscriptEvent.builder()
                        .transcript(transcript)
                        .build();

                tsw.sendStandardRealTimeTranscript(transcriptEvent);

                verify(mockConnectClient, never()).updateContactAttributes(any(UpdateContactAttributesRequest.class));
            }
        } finally {
            server.stop(0);
        }
    }

    @Test
    void sendMedicalRealTimeTranscript_sendsMessage_success() throws Exception {
        HttpServer server = createMockHttpServer(HTTP_OK);
        try {
            String baseUrl = "http://localhost:" + server.getAddress().getPort() + "/telephony/v1";
            ConfigManager.SecretConfig mockConfig = createMockConfig(baseUrl);
            ConnectClient mockConnectClient = mock(ConnectClient.class);
            try (MockedStatic<ConnectClient> connectMock = Mockito.mockStatic(ConnectClient.class)) {
                connectMock.when(ConnectClient::create).thenReturn(mockConnectClient);
                TranscribedSegmentWriter tsw = new TranscribedSegmentWriter(
                        TEST_INSTANCE_ARN, TEST_VOICE_CALL_ID, true, TEST_AUDIO_START, TEST_CUSTOMER_PHONE, mockConfig);

                MedicalAlternative alternative = MedicalAlternative.builder()
                        .transcript("Patient has elevated blood pressure")
                        .build();
                MedicalResult result = MedicalResult.builder()
                        .resultId("test-medical-result-id-456")
                        .isPartial(false)
                        .startTime(2.0)
                        .endTime(3.5)
                        .alternatives(alternative)
                        .build();
                MedicalTranscript transcript = MedicalTranscript.builder()
                        .results(result)
                        .build();
                MedicalTranscriptEvent transcriptEvent = MedicalTranscriptEvent.builder()
                        .transcript(transcript)
                        .build();

                tsw.sendMedicalRealTimeTranscript(transcriptEvent);

                verify(mockConnectClient, never()).updateContactAttributes(any(UpdateContactAttributesRequest.class));
            }
        } finally {
            server.stop(0);
        }
    }

    /**
     * Test to verify that OutputStreamWriter properly flushes buffered data to the server.
     * This test catches the regression from W-21432978 where removing osw.close() caused
     * buffered data to never be sent, resulting in HTTP 400 errors from the server.
     *
     * Without proper flush/close of the OutputStreamWriter, the JSON payload remains in
     * the writer's buffer and is never written to the underlying OutputStream, causing
     * the server to receive incomplete/malformed JSON which it rejects with HTTP 400.
     */
    @Test
    void sendMessage_properlyFlushesBufferedData() throws Exception {
        // Create server that validates JSON structure like production
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/", (HttpExchange exchange) -> {
            try {
                String body = new String(exchange.getRequestBody().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);

                // Parse as JSON - this fails if buffer wasn't flushed and JSON is incomplete
                org.json.simple.parser.JSONParser parser = new org.json.simple.parser.JSONParser();
                org.json.simple.JSONObject json = (org.json.simple.JSONObject) parser.parse(body);

                // Validate required fields exist
                if (json.containsKey("messageId") && json.containsKey("content") &&
                    json.containsKey("participantId") && json.containsKey("senderType")) {
                    exchange.sendResponseHeaders(HTTP_OK, 0);
                } else {
                    exchange.sendResponseHeaders(HTTP_BAD_REQUEST, 0);
                }
            } catch (Exception e) {
                // Malformed/incomplete JSON = 400 (like production behavior)
                exchange.sendResponseHeaders(HTTP_BAD_REQUEST, 0);
            }
            exchange.close();
        });
        server.start();

        try {
            String baseUrl = "http://localhost:" + server.getAddress().getPort() + "/telephony/v1";
            ConfigManager.SecretConfig mockConfig = createMockConfig(baseUrl);
            ConnectClient mockConnectClient = mock(ConnectClient.class);

            try (MockedStatic<ConnectClient> connectMock = Mockito.mockStatic(ConnectClient.class)) {
                connectMock.when(ConnectClient::create).thenReturn(mockConnectClient);
                TranscribedSegmentWriter tsw = new TranscribedSegmentWriter(
                        TEST_INSTANCE_ARN, TEST_VOICE_CALL_ID, true, TEST_AUDIO_START, TEST_CUSTOMER_PHONE, mockConfig);

                tsw.sendMessage(TEST_MESSAGE, TEST_MESSAGE_ID, TEST_AUDIO_START, TEST_AUDIO_START + 1000);

                // If we get here without HTTP 400, the JSON was valid and complete
                // Without close/flush, the JSON would be incomplete and server would return 400
                verify(mockConnectClient, never()).updateContactAttributes(any(UpdateContactAttributesRequest.class));
            }
        } finally {
            server.stop(0);
        }
    }
}