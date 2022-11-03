function isDisconnectedEventForAbandonedCall(event) {
  return (
    event !== null &&
    event !== undefined &&
    event["detail-type"] === "Amazon Connect Contact Event" &&
    event.detail !== null &&
    event.detail !== undefined &&
    (event.detail.initiationMethod === "INBOUND" ||
      event.detail.initiationMethod === "TRANSFER") &&
    event.detail.eventType === "DISCONNECTED" &&
    event.detail.queueInfo !== null &&
    event.detail.queueInfo !== undefined &&
    (event.detail.agentInfo === null || event.detail.agentInfo === undefined)
  );
}

module.exports = {
  isDisconnectedEventForAbandonedCall,
};
