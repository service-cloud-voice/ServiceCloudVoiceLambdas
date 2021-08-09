package com.amazonaws.kvstranscribestreaming;

import org.apache.commons.lang3.Validate;
import org.json.simple.JSONObject;

import software.amazon.awssdk.services.connect.ConnectClient;
import software.amazon.awssdk.services.connect.model.UpdateContactAttributesRequest;
import software.amazon.awssdk.services.transcribestreaming.model.Result;
import software.amazon.awssdk.services.transcribestreaming.model.TranscriptEvent;
import java.time.Instant;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import java.util.Map;
import java.util.Date;
import java.util.HashMap;
import java.util.Base64;
import java.util.UUID;

import java.time.temporal.ChronoUnit;
import java.security.KeyFactory;
import java.security.NoSuchAlgorithmException;
import java.security.PrivateKey;
import java.security.Security;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.PKCS8EncodedKeySpec;

import org.bouncycastle.jce.provider.BouncyCastleProvider;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;

import com.amazonaws.services.simplesystemsmanagement.AWSSimpleSystemsManagement;
import com.amazonaws.services.simplesystemsmanagement.AWSSimpleSystemsManagementClientBuilder;
import com.amazonaws.services.simplesystemsmanagement.model.GetParameterRequest;
import com.amazonaws.services.simplesystemsmanagement.model.GetParameterResult;
import com.salesforce.scv.SCVLoggingUtil;

/**
 * TranscribedSegmentWriter writes the transcript and sent to the Telephony Integration service on SCRT 2.0
 */
public class TranscribedSegmentWriter {
    private static final String SALESFORCE_ORG_ID = System.getenv("SALESFORCE_ORG_ID");
    private static final String PRIVATE_KEY_PARAM_NAME = System.getenv("PRIVATE_KEY_PARAM_NAME");
    private static final String CALL_CENTER_API_NAME = System.getenv("CALL_CENTER_API_NAME");
    private static final String SCRT_ENDPOINT_BASE = System.getenv("SCRT_ENDPOINT_BASE");
    private static final String AUDIENCE = "https://scrt.salesforce.com";
    private static final String PRIVATE_KEY_START_DECORATION_LINE = "-----BEGIN RSA PRIVATE KEY-----";
    private static final String PRIVATE_KEY_END_DECORATION_LINE = "-----END RSA PRIVATE KEY-----";
    private static final String PRIVATE_KEY_REXP_TO_REPLACE = "\\s+";
    private static final String END_USER = "END_USER";
    private static final String HUMAN_AGENT = "HUMAN_AGENT";

    private String voiceCallId;
    private boolean isFromCustomer;
    long audioStartTimestamp;
    String customerPhoneNumber;
    private PrivateKey privKeyObject = null;
    private String jwtToken = null;
    private String instanceARN = null;

    public TranscribedSegmentWriter(String instanceARN, String voiceCallId, boolean isFromCustomer, long audioStartTimestamp, String customerPhoneNumber) {
        this.voiceCallId = Validate.notNull(voiceCallId);
        this.isFromCustomer = isFromCustomer;
        this.audioStartTimestamp = audioStartTimestamp;
        this.customerPhoneNumber = customerPhoneNumber;
        this.instanceARN = instanceARN;
    }

