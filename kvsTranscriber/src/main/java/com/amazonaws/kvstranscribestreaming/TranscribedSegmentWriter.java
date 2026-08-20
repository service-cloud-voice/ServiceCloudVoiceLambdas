package com.amazonaws.kvstranscribestreaming;

import org.apache.commons.lang3.Validate;
import org.json.simple.JSONObject;

import io.github.resilience4j.retry.IntervalFunction;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;

import software.amazon.awssdk.services.connect.ConnectClient;
import software.amazon.awssdk.services.connect.model.UpdateContactAttributesRequest;
import software.amazon.awssdk.services.transcribestreaming.model.Result;
import software.amazon.awssdk.services.transcribestreaming.model.TranscriptEvent;
import software.amazon.awssdk.services.transcribestreaming.model.MedicalResult;
import software.amazon.awssdk.services.transcribestreaming.model.MedicalTranscriptEvent;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Base64;
import java.util.UUID;
import java.time.temporal.ChronoUnit;
import java.security.KeyFactory;
import java.security.NoSuchAlgorithmException;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Security;
import java.security.interfaces.RSAPrivateCrtKey;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.RSAPublicKeySpec;

import org.bouncycastle.jce.provider.BouncyCastleProvider;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;

import com.salesforce.scv.SCVLoggingUtil;

/**
 * TranscribedSegmentWriter writes the transcript and sent to the Telephony Integration service on SCRT 2.0
 */
public class TranscribedSegmentWriter {

    private static final String AUDIENCE = "https://scrt.salesforce.com";
    private static final String PRIVATE_KEY_START_DECORATION_LINE = "-----BEGIN RSA PRIVATE KEY-----";
    private static final String PRIVATE_KEY_END_DECORATION_LINE = "-----END RSA PRIVATE KEY-----";
    private static final String PRIVATE_KEY_REXP_TO_REPLACE = "\\s+";
    private static final String END_USER = "END_USER";
    private static final String VIRTUAL_AGENT = "VIRTUAL_AGENT";
    public static final String SEND_MESSAGE = "sendMessage";

    private static final Retry RETRY_429 = Retry.of(SEND_MESSAGE, RetryConfig.<Integer>custom()
            .maxAttempts(3)
            .retryOnResult(code -> code != null && code == 429)
            .retryOnException(e -> false)
            .intervalFunction(IntervalFunction.ofExponentialRandomBackoff(1000, 2.0, 0.5))
            .build());

    private String voiceCallId;
    private boolean isFromCustomer;
    long audioStartTimestamp;
    String customerPhoneNumber;
    private PrivateKey privKeyObject = null;
    private PublicKey pubKeyObject = null;
    private String jwtToken = null;
    private String instanceARN = null;
    
    // Config values extracted once in constructor
    private final String scrtEndpointBase;
    private final String salesforceOrgId;
    private final String callCenterApiName;
    private final String privateKey;

    public TranscribedSegmentWriter(String instanceARN, String voiceCallId, boolean isFromCustomer, long audioStartTimestamp, String customerPhoneNumber, ConfigManager.SecretConfig config) {
        this.voiceCallId = Validate.notNull(voiceCallId);
        this.isFromCustomer = isFromCustomer;
        this.audioStartTimestamp = audioStartTimestamp;
        this.customerPhoneNumber = customerPhoneNumber;
        this.instanceARN = instanceARN;
        
        this.scrtEndpointBase = config.getConfigValue("SCRT_ENDPOINT_BASE");
        this.salesforceOrgId = config.getConfigValue("SALESFORCE_ORG_ID");
        this.callCenterApiName = config.getConfigValue("CALL_CENTER_API_NAME");
        String privateKeyParamName = this.callCenterApiName + "-scrt-jwt-auth-private-key";
        String rawPrivateKey = config.getConfigValue(privateKeyParamName);
        this.privateKey = rawPrivateKey
            .replace(PRIVATE_KEY_START_DECORATION_LINE, "")
            .replace(PRIVATE_KEY_END_DECORATION_LINE, "")
            .replaceAll(PRIVATE_KEY_REXP_TO_REPLACE, "");
        
        SCVLoggingUtil.info("com.amazonaws.kvstranscribestreaming.TranscribedSegmentWriter.constructor", 
            SCVLoggingUtil.EVENT_TYPE.TRANSCRIPTION, 
            "Using configuration from secret: " + config.getSourceSecretName(), 
            null);
    }



