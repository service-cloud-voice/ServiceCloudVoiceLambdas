package com.amazonaws.kvstranscribestreaming;

import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;

import java.util.Optional;

import static com.github.stefanbirkner.systemlambda.SystemLambda.withEnvironmentVariable;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for ConfigManager
 */
public class ConfigManagerTest {

    @BeforeEach
    void setUp() {
        // Reset the secret cache before each test
        try {
            var field = ConfigManager.class.getDeclaredField("secretCache");
            field.setAccessible(true);
            var secretCache = (java.util.Map<?, ?>) field.get(null);
            secretCache.clear();
        } catch (Exception e) {
            // Ignore if field doesn't exist or cannot be accessed
        }
    }

    @Test
    void testGetSecretConfigWithValidSecret() throws Exception {
        String secretName = "test-secret";

        // Mock the AWS Secrets Manager
        try (MockedStatic<SecretsManagerClient> clientMock = Mockito.mockStatic(SecretsManagerClient.class)) {
            SecretsManagerClient mockClient = mock(SecretsManagerClient.class);
            clientMock.when(SecretsManagerClient::create).thenReturn(mockClient);

            // Create a mock GetSecretValueResponse with the secret string
            String secretJson = "{\"testKey\":\"testValue\",\"anotherKey\":\"anotherValue\"}";
            GetSecretValueResponse response = GetSecretValueResponse.builder()
                    .secretString(secretJson)
                    .build();

            when(mockClient.getSecretValue(any(GetSecretValueRequest.class))).thenReturn(response);

            // Test getting configuration values using new API
            ConfigManager.SecretConfig config = ConfigManager.getSecretConfig(secretName);
            String value = config.getConfigValue("testKey");
            assertEquals("testValue", value);

            String anotherValue = config.getConfigValue("anotherKey");
            assertEquals("anotherValue", anotherValue);

            // Verify that the client was called at least once
            verify(mockClient, atLeastOnce()).getSecretValue(any(GetSecretValueRequest.class));
        }
    }



    @Test
    void testGetConfigValueNullKey() throws Exception {
        String secretName = "test-secret";

        try (MockedStatic<SecretsManagerClient> clientMock = Mockito.mockStatic(SecretsManagerClient.class)) {
            SecretsManagerClient mockClient = mock(SecretsManagerClient.class);
            clientMock.when(SecretsManagerClient::create).thenReturn(mockClient);

            // Create a mock GetSecretValueResponse with the secret string
            String secretJson = "{\"testKey\":\"testValue\"}";
            GetSecretValueResponse response = GetSecretValueResponse.builder()
                    .secretString(secretJson)
                    .build();

            when(mockClient.getSecretValue(any(GetSecretValueRequest.class))).thenReturn(response);

            // Test getting a null value for non-existent key
            ConfigManager.SecretConfig config = ConfigManager.getSecretConfig(secretName);
            String value = config.getConfigValue("nonExistentKey");
            assertNull(value);
        }
    }

    @Test
    void testBasicFunctionality() throws Exception {
        String secretName = "test-secret";

        try (MockedStatic<SecretsManagerClient> clientMock = Mockito.mockStatic(SecretsManagerClient.class)) {
            SecretsManagerClient mockClient = mock(SecretsManagerClient.class);
            clientMock.when(SecretsManagerClient::create).thenReturn(mockClient);

            // Create a mock GetSecretValueResponse with the secret string
            String secretJson = "{\"testKey\":\"testValue\"}";
            GetSecretValueResponse response = GetSecretValueResponse.builder()
                    .secretString(secretJson)
                    .build();

            when(mockClient.getSecretValue(any(GetSecretValueRequest.class))).thenReturn(response);

            // Test basic functionality
            ConfigManager.SecretConfig config = ConfigManager.getSecretConfig(secretName);
            String value = config.getConfigValue("testKey");
            assertEquals("testValue", value);

            // Test source secret name
            assertEquals(secretName, config.getSourceSecretName());
        }
    }
}