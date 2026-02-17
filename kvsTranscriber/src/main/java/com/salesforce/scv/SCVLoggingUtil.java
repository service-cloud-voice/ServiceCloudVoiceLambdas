/**
 *  Copyright, 2020, salesforce.com
 *  // TODO: remove this note once we can keep this file in sync between different repos automatically.
 *  Note: We are using SCVLoggingUtil in both current repo and service-cloud-realtime/scrt2-ia-telephonyintegration-service. For now,
 *  any change or update on SCVLoggingUtil.java here should also be made in
 *  https://git.soma.salesforce.com/service-cloud-realtime/scrt2-ia-telephonyintegration-service/blob/master/src/main/java/com/salesforce/scrt/v2/app/util/SCVLoggingUtil.java,
 *  and vice versa.
 */
package com.salesforce.scv;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.*;
import com.google.gson.Gson;

/**
 * Java logging utils class used in SCV project
 *
 */
public class SCVLoggingUtil {
    /**
     * Public enum for all event types.
     */
    public enum EVENT_TYPE {
        PERFORMANCE,
        TRANSCRIPTION,
        VOICECALL,
        INBOUND,
        OUTBOUND,
        TRANSFER,
        PROVISIONING
    }

    private static Logger logger = LoggerFactory.getLogger(SCVLoggingUtil.class);

    /** Logging Level:
     *  INFO,   // For generally useful information to log
     *  WARN,   // For anything that can potentially cause application oddities
     *  ERROR,  // For any error which is fatal to the operation
     *  DEBUG,  // Only when you would be "debugging" the code and trying to find one part of a function specifically
     *  TRACE,  // Only when you would be "tracing" the code and trying to find one part of a function specifically
     */

    /**
     * Create a log line with level of INFO
     *
     * @param logCategory fully qualified function/name
     * @param eventType performance / transcription / voicecall / ivr / inbounc / outbound / transfer
     * @param message meaningful log messages
     * @param context map of key/value pairs of all related information (please refer to recommended context key for each EventType)
     */
    public static void info(String logCategory, EVENT_TYPE eventType, String message, Map<String, String> context) {
        logger.info(createLoggingMessage(logCategory, eventType, message, context));
    }

    /**
     * Create a log line with level of WARN.
     *
     * @param logCategory fully qualified function/name
     * @param eventType performance / transcription / voicecall / ivr / inbounc / outbound / transfer
     * @param message meaningful log messages
     * @param context map of key/value pairs of all related information (please refer to recommended context key for each EventType)
     */
    public static void warn(String logCategory, EVENT_TYPE eventType, String message, Map<String, String> context) {
        logger.warn(createLoggingMessage(logCategory, eventType, message, context));
    }

    /**
     * Create a log line with level of ERROR.
     *
     * @param logCategory fully qualified function/name
     * @param eventType performance / transcription / voicecall / ivr / inbounc / outbound / transfer
     * @param message meaningful log messages
     * @param context map of key/value pairs of all related information (please refer to recommended context key for each EventType)
     */
    public static void error(String logCategory, EVENT_TYPE eventType, String message, Map<String, String> context) {
        logger.error(createLoggingMessage(logCategory, eventType, message, context));
    }

    /**
     * Create a log line with level of DEBUG.
     *
     * @param logCategory fully qualified function/name
     * @param eventType performance / transcription / voicecall / ivr / inbounc / outbound / transfer
     * @param message meaningful log messages
     * @param context map of key/value pairs of all related information (please refer to recommended context key for each EventType)
     */
    public static void debug(String logCategory, EVENT_TYPE eventType, String message, Map<String, String> context) {
        logger.debug(createLoggingMessage(logCategory, eventType, message, context));
    }

    /**
     * Create a log line with level of TRACE.
     *
     * @param logCategory fully qualified function/name
     * @param eventType performance / transcription / voicecall / ivr / inbounc / outbound / transfer
     * @param message meaningful log messages
     * @param context map of key/value pairs of all related information (please refer to recommended context key for each EventType)
     */
    public static void trace(String logCategory, EVENT_TYPE eventType, String message, Map<String, String> context) {
        logger.trace(createLoggingMessage(logCategory, eventType, message, context));
    }