    public void sendStandardRealTimeTranscript(TranscriptEvent transcriptEvent) {
        List<Result> results = transcriptEvent.transcript().results();
        if (results.size() > 0) {
            Result result = results.get(0);

            // save the result when it is not partial
            if (!result.isPartial() && result.alternatives().size() > 0 && !result.alternatives().get(0).transcript().isEmpty()) {
                String message = result.alternatives().get(0).transcript();
                String messageId = result.resultId();

                // audioStartTimeStamp: passed from JS lambda, which in millisecond (long, like 1584048369054)
                // result.startTime and result.endTime: relative time to audioStartTimeStamp in second (double, like: 3.333)
                // we need to create startTime and endTime as timestamp in mill-seconds
                long startTime = Math.round(this.audioStartTimestamp + result.startTime() * 1000);
                long endTime = Math.round(this.audioStartTimestamp + result.endTime() * 1000);

                // send message
                sendMessage(message, messageId, startTime, endTime);
            }
        }
    }

    public void sendMedicalRealTimeTranscript(MedicalTranscriptEvent transcriptEvent) {
        List<MedicalResult> results = transcriptEvent.transcript().results();
        if (results.size() > 0) {
            MedicalResult result = results.get(0);

            // save the result when it is not partial
            if (!result.isPartial() && result.alternatives().size() > 0 && !result.alternatives().get(0).transcript().isEmpty()) {
                String message = result.alternatives().get(0).transcript();
                String messageId = result.resultId();

                // audioStartTimeStamp: passed from JS lambda, which in millisecond (long, like 1584048369054)
                // result.startTime and result.endTime: relative time to audioStartTimeStamp in second (double, like: 3.333)
                // we need to create startTime and endTime as timestamp in mill-seconds
                long startTime = Math.round(this.audioStartTimestamp + result.startTime() * 1000);
                long endTime = Math.round(this.audioStartTimestamp + result.endTime() * 1000);

                // send message
                sendMessage(message, messageId, startTime, endTime);
            }
        }
    }

    /**
     * @param message   : The message content body
     * @param messageId : A unique identifier for message segment
     * @param startTime : Message start time in milisecond
     * @param endTime   : Message end time in milisecond
     */
    public void sendMessage(String message, String messageId, long startTime, long endTime) {
        try {
            SCVLoggingUtil.info(SEND_MESSAGE, SCVLoggingUtil.EVENT_TYPE.PERFORMANCE, "START Send Messages " + messageId, null);
            // get sender type and sender
            String senderType = this.isFromCustomer ? END_USER : VIRTUAL_AGENT;
            String sender = this.isFromCustomer ? customerPhoneNumber : voiceCallId;
            URL url = new URL(scrtEndpointBase + "/voiceCalls/" + voiceCallId + "/messages/");
            JSONObject sendMessagePayload = new JSONObject();
            sendMessagePayload.put("participantId", sender);
            sendMessagePayload.put("messageId", messageId);
            sendMessagePayload.put("startTime", Long.valueOf(startTime));
            sendMessagePayload.put("endTime", Long.valueOf(endTime));
            sendMessagePayload.put("content", message);
            sendMessagePayload.put("senderType", senderType);

            int lastCode = Retry.decorateCallable(RETRY_429, () -> executeRequest(url, getJWTToken(), sendMessagePayload)).call();

            HashMap<String, String> loggingContextMap = new HashMap<>();
            loggingContextMap.put(SCVLoggingUtil.TRANSCRIPTION_CONTEXT_KEY.RESPONSE_CODE.toString(), String.valueOf(lastCode));
            loggingContextMap.put(SCVLoggingUtil.TRANSCRIPTION_CONTEXT_KEY.MESSAGE_ID.toString(), messageId);
            loggingContextMap.put(SCVLoggingUtil.TRANSCRIPTION_CONTEXT_KEY.START_TIME.toString(), String.valueOf(startTime));
            loggingContextMap.put(SCVLoggingUtil.TRANSCRIPTION_CONTEXT_KEY.END_TIME.toString(), String.valueOf(endTime));
            loggingContextMap.put(SCVLoggingUtil.TRANSCRIPTION_CONTEXT_KEY.END_POINT.toString(),  scrtEndpointBase + "/voiceCalls/" + voiceCallId + "/messages/");
            SCVLoggingUtil.info(SEND_MESSAGE, SCVLoggingUtil.EVENT_TYPE.TRANSCRIPTION, "Response " + lastCode, loggingContextMap);

            if (lastCode == 429) {
                // Update the Contact Attribute with the specific limits error
                ConnectClient client  = ConnectClient.create();
                Map<String, String> attribsMap = new HashMap<>();
                attribsMap.put("sf_realtime_transcription_status", "Exceeded Limits for creating messages in Transcription");

                UpdateContactAttributesRequest updateContactAttributesRequest = UpdateContactAttributesRequest.builder()
                        .initialContactId(voiceCallId)
                        .instanceId(instanceARN)
                        .attributes(attribsMap)
                        .build();

                client.updateContactAttributes(updateContactAttributesRequest);
            }
        } catch (Exception e) {
            SCVLoggingUtil.error(SEND_MESSAGE, SCVLoggingUtil.EVENT_TYPE.TRANSCRIPTION, e.getMessage(), null);
        }
    }

