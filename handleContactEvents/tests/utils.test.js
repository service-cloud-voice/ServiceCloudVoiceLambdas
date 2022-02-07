const utils = require('../utils');

describe('isDisconnectedEventForAbandonedCall', () => {
    let input1 = { 
        "version": "0", 
        "id": "bc198b12-2a16-c92b-5925-5a0a06a39bf2", 
        "detail-type": "Amazon Connect Contact Event", 
        "source": "aws.connect", 
        "account": "352672060859", 
        "time": "2021-08-29T18:39:44Z", 
        "region": "us-west-2", 
        "resources": [ 
            "arn:aws:connect:us-west-2:352672060859:instance/f75946c0-bc38-4252-8174-468f6ac2543d", 
            "arn:aws:connect:us-west-2:352672060859:instance/f75946c0-bc38-4252-8174-468f6ac2543d/contact/58092a11-6075-4025-a57d-6ada88b26d5b" 
            ], 
            "detail": { 
                "contactId": "58092a11-6075-4025-a57d-6ada88b26d5b", 
                "channel": "VOICE", 
                "instanceArn": "arn:aws:connect:us-west-2:352672060859:instance/f75946c0-bc38-4252-8174-468f6ac2543d", 
                "initiationMethod": "INBOUND", 
                "eventType": "DISCONNECTED" 
            } 
    };

    it('Should not qualify for clearPSR', () => {
        expect(utils.isDisconnectedEventForAbandonedCall(input1)).toStrictEqual(false);
    });

    let input2 = { 
        "version": "0", 
        "id": "bc198b12-2a16-c92b-5925-5a0a06a39bf2", 
        "detail-type": "Amazon Connect Contact Event", 
        "source": "aws.connect", 
        "account": "352672060859", 
        "time": "2021-08-29T18:39:44Z", 
        "region": "us-west-2", 
        "resources": [ 
            "arn:aws:connect:us-west-2:352672060859:instance/f75946c0-bc38-4252-8174-468f6ac2543d", 
            "arn:aws:connect:us-west-2:352672060859:instance/f75946c0-bc38-4252-8174-468f6ac2543d/contact/58092a11-6075-4025-a57d-6ada88b26d5b" 
            ], 
            "detail": { 
                "contactId": "58092a11-6075-4025-a57d-6ada88b26d5b", 
                "channel": "VOICE", 
                "instanceArn": "arn:aws:connect:us-west-2:352672060859:instance/f75946c0-bc38-4252-8174-468f6ac2543d", 
                "initiationMethod": "INBOUND", 
                "eventType": "DISCONNECTED",
                "queueInfo": "Basic"
            } 
    };

    it('Should qualify for clearPSR', () => {
        expect(utils.isDisconnectedEventForAbandonedCall(input2)).toStrictEqual(true);
    });

    let input3 = { 
        "version": "0", 
        "id": "bc198b12-2a16-c92b-5925-5a0a06a39bf2", 
        "detail-type": "Amazon Connect Contact Event", 
        "source": "aws.connect", 
        "account": "352672060859", 
        "time": "2021-08-29T18:39:44Z", 
        "region": "us-west-2", 
        "resources": [ 
            "arn:aws:connect:us-west-2:352672060859:instance/f75946c0-bc38-4252-8174-468f6ac2543d", 
            "arn:aws:connect:us-west-2:352672060859:instance/f75946c0-bc38-4252-8174-468f6ac2543d/contact/58092a11-6075-4025-a57d-6ada88b26d5b" 
            ], 
            "detail": { 
                "contactId": "58092a11-6075-4025-a57d-6ada88b26d5b", 
                "channel": "VOICE", 
                "instanceArn": "arn:aws:connect:us-west-2:352672060859:instance/f75946c0-bc38-4252-8174-468f6ac2543d", 
                "initiationMethod": "INBOUND", 
                "eventType": "DISCONNECTED",
                "queueInfo": "Basic",
                "agentInfo": "Agent1"
            } 
    };

    it('Should not qualify for clearPSR', () => {
        expect(utils.isDisconnectedEventForAbandonedCall(input3)).toStrictEqual(false);
    });

    let input4 = {};

    it('Should not qualify for clearPSR', () => {
        expect(utils.isDisconnectedEventForAbandonedCall(input4)).toStrictEqual(false);
    });
 
    let input5 = null;

    it('Should not qualify for clearPSR', () => {
        expect(utils.isDisconnectedEventForAbandonedCall(input5)).toStrictEqual(false);
    });

    let input6 = undefined;

    it('Should not qualify for clearPSR', () => {
        expect(utils.isDisconnectedEventForAbandonedCall(input6)).toStrictEqual(false);
    });
    
    let input7 = { 
        "version": "0", 
        "id": "bc198b12-2a16-c92b-5925-5a0a06a39bf2", 
        "detail-type": "Amazon Connect Contact Event", 
        "source": "aws.connect", 
        "account": "352672060859", 
        "time": "2021-08-29T18:39:44Z", 
        "region": "us-west-2", 
        "resources": [ 
            "arn:aws:connect:us-west-2:352672060859:instance/f75946c0-bc38-4252-8174-468f6ac2543d", 
            "arn:aws:connect:us-west-2:352672060859:instance/f75946c0-bc38-4252-8174-468f6ac2543d/contact/58092a11-6075-4025-a57d-6ada88b26d5b" 
            ], 
            "detail": { 
                "contactId": "58092a11-6075-4025-a57d-6ada88b26d5b", 
                "channel": "VOICE", 
                "instanceArn": "arn:aws:connect:us-west-2:352672060859:instance/f75946c0-bc38-4252-8174-468f6ac2543d", 
                "initiationMethod": "TRANSFER", 
                "eventType": "DISCONNECTED",
                "queueInfo": "Basic"
            } 
    };

    it('Should qualify for clearPSR', () => {
        expect(utils.isDisconnectedEventForAbandonedCall(input7)).toStrictEqual(true);
    });
    
    let input8 = { 
        "version": "0", 
        "id": "bc198b12-2a16-c92b-5925-5a0a06a39bf2", 
        "detail-type": "Amazon Connect Contact Event", 
        "source": "aws.connect", 
        "account": "352672060859", 
        "time": "2021-08-29T18:39:44Z", 
        "region": "us-west-2", 
        "resources": [ 
            "arn:aws:connect:us-west-2:352672060859:instance/f75946c0-bc38-4252-8174-468f6ac2543d", 
            "arn:aws:connect:us-west-2:352672060859:instance/f75946c0-bc38-4252-8174-468f6ac2543d/contact/58092a11-6075-4025-a57d-6ada88b26d5b" 
            ], 
            "detail": { 
                "contactId": "58092a11-6075-4025-a57d-6ada88b26d5b", 
                "channel": "VOICE", 
                "instanceArn": "arn:aws:connect:us-west-2:352672060859:instance/f75946c0-bc38-4252-8174-468f6ac2543d", 
                "initiationMethod": "OUTBOUND", 
                "eventType": "DISCONNECTED",
                "queueInfo": "Basic"
            } 
    };

    it('Should not qualify for clearPSR', () => {
        expect(utils.isDisconnectedEventForAbandonedCall(input8)).toStrictEqual(false);
    });
});