    public void sendRealTimeTranscript(TranscriptEvent transcriptEvent) {
        List<Result> results = transcriptEvent.transcript().results();
        if (results.size() > 0) {
            Result result = results.get(0);
            
            // save the result when it is not partial
            if (!result.isPartial() && result.alternatives().size() > 0 && !result.alternatives().get(0).transcript().isEmpty()) {
                String message = result.alternatives().get(0).transcript();
                String messageId = result.resultId();
                
                // audioStartTimeStamp:  passed from JS lambda, which in millisecond (long, like 1584048369054)
                // result.startTime and result.endTime: relative time to audioStartTimeStamp in second (double, like: 3.333) 
                // we need to create startTime and endTime as timestamp in mill-seconds   
                long startTime = Math.round(this.audioStartTimestamp + result.startTime()*1000); 
                long endTime = Math.round(this.audioStartTimestamp + result.endTime()*1000); 

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
            SCVLoggingUtil.info("com.amazonaws.kvstranscribestreaming.sendMessage", SCVLoggingUtil.EVENT_TYPE.PERFORMANCE, "START Send Messages " + messageId, null);
            // get sender type and sender
            String senderType = this.isFromCustomer ? END_USER : HUMAN_AGENT;
            String sender = this.isFromCustomer ? customerPhoneNumber : voiceCallId;
            
            // get JWT token
            String jwtToken = this.getJWTToken();
            
            JSONObject sendMessagePayload = new JSONObject();
            sendMessagePayload.put("participantId", sender);
            sendMessagePayload.put("messageId", messageId);
            sendMessagePayload.put("startTime", new Long(startTime));
            sendMessagePayload.put("endTime", new Long(endTime));
            sendMessagePayload.put("content", message);
            sendMessagePayload.put("senderType", senderType);

            URL url = new URL(SCRT_ENDPOINT_BASE + "/voiceCalls/" + voiceCallId + "/messages/");
            
            HttpURLConnection con = (HttpURLConnection) url.openConnection();
            con.setRequestMethod("POST");
            con.setRequestProperty("Authorization", "Bearer " + jwtToken);
            con.setRequestProperty("Content-Type", "application/json; utf-8");
            con.setRequestProperty("Accept", "application/json");
            con.setDoOutput(true);
                        
            try (OutputStream os = con.getOutputStream()) {
                OutputStreamWriter osw = new OutputStreamWriter(os, "UTF-8");
                sendMessagePayload.writeJSONString(osw);
                osw.close();
            }
            int code = con.getResponseCode();
            
            // logging the response
            HashMap<String, String> loggingContextMap = new HashMap<String, String>();
            loggingContextMap.put(SCVLoggingUtil.TRANSCRIPTION_CONTEXT_KEY.RESPONSE_CODE.toString(),  String.valueOf(code));
            loggingContextMap.put(SCVLoggingUtil.TRANSCRIPTION_CONTEXT_KEY.MESSAGE_ID.toString(),  messageId);
            loggingContextMap.put(SCVLoggingUtil.TRANSCRIPTION_CONTEXT_KEY.START_TIME.toString(), String.valueOf(startTime));
            loggingContextMap.put(SCVLoggingUtil.TRANSCRIPTION_CONTEXT_KEY.END_TIME.toString(), String.valueOf(endTime));
            loggingContextMap.put(SCVLoggingUtil.TRANSCRIPTION_CONTEXT_KEY.END_POINT.toString(),  SCRT_ENDPOINT_BASE + "/voiceCalls/" + voiceCallId + "/messages/");
            SCVLoggingUtil.info("com.amazonaws.kvstranscribestreaming.sendMessage", SCVLoggingUtil.EVENT_TYPE.TRANSCRIPTION, con.getResponseMessage(), loggingContextMap);
            
            if (code == 429) {
                // Update the Contact Attribute with the specific limits error
                ConnectClient client  = ConnectClient.create();
                Map<String, String> attribsMap = new HashMap<String, String>();
                attribsMap.put("sf_realtime_transcription_status", "Exceeded Limits for creating messages in Transcription");
                
                UpdateContactAttributesRequest updateContactAttributesRequest = UpdateContactAttributesRequest.builder()
                        .initialContactId(voiceCallId)
                        .instanceId(instanceARN)
                        .attributes(attribsMap)
                        .build();
                  
                client.updateContactAttributes(updateContactAttributesRequest);
            }
        } catch (Exception e) {
            SCVLoggingUtil.error("com.amazonaws.kvstranscribestreaming.sendMessage", SCVLoggingUtil.EVENT_TYPE.TRANSCRIPTION, e.getMessage(), null);
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
            if (this.jwtToken != null && this.jwtToken.length() > 0 ) {
                // validate if JWT token is valid or not. if it is valid, reuse existing token
                Claims claims = Jwts.parser().setSigningKey(privKeyObject).parseClaimsJws(jwtToken).getBody();
                if (!claims.isEmpty())
                    return this.jwtToken;
            }
        } catch (Exception e) {
            // skip: go next block of code and regenerate token
        }
        
        // get private key from AWS SSM system
        AWSSimpleSystemsManagement client = AWSSimpleSystemsManagementClientBuilder.defaultClient();
        GetParameterRequest getparameterRequest = new GetParameterRequest().withName(PRIVATE_KEY_PARAM_NAME).withWithDecryption(true);
        GetParameterResult result = client.getParameter(getparameterRequest);
        String privateKey = result.getParameter().getValue();
        privateKey = privateKey.replace(PRIVATE_KEY_START_DECORATION_LINE, "");
        privateKey = privateKey.replace(PRIVATE_KEY_END_DECORATION_LINE, "");
        privateKey = privateKey.replaceAll(PRIVATE_KEY_REXP_TO_REPLACE, "");

        // generate private key object and set to this.privKeyObject
        Security.addProvider(new BouncyCastleProvider());
        PKCS8EncodedKeySpec keySpec = new PKCS8EncodedKeySpec(Base64.getDecoder().decode(privateKey));
        KeyFactory kf = KeyFactory.getInstance("RSA");
        this.privKeyObject = kf.generatePrivate(keySpec);

        // generate JWT token which will be used for authentication and set to this.jwtToken
        Instant now = Instant.now();            
        this.jwtToken = Jwts.builder().setAudience(AUDIENCE).setIssuedAt(Date.from(now))
                .setExpiration(Date.from(now.plus(5L, ChronoUnit.MINUTES))).setIssuer(SALESFORCE_ORG_ID)
                .setSubject(CALL_CENTER_API_NAME).setId(UUID.randomUUID().toString())
                .signWith(SignatureAlgorithm.RS256, privKeyObject).compact();
        
        SCVLoggingUtil.info("com.amazonaws.kvstranscribestreaming.getJWTToken", SCVLoggingUtil.EVENT_TYPE.PERFORMANCE, "END Get JWT Token", null);
        return this.jwtToken;
     }
}