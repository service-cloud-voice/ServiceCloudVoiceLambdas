const SCVLoggingUtil = require("./SCVLoggingUtil");
const queryEngine = require("./queryEngine");
const secretUtils = require("./secretUtils");

function getAgentARN(event) {
    if (event.Details.Parameters.agentARN) {
        return event.Details.Parameters.agentARN;
    } else {
        return null;
    }
}

function getSerializableError(error) {
    if (error && error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    }
    return error;
}

async function getDefaultVoicemailGreetingUrl(agentARN, secretName, accessTokenSecretName) {
    const qry = `SELECT VoiceMailGreeting2.GreetingUrl FROM VoiceMailGreeting2Rep
                                      WHERE VoiceMailGreeting2.Type='DROP'
                                        AND RepId IN (SELECT ReferenceRecordId
                                                      FROM CallCenterRoutingMap
                                                      WHERE ExternalId = '${agentARN}')
                                        AND IsDefault = true
                                          LIMIT 1`;

    let results;
    try {
        results = await queryEngine.invokeQuery(qry, {
            methodName: "queryRecord",
        }, secretName, accessTokenSecretName);
        if (results && results.success === false) {
            SCVLoggingUtil.error({
                message:
                    "Error in querying voicemail greeting to find greeting url.",
                context: { payload: { results: results, qry: qry } },
            });
        }
    } catch (e) {
        SCVLoggingUtil.error({
            message:
                "Couldn't query voicemail greeting to find greeting url.",
            context: {
                payload: {
                    qry: qry,
                    error: getSerializableError(e),
                },
            },
        });
    }

    return results && results.GreetingUrl
        ? results.GreetingUrl
        : null;
}

async function fetchDefaultVoicemailGreetingUrl(event, secretName, accessTokenSecretName) {
    const agentARN = getAgentARN(event);
    if (!agentARN) {
        SCVLoggingUtil.error({
            message: "Couldn't find agentARN in event details parameters",
            context: { payload: event },
        });
        return {
            success: true,
        };
    }

    const defaultVoicemailGreetingUrl = await getDefaultVoicemailGreetingUrl(agentARN, secretName, accessTokenSecretName);
    if (!defaultVoicemailGreetingUrl) {
        SCVLoggingUtil.error({
            message: "Couldn't find default voicemail greeting url from voicemail greeting.",
            context: { payload: { agentARN } },
        });
        return {
            success: true,
        };
    }

    return {
        success: true,
        GreetingUrl: defaultVoicemailGreetingUrl,
    };

}

module.exports = {
    fetchDefaultVoicemailGreetingUrl,
};