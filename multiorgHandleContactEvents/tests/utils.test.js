const utils = require('../utils');

describe('Test isDisconnectedEventForAbandonedCall', () => {
    let event;
    beforeEach(() => {
        event = {
            "detail-type": "Amazon Connect Contact Event",
            "detail": {
                "initiationMethod": "INBOUND",
                "eventType": "DISCONNECTED"
            }
        };
    });

    it('should be disconnected event', () => {
        expect(utils.isDisconnectedEventForAbandonedCall(event)).toStrictEqual(true);
    });

    it('should not be disconnected event : event is null', () => {
        event = null;
        expect(utils.isDisconnectedEventForAbandonedCall(event)).toStrictEqual(false);
    });

    it('should not be disconnected event : detail is null', () => {
        event.detail = null;
        expect(utils.isDisconnectedEventForAbandonedCall(event)).toStrictEqual(false);
    });

    it('should not be disconnected event : wrong detail-type', () => {
        event["detail-type"] = "Incorrect detail type";
        expect(utils.isDisconnectedEventForAbandonedCall(event)).toStrictEqual(false);
    });

    it('should not be disconnected event : wrong initiation method', () => {
        event.detail.initiationMethod = "Incorrect initiation method";
        expect(utils.isDisconnectedEventForAbandonedCall(event)).toStrictEqual(false);
    });

    it('should not be disconnected event : wrong event type', () => {
        event.detail.eventType = "Incorrect event type";
        expect(utils.isDisconnectedEventForAbandonedCall(event)).toStrictEqual(false);
    });

    it('should not be disconnected event : agentInfo present', () => {
        event.detail.agentInfo = "Agent Info";
        expect(utils.isDisconnectedEventForAbandonedCall(event)).toStrictEqual(false);
    });
});

describe('Test isRoutingCriteriaExpiredEventForCall', () => {
    let event;
    beforeEach(() => {
        event = {
            "detail-type": "Amazon Connect Contact Event",
            "detail": {
                "initiationMethod": "TRANSFER",
                "eventType": "CONTACT_DATA_UPDATED",
                "routingCriteria": {
                    "steps": [
                        {
                            "expression": {
                                "attributeCondition": {
                                    "matchCriteria": {
                                        "agentsCriteria": {
                                            "agentIds": []
                                        }
                                    }
                                }
                            },
                            "status": "EXPIRED"
                        }
                    ]
                }
            }
        };
    });

    it('should be routing expired event', () => {
        expect(utils.isRoutingCriteriaExpiredEventForCall(event)).toStrictEqual(true);
    });

    it('should not be routing expired event : event is null', () => {
        event = null;
        expect(utils.isRoutingCriteriaExpiredEventForCall(event)).toStrictEqual(false);
    });

    it('should not be routing expired event : detail is null', () => {
        event.detail = null;
        expect(utils.isRoutingCriteriaExpiredEventForCall(event)).toStrictEqual(false);
    });

    it('should not be routing expired event : routingCriteria is null', () => {
        event.detail.routingCriteria = null;
        expect(utils.isRoutingCriteriaExpiredEventForCall(event)).toStrictEqual(false);
    });

    it('should not be routing expired event : wrong detail-type', () => {
        event["detail-type"] = "Incorrect detail type";
        expect(utils.isRoutingCriteriaExpiredEventForCall(event)).toStrictEqual(false);
    });

    it('should not be routing expired event : wrong initiation method', () => {
        event.detail.initiationMethod = "Incorrect initiation method";
        expect(utils.isRoutingCriteriaExpiredEventForCall(event)).toStrictEqual(false);
    });

    it('should not be routing expired event : wrong event type', () => {
        event.detail.eventType = "Incorrect event type";
        expect(utils.isRoutingCriteriaExpiredEventForCall(event)).toStrictEqual(false);
    });

    it('should not be routing expired event : steps is empty', () => {
        event.detail.routingCriteria.steps = [];
        expect(utils.isRoutingCriteriaExpiredEventForCall(event)).toStrictEqual(false);
    });

    it('should not be routing expired event : wrong routingCriteria status', () => {
        event.detail.routingCriteria.steps[0].status = "Incorrect status";
        expect(utils.isRoutingCriteriaExpiredEventForCall(event)).toStrictEqual(false);
    });

    it('should not be routing expired event : wrong routingCriteria status', () => {
        event.detail.routingCriteria.steps[0].status = "Incorrect status";
        expect(utils.isRoutingCriteriaExpiredEventForCall(event)).toStrictEqual(false);
    });

    it('should not be routing expired event : expression is null', () => {
        event.detail.routingCriteria.steps[0].expression = null;
        expect(utils.isRoutingCriteriaExpiredEventForCall(event)).toStrictEqual(false);
    });

    it('should not be routing expired event : attributeCondition is null', () => {
        event.detail.routingCriteria.steps[0].expression.attributeCondition = null;
        expect(utils.isRoutingCriteriaExpiredEventForCall(event)).toStrictEqual(false);
    });

    it('should not be routing expired event : matchCriteria is null', () => {
        event.detail.routingCriteria.steps[0].expression.attributeCondition.matchCriteria = null;
        expect(utils.isRoutingCriteriaExpiredEventForCall(event)).toStrictEqual(false);
    });

    it('should not be routing expired event : agentsCriteria is null', () => {
        event.detail.routingCriteria.steps[0].expression.attributeCondition.matchCriteria.agentsCriteria = null;
        expect(utils.isRoutingCriteriaExpiredEventForCall(event)).toStrictEqual(false);
    });
});