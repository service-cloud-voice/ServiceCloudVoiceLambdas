package com.amazonaws.kvstranscribestreaming;

import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.salesforce.scv.SCVLoggingUtil;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

public class ConfigManager {
    private static final Map<String, Map<String, String>> secretCache = new ConcurrentHashMap<>();
    private static final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Configuration object that holds all config values loaded from AWS Secrets Manager
     */
    public static class SecretConfig {
        private final Map<String, String> configValues;
        private final String sourceSecretName;

        private SecretConfig(Map<String, String> configValues, String sourceSecretName) {
            this.configValues = Map.copyOf(configValues);
            this.sourceSecretName = sourceSecretName;
        }

        public String getConfigValue(String key) {
            return configValues.get(key);
        }

        public String getRequiredConfigValue(String key) {
            String value = configValues.get(key);
            if (value == null) {
                throw new RuntimeException("Required configuration key '" + key + "' not found in secret: " + sourceSecretName);
            }
            return value;
        }

        public String getSourceSecretName() {
            return sourceSecretName;
        }


    }

    /**
     * Get secret-based configuration object from payload.
     *
     * @param secretName Required secretName from the invocation payload
     * @return SecretConfig object containing all configuration values
     */
    public static SecretConfig getSecretConfig(String secretName) {
        if (secretName == null || secretName.isEmpty()) {
            throw new RuntimeException("secretName must be provided in payload from kvsConsumerTrigger");
        }

        SCVLoggingUtil.debug("com.amazonaws.kvstranscribestreaming.ConfigManager.getSecretConfig",
                SCVLoggingUtil.EVENT_TYPE.TRANSCRIPTION,
                "Using secretName from payload: " + secretName,
                null);

        // Get config values with proper locking
        Map<String, String> configValues = getConfigValuesWithLock(secretName);
        return new SecretConfig(configValues, secretName);
    }

    /**
     * Thread-safe method to get config values with double-checked locking
     */
    private static Map<String, String> getConfigValuesWithLock(String secretName) {
        Map<String, String> config = secretCache.get(secretName);
        if (config == null) {
            synchronized (ConfigManager.class) {
                config = secretCache.get(secretName);
                if (config == null) {
                    SCVLoggingUtil.debug("com.amazonaws.kvstranscribestreaming.ConfigManager.getConfigValuesWithLock",
                            SCVLoggingUtil.EVENT_TYPE.TRANSCRIPTION,
                            "Loading and caching config from secret: " + secretName,
                            null);
                    config = loadConfigFromSecret(secretName);
                    secretCache.put(secretName, config);
                }
            }
        }
        return config;
    }



    private static synchronized Map<String, String> loadConfigFromSecret(String secretName) {
        if (secretName == null || secretName.isEmpty()) {
            throw new RuntimeException("secretName parameter is required");
        }

        SCVLoggingUtil.debug("com.amazonaws.kvstranscribestreaming.ConfigManager.loadConfig",
                SCVLoggingUtil.EVENT_TYPE.TRANSCRIPTION,
                "Loading config from provided secretName: " + secretName,
                null);

        try {
            SecretsManagerClient client = SecretsManagerClient.create();
            GetSecretValueRequest request = GetSecretValueRequest.builder()
                    .secretId(secretName)
                    .build();
            GetSecretValueResponse response = client.getSecretValue(request);
            return objectMapper.readValue(response.secretString(), Map.class);
        } catch (Exception e) {
            SCVLoggingUtil.error("com.amazonaws.kvstranscribestreaming.ConfigManager.loadConfig",
                    SCVLoggingUtil.EVENT_TYPE.TRANSCRIPTION,
                    "Failed to load configuration from secrets: " + e.getMessage(),
                    null);
            throw new RuntimeException("Failed to load configuration from secrets", e);
        }
    }
}