    private int executeRequest(URL url, String jwtToken, JSONObject payload) throws IOException {
        HttpURLConnection con = (HttpURLConnection) url.openConnection();
        try {
            con.setRequestMethod("POST");
            con.setRequestProperty("Authorization", "Bearer " + jwtToken);
            con.setRequestProperty("Content-Type", "application/json; utf-8");
            con.setRequestProperty("Accept", "application/json");
            con.setRequestProperty("Telephony-Provider-Name", "amazon-connect");
            con.setDoOutput(true);

            SCVLoggingUtil.info("com.amazonaws.kvstranscribestreaming.executeRequest",
                SCVLoggingUtil.EVENT_TYPE.PERFORMANCE,
                "Sending HTTP request to SCRT2 endpoint: " + url.getPath(),
                null);

            try (OutputStream os = con.getOutputStream()) {
                OutputStreamWriter osw = new OutputStreamWriter(os, StandardCharsets.UTF_8);
                payload.writeJSONString(osw);
                osw.close();
            }
            return con.getResponseCode();
        } finally {
            con.disconnect();
        }
    }

    /**
     * get JWT Token. Will create new token if there is no JWT Token, or, existing JWT Token expires
     * @return JWT token
     * @throws NoSuchAlgorithmException
     * @throws InvalidKeySpecException
     */
     private String getJWTToken() throws NoSuchAlgorithmException, InvalidKeySpecException {
        SCVLoggingUtil.info("com.amazonaws.kvstranscribestreaming.getJWTToken", SCVLoggingUtil.EVENT_TYPE.PERFORMANCE, "START Get JWT Token", null);
        try {
            // if JWT Token exist, verify if it is valid
            if (this.jwtToken != null && this.jwtToken.length() > 0 && this.pubKeyObject != null) {
                Claims claims = Jwts.parser().verifyWith(pubKeyObject).build().parseSignedClaims(jwtToken).getPayload();
                String[] tokenParts = this.jwtToken.split("\\.");
                if (!claims.isEmpty() && tokenParts.length == 3) {
                    return this.jwtToken;
                }
            }
        } catch (Exception e) {
            SCVLoggingUtil.error("com.amazonaws.kvstranscribestreaming.getJWTToken", SCVLoggingUtil.EVENT_TYPE.TRANSCRIPTION, e.getMessage(), null);
        }
        Security.addProvider(new BouncyCastleProvider());
        PKCS8EncodedKeySpec keySpec = new PKCS8EncodedKeySpec(Base64.getDecoder().decode(privateKey));
        KeyFactory kf = KeyFactory.getInstance("RSA");
        this.privKeyObject = kf.generatePrivate(keySpec);
        
        // Extract public key from private key for JWT verification
        RSAPrivateCrtKey privKeyCrt = (RSAPrivateCrtKey) this.privKeyObject;
        RSAPublicKeySpec publicKeySpec = new RSAPublicKeySpec(privKeyCrt.getModulus(), privKeyCrt.getPublicExponent());
        this.pubKeyObject = kf.generatePublic(publicKeySpec);

        Instant now = Instant.now();
        this.jwtToken = Jwts.builder().audience().add(AUDIENCE).and().issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(5L, ChronoUnit.MINUTES))).issuer(salesforceOrgId)
                .subject(callCenterApiName).id(UUID.randomUUID().toString())
                .signWith(privKeyObject, SignatureAlgorithm.RS256).compact();

        SCVLoggingUtil.info("com.amazonaws.kvstranscribestreaming.getJWTToken", SCVLoggingUtil.EVENT_TYPE.PERFORMANCE, "END Get JWT Token", null);
        return this.jwtToken;
     }
}