    /**
     * Helper function for creating logging message.
     *
     * @param logCategory fully qualified function/name
     * @param eventType performance / transcription / voicecall / ivr / inbounc / outbound / transfer
     * @param message meaningful log messages
     * @param context map of key/value pairs of all related information
     */
    private static String createLoggingMessage(String logCategory, EVENT_TYPE eventType, String message, Map<String, String> context) {
        LoggerParams.Builder paramsBuilder = LoggerParams.newBuilder();
        paramsBuilder
                .setLogCategory(logCategory)
                .setEventType(eventType)
                .setMessage(message)
                .setContext(context);
        return paramsBuilder.build().toString();
    }

    /**
     * Static class for helping build up log line with various params (Builder patten utilized).
     */
    static class LoggerParams {
        private final String logCategory;
        private final EVENT_TYPE eventType;
        private final String message;
        private final Map<String, String> context;

        private LoggerParams(Builder builder) {
            logCategory = builder.logCategory;
            eventType = builder.eventType;
            message = builder.message;
            context = builder.context;
        }

        public static Builder newBuilder() {
            return new Builder();
        }

        public static final class Builder {
            private String logCategory;
            private EVENT_TYPE eventType;
            private String message;
            private Map<String, String> context;

            private Builder() {}

            public Builder setLogCategory(String val) {
                logCategory = val;
                return this;
            }

            public Builder setMessage(String val) {
                message = val;
                return this;
            }

            public Builder setEventType(EVENT_TYPE val) {
                eventType = val;
                return this;
            }

            public Builder setContext(Map<String, String> val) {
                context = val;
                return this;
            }

            public LoggerParams build() {
                return new LoggerParams(this);
            }
        }

        /**
         * Utility method to parse context map.
         */
        private String parseContext(Map<String, String> map) {
            return new Gson().toJson(map);
        }

        @Override
        public String toString() {
            return "category: " + logCategory + ", event_type: " + eventType + ", " + message + ", " + parseContext(context);
        }
    }

    /**
     * Public enum for recommended context key of performance.
     */
    public enum PERFORMANCE_CONTEXT_KEY {
        ORG_ID, // required
        TOTAL_RESPONSE_TIME_NS, // add unit for time related keys
        SELF_TIME_NS,
        EXTERNAL_TIME_NS,
        AWS_TRANSCRIPTION_TIME_MS,
        REQUEST_TYPE,
        OPERATION_TYPE,
        RESPONSE_CODE,
        END_POINT,
        CALL_OUT_SERVICE,
        CONVERSATION_IDENTIFIER
    }

    /**
     * Public enum for recommended context key of transcription.
     */
    public enum TRANSCRIPTION_CONTEXT_KEY {
        ORG_ID, // required
        MESSAGE_ID, // required
        START_TIME,
        END_TIME,
        END_POINT,
        RESPONSE_CODE
    }

    /**
     * Public enum for recommended context key of voicecall.
     */
    public enum VOICECALL_CONTEXT_KEY {
        ORG_ID, // required
        VOICE_CALL_ID // required
    }

    /**
     * Public enum for recommended context key of inbound.
     */
    public enum INBOUND_CONTEXT_KEY {
        ORG_ID, // required
        VOICE_CALL_ID, // required
        RESPONSE_CODE,
        IVR_RELATED_CONTEXT
    }

    /**
     * Public enum for recommended context key of outbound.
     */
    public enum OUTBOUND_CONTEXT_KEY {
        ORG_ID, // required
        RESPONSE_CODE
    }

    /**
     * Public enum for recommended context key of transfer.
     */
    public enum TRANSFER_CONTEXT_KEY {
        ORG_ID, // required
        VOICE_CALL_ID,
        TRANSFER_TYPE, // required
        RESPONSE_CODE,
    }

    /**
     * Public enum for recommended context key of provisioning.
     */
    public enum PROVISIONING_CONTEXT_KEY {
        ORG_ID, // required
        STEP_NAME, // required
        IS_SUCCESS,
        ERRORS,
        NUM_RETRY,
        JOB_NAME, // required
        EXTERNAL_CALLOUT_DURATION
    }
}