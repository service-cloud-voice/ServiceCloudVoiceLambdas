const contactEventDetailType = "Amazon Connect Contact Event";
const contactEventInitiationMethods = ["INBOUND", "TRANSFER"];

function isDisconnectedEventForAbandonedCall(event) {
  return (
    (event?.detail &&
      event["detail-type"] === contactEventDetailType &&
      contactEventInitiationMethods.includes(event.detail.initiationMethod) &&
      event.detail.eventType === "DISCONNECTED" &&
      !event.detail.agentInfo) ||
    false
  );
}

function isRoutingCriteriaExpiredEventForCall(event) {
  return (
    (event?.detail?.routingCriteria &&
      event["detail-type"] === contactEventDetailType &&
      contactEventInitiationMethods.includes(event.detail.initiationMethod) &&
      event.detail.eventType === "CONTACT_DATA_UPDATED" &&
      event.detail.updatedProperties?.includes("RoutingCriteria.Step.Status") &&
      event.detail.routingCriteria.steps[0]?.expression?.attributeCondition
        ?.matchCriteria?.agentsCriteria &&
      event.detail.routingCriteria.steps[0]?.status === "EXPIRED") ||
    false
  );
}

module.exports = {
  isDisconnectedEventForAbandonedCall,
  isRoutingCriteriaExpiredEventForCall,
};
