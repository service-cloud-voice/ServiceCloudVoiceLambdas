> For agentic workers: implement this plan task-by-task with
> red-green-refactor discipline. One task, one commit. Never batch.

# Plan: Port `reserveRoutableNumber` to ServiceCloudVoiceLambdas

## Overview

Add the `reserveRoutableNumber` operation to the existing `invokeTelephonyIntegrationApi` lambda. This operation validates E.164 phone numbers, builds a context payload, and posts to the SCRT `/voiceCalls/reserveRoutableNumber` endpoint to reserve a routable number for outbound calling.

### Files Modified
- `invokeTelephonyIntegrationApi/utils.js` — add `isValidE164` helper
- `invokeTelephonyIntegrationApi/telephonyIntegrationApi.js` — add `reserveRoutableNumber` function + export
- `invokeTelephonyIntegrationApi/handler.js` — add switch case for `reserveRoutableNumber`

### Files Modified (Tests)
- `invokeTelephonyIntegrationApi/tests/utils.test.js` — tests for `isValidE164`
- `invokeTelephonyIntegrationApi/tests/telephonyIntegrationApi.test.js` — tests for `reserveRoutableNumber` API function
- `invokeTelephonyIntegrationApi/tests/handler.test.js` — tests for handler case delegation

---

## Task 1: Add `isValidE164` utility with tests

**Branch**: Stay on current branch (workflow mode).

### 1a. Write failing test

Add to `invokeTelephonyIntegrationApi/tests/utils.test.js`:

```javascript
describe("isValidE164", () => {
  it("should return true for valid E.164 numbers", () => {
    expect(utils.isValidE164("+11800999932")).toBe(true);
    expect(utils.isValidE164("+442071234567")).toBe(true);
    expect(utils.isValidE164("+15551234567")).toBe(true);
  });

  it("should return false for numbers without leading +", () => {
    expect(utils.isValidE164("11800999932")).toBe(false);
  });

  it("should return false for numbers starting with +0", () => {
    expect(utils.isValidE164("+01234567890")).toBe(false);
  });

  it("should return false for numbers exceeding 15 digits", () => {
    expect(utils.isValidE164("+1234567890123456")).toBe(false);
  });

  it("should return false for non-string input", () => {
    expect(utils.isValidE164(null)).toBe(false);
    expect(utils.isValidE164(undefined)).toBe(false);
    expect(utils.isValidE164(12345)).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(utils.isValidE164("")).toBe(false);
    expect(utils.isValidE164("+")).toBe(false);
  });
});
```

### 1b. Run tests — verify failure

```bash
cd invokeTelephonyIntegrationApi && npx jest tests/utils.test.js --no-coverage
```

Expected: `TypeError: utils.isValidE164 is not a function`

### 1c. Implement

Add to `invokeTelephonyIntegrationApi/utils.js` before `module.exports`:

```javascript
function isValidE164(phoneNumber) {
  return typeof phoneNumber === "string" && /^\+[1-9]\d{1,14}$/.test(phoneNumber);
}
```

Update `module.exports` to include `isValidE164`:

```javascript
module.exports = {
  generateJWT,
  getCallAttributes,
  constructFlowInputParams,
  isValidE164,
};
```

### 1d. Run tests — verify pass

```bash
cd invokeTelephonyIntegrationApi && npx jest tests/utils.test.js --no-coverage
```

### 1e. Commit

```
feat(utils): add isValidE164 phone number validation helper
```

---

## Task 2: Add `reserveRoutableNumber` to `telephonyIntegrationApi.js` with tests

### 2a. Write failing tests

Add to `invokeTelephonyIntegrationApi/tests/telephonyIntegrationApi.test.js`, inside the main `describe('telephonyIntegrationApi', ...)` block, before the closing of that block:

```javascript
describe('reserveRoutableNumber', () => {
  const mockParameters = {
    fromNumber: '+11800999932',
    toNumber: '+15551234567',
    countryCode: 'US',
    callId: '0LQLT000001jmnt',
    transactionId: 'tx-123',
  };
  const mockAttributes = {};
  const mockConfigDataWithPath = {
    ...mockConfigData,
    scrtEndpointBase: 'https://test-scrt-endpoint.com/path',
  };

  beforeEach(() => {
    utils.isValidE164.mockReturnValue(true);
  });

  it('should successfully reserve routable number', async () => {
    const mockResponseData = {
      handle: {
        routableNumber: '+14155560999',
        uid: 'uid-1',
        expiresAt: '2026-07-09T12:00:00Z',
      },
      mode: 'number',
    };
    const mockAxiosResponse = { data: mockResponseData };
    utils.generateJWT.mockResolvedValue('test-jwt-token');
    mockPost.mockResolvedValue(mockAxiosResponse);

    const result = await api.reserveRoutableNumber(mockParameters, mockAttributes, mockConfigData);

    verifyGenerateJWT();
    expect(mockPost).toHaveBeenCalledWith(
      '/voiceCalls/reserveRoutableNumber',
      {
        countryCode: 'US',
        fromNumber: '+11800999932',
        context: {
          scrt2Domain: 'https://test-scrt-endpoint.com',
          toNumber: '+15551234567',
          callId: '0LQLT000001jmnt',
          transactionId: 'tx-123',
        },
      },
      {
        headers: {
          ...buildAuthHeaders(),
          'Telephony-Provider-Name': 'amazon-connect',
        },
      }
    );
    expect(result).toEqual({
      statusCode: 200,
      routableNumber: '+14155560999',
      uid: 'uid-1',
      expiresAt: '2026-07-09T12:00:00Z',
      mode: 'number',
    });
  });

  it('should extract scrt2Domain origin from scrtEndpointBase with path', async () => {
    const mockResponseData = { handle: { routableNumber: '+1', uid: 'u', expiresAt: 'e' }, mode: 'm' };
    utils.generateJWT.mockResolvedValue('test-jwt-token');
    mockPost.mockResolvedValue({ data: mockResponseData });

    await api.reserveRoutableNumber(mockParameters, mockAttributes, mockConfigDataWithPath);

    expect(mockPost).toHaveBeenCalledWith(
      '/voiceCalls/reserveRoutableNumber',
      expect.objectContaining({
        context: expect.objectContaining({
          scrt2Domain: 'https://test-scrt-endpoint.com',
        }),
      }),
      expect.anything()
    );
  });

  it('should omit callId and transactionId from context when not provided', async () => {
    const paramsWithoutOptional = {
      fromNumber: '+11800999932',
      toNumber: '+15551234567',
      countryCode: 'US',
    };
    const mockResponseData = { handle: { routableNumber: '+1', uid: 'u', expiresAt: 'e' }, mode: 'm' };
    utils.generateJWT.mockResolvedValue('test-jwt-token');
    mockPost.mockResolvedValue({ data: mockResponseData });

    await api.reserveRoutableNumber(paramsWithoutOptional, mockAttributes, mockConfigData);

    const postCall = mockPost.mock.calls[0];
    const payload = postCall[1];
    expect(payload.context).not.toHaveProperty('callId');
    expect(payload.context).not.toHaveProperty('transactionId');
  });

  it('should fall back to attributes for countryCode', async () => {
    const paramsNoCountry = {
      fromNumber: '+11800999932',
      toNumber: '+15551234567',
    };
    const attrsWithCountry = { countryCode: 'GB' };
    const mockResponseData = { handle: { routableNumber: '+1', uid: 'u', expiresAt: 'e' }, mode: 'm' };
    utils.generateJWT.mockResolvedValue('test-jwt-token');
    mockPost.mockResolvedValue({ data: mockResponseData });

    await api.reserveRoutableNumber(paramsNoCountry, attrsWithCountry, mockConfigData);

    const postCall = mockPost.mock.calls[0];
    expect(postCall[1].countryCode).toBe('GB');
  });

  it('should fall back to attributes for callId and transactionId', async () => {
    const paramsNoOptional = {
      fromNumber: '+11800999932',
      toNumber: '+15551234567',
      countryCode: 'US',
    };
    const attrsWithIds = { callId: 'attr-call-id', transactionId: 'attr-tx-id' };
    const mockResponseData = { handle: { routableNumber: '+1', uid: 'u', expiresAt: 'e' }, mode: 'm' };
    utils.generateJWT.mockResolvedValue('test-jwt-token');
    mockPost.mockResolvedValue({ data: mockResponseData });

    await api.reserveRoutableNumber(paramsNoOptional, attrsWithIds, mockConfigData);

    const postCall = mockPost.mock.calls[0];
    expect(postCall[1].context.callId).toBe('attr-call-id');
    expect(postCall[1].context.transactionId).toBe('attr-tx-id');
  });

  it('should throw error for missing fromNumber', async () => {
    utils.isValidE164.mockReturnValue(false);
    const params = { toNumber: '+15551234567', countryCode: 'US' };

    await expect(
      api.reserveRoutableNumber(params, mockAttributes, mockConfigData)
    ).rejects.toThrow(/Invalid or missing fromNumber/);
  });

  it('should throw error for invalid fromNumber', async () => {
    utils.isValidE164.mockImplementation((num) => num === '+15551234567');
    const params = { fromNumber: 'not-e164', toNumber: '+15551234567', countryCode: 'US' };

    await expect(
      api.reserveRoutableNumber(params, mockAttributes, mockConfigData)
    ).rejects.toThrow(/Invalid or missing fromNumber/);
  });

  it('should throw error for missing toNumber', async () => {
    utils.isValidE164.mockImplementation((num) => num === '+11800999932');
    const params = { fromNumber: '+11800999932', countryCode: 'US' };

    await expect(
      api.reserveRoutableNumber(params, mockAttributes, mockConfigData)
    ).rejects.toThrow(/Invalid or missing toNumber/);
  });

  it('should throw error for missing countryCode when not in params or attributes', async () => {
    const params = { fromNumber: '+11800999932', toNumber: '+15551234567' };

    await expect(
      api.reserveRoutableNumber(params, {}, mockConfigData)
    ).rejects.toThrow('countryCode is required for reserveRoutableNumber');
  });

  it('should handle HTTP error with status and retry-after', async () => {
    utils.generateJWT.mockResolvedValue('test-jwt-token');
    const httpError = new Error('Request failed');
    httpError.response = {
      status: 429,
      headers: { 'retry-after': '30' },
      data: { error: 'rate limited' },
    };
    mockPost.mockRejectedValue(httpError);

    await expect(
      api.reserveRoutableNumber(mockParameters, mockAttributes, mockConfigData)
    ).rejects.toThrow('Error reserving routable number');

    expect(SCVLoggingUtil.error).toHaveBeenCalledWith({
      message: 'Error reserving routable number',
      context: {
        status: 429,
        retryAfter: '30',
        data: { error: 'rate limited' },
        error: 'Request failed',
      },
    });
  });

  it('should attach status and retryAfter to thrown error', async () => {
    utils.generateJWT.mockResolvedValue('test-jwt-token');
    const httpError = new Error('Request failed');
    httpError.response = {
      status: 503,
      headers: { 'retry-after': '60' },
      data: { message: 'Service unavailable' },
    };
    mockPost.mockRejectedValue(httpError);

    try {
      await api.reserveRoutableNumber(mockParameters, mockAttributes, mockConfigData);
    } catch (err) {
      expect(err.status).toBe(503);
      expect(err.retryAfter).toBe('60');
      expect(err.responseData).toEqual({ message: 'Service unavailable' });
    }
  });

  it('should handle null parameters and attributes gracefully', async () => {
    utils.isValidE164.mockReturnValue(false);

    await expect(
      api.reserveRoutableNumber(null, null, mockConfigData)
    ).rejects.toThrow(/Invalid or missing fromNumber/);
  });

  it('should return shaped response with handle fields', async () => {
    const mockResponseData = {
      handle: {
        routableNumber: '+14155560999',
        uid: 'uid-abc',
        expiresAt: '2026-12-31T23:59:59Z',
      },
      mode: 'pool',
    };
    utils.generateJWT.mockResolvedValue('test-jwt-token');
    mockPost.mockResolvedValue({ data: mockResponseData });

    const result = await api.reserveRoutableNumber(mockParameters, mockAttributes, mockConfigData);

    expect(result).toEqual({
      statusCode: 200,
      routableNumber: '+14155560999',
      uid: 'uid-abc',
      expiresAt: '2026-12-31T23:59:59Z',
      mode: 'pool',
    });
  });

  it('should handle empty response data gracefully', async () => {
    utils.generateJWT.mockResolvedValue('test-jwt-token');
    mockPost.mockResolvedValue({ data: {} });

    const result = await api.reserveRoutableNumber(mockParameters, mockAttributes, mockConfigData);

    expect(result).toEqual({
      statusCode: 200,
      routableNumber: undefined,
      uid: undefined,
      expiresAt: undefined,
      mode: undefined,
    });
  });
});
```

### 2b. Run tests — verify failure

```bash
cd invokeTelephonyIntegrationApi && npx jest tests/telephonyIntegrationApi.test.js --no-coverage
```

Expected: `TypeError: api.reserveRoutableNumber is not a function`

### 2c. Implement

Add to `invokeTelephonyIntegrationApi/telephonyIntegrationApi.js` before `module.exports`:

```javascript
async function reserveRoutableNumber(parameters, attributes, configData) {
  const params = parameters || {};
  const attrs = attributes || {};

  const fromNumber = params.fromNumber;
  const toNumber = params.toNumber;

  if (!fromNumber || !utils.isValidE164(fromNumber)) {
    throw new Error(
      `Invalid or missing fromNumber: ${fromNumber}. Must be E.164 format.`
    );
  }

  if (!toNumber || !utils.isValidE164(toNumber)) {
    throw new Error(
      `Invalid or missing toNumber: ${toNumber}. Must be E.164 format.`
    );
  }

  const countryCode = params.countryCode || attrs.countryCode;
  if (!countryCode) {
    throw new Error("countryCode is required for reserveRoutableNumber");
  }

  const callId = params.callId || attrs.callId || null;
  const transactionId = params.transactionId || attrs.transactionId || null;

  const context = {
    scrt2Domain: new URL(configData.scrtEndpointBase).origin,
    toNumber,
  };
  if (callId) context.callId = callId;
  if (transactionId) context.transactionId = transactionId;

  const payload = { countryCode, fromNumber, context };

  SCVLoggingUtil.info({
    message: "reserveRoutableNumber request created",
    context: { countryCode: payload.countryCode, fromNumber: payload.fromNumber },
  });

  const jwt = await utils.generateJWT({
    orgId: configData.orgId,
    callCenterApiName: configData.callCenterApiName,
    expiresIn: configData.tokenValidFor,
    privateKey: configData.privateKey,
  });

  const response = await axiosWrapper.getScrtEndpoint(configData)
    .post("/voiceCalls/reserveRoutableNumber", payload, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
        "Telephony-Provider-Name": vendorFQN,
      },
    })
    .catch((error) => {
      const status = error.response?.status;
      const retryAfter = error.response?.headers?.["retry-after"];
      SCVLoggingUtil.error({
        message: "Error reserving routable number",
        context: {
          status,
          retryAfter,
          data: error.response?.data,
          error: error.message,
        },
      });
      const err = new Error("Error reserving routable number");
      err.status = status;
      err.retryAfter = retryAfter;
      err.responseData = error.response?.data;
      throw err;
    });

  const data = response.data || {};
  const handle = data.handle || {};
  return {
    statusCode: 200,
    routableNumber: handle.routableNumber,
    uid: handle.uid,
    expiresAt: handle.expiresAt,
    mode: data.mode,
  };
}
```

Update `module.exports`:

```javascript
module.exports = {
  createVoiceCall,
  updateVoiceCall,
  executeOmniFlow,
  sendMessage,
  cancelOmniFlowExecution,
  rerouteFlowExecution,
  callbackExecution,
  routeVoiceCall,
  reserveRoutableNumber,
};
```

### 2d. Run tests — verify pass

```bash
cd invokeTelephonyIntegrationApi && npx jest tests/telephonyIntegrationApi.test.js --no-coverage
```

### 2e. Commit

```
feat(telephonyIntegrationApi): add reserveRoutableNumber API function
```

---

## Task 3: Add `reserveRoutableNumber` handler case with tests

### 3a. Write failing tests

Add to `invokeTelephonyIntegrationApi/tests/handler.test.js`, inside the main `describe("handler.js", ...)` block, before the `"secret configuration"` describe:

```javascript
describe("reserveRoutableNumber", () => {
  it("should call reserveRoutableNumber with parameters, attributes, and configData", async () => {
    const event = {
      "detail-type": "test",
      Details: {
        Parameters: {
          methodName: "reserveRoutableNumber",
          fromNumber: "+11800999932",
          toNumber: "+15551234567",
          countryCode: "US",
          callId: "0LQLT000001jmnt",
          transactionId: "tx-123",
        },
        ContactData: {
          ContactId: "test-contact-id",
          Attributes: {
            someAttr: "someValue",
          },
        },
      },
    };
    const mockResponse = {
      statusCode: 200,
      routableNumber: "+14155560999",
      uid: "uid-1",
      expiresAt: "2026-07-09T12:00:00Z",
      mode: "number",
    };
    api.reserveRoutableNumber.mockResolvedValue(mockResponse);

    const result = await handler.handler(event);

    expect(api.reserveRoutableNumber).toHaveBeenCalledWith(
      event.Details.Parameters,
      event.Details.ContactData.Attributes,
      mockSecretConfig
    );
    expect(result).toEqual(mockResponse);
  });

  it("should pass undefined attributes when ContactData has no Attributes", async () => {
    const event = {
      "detail-type": "test",
      Details: {
        Parameters: {
          methodName: "reserveRoutableNumber",
          fromNumber: "+11800999932",
          toNumber: "+15551234567",
          countryCode: "US",
        },
        ContactData: {
          ContactId: "test-contact-id",
        },
      },
    };
    const mockResponse = { statusCode: 200, routableNumber: "+1" };
    api.reserveRoutableNumber.mockResolvedValue(mockResponse);

    const result = await handler.handler(event);

    expect(api.reserveRoutableNumber).toHaveBeenCalledWith(
      event.Details.Parameters,
      undefined,
      mockSecretConfig
    );
    expect(result).toEqual(mockResponse);
  });

  it("should propagate errors from reserveRoutableNumber", async () => {
    const event = {
      "detail-type": "test",
      Details: {
        Parameters: {
          methodName: "reserveRoutableNumber",
          fromNumber: "invalid",
          toNumber: "+15551234567",
          countryCode: "US",
        },
        ContactData: {
          ContactId: "test-contact-id",
        },
      },
    };
    const mockError = new Error("Invalid or missing fromNumber");
    api.reserveRoutableNumber.mockRejectedValue(mockError);

    await expect(handler.handler(event)).rejects.toThrow(
      "Invalid or missing fromNumber"
    );
  });
});
```

### 3b. Run tests — verify failure

```bash
cd invokeTelephonyIntegrationApi && npx jest tests/handler.test.js --no-coverage
```

Expected: `api.reserveRoutableNumber` is not invoked — the `default` case throws `"Unsupported method: reserveRoutableNumber"`.

### 3c. Implement

Add to `invokeTelephonyIntegrationApi/handler.js`, inside the `switch (methodName)` block, before the `default:` case:

```javascript
case "reserveRoutableNumber":
  result = await api.reserveRoutableNumber(
    event.Details.Parameters,
    event.Details.ContactData?.Attributes,
    configData
  );
  break;
```

### 3d. Run tests — verify pass

```bash
cd invokeTelephonyIntegrationApi && npx jest tests/handler.test.js --no-coverage
```

### 3e. Run full test suite to confirm no regressions

```bash
cd invokeTelephonyIntegrationApi && npx jest --collect-coverage
```

All coverage thresholds (90% branches, functions, lines, statements) must pass.

### 3f. Commit

```
feat(handler): add reserveRoutableNumber switch case
```

---

## Task 4: Final integration verification

### 4a. Run the full repo test suite

```bash
npm test
```

### 4b. Verify coverage thresholds pass

The jest config enforces 90% on all metrics. Confirm no threshold regressions.

### 4c. Commit (only if any fixups needed)

```
fix(invokeTelephonyIntegrationApi): address coverage gaps
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `invokeTelephonyIntegrationApi/utils.js` | Add `isValidE164` function + export |
| `invokeTelephonyIntegrationApi/telephonyIntegrationApi.js` | Add `reserveRoutableNumber` function + export |
| `invokeTelephonyIntegrationApi/handler.js` | Add `case "reserveRoutableNumber"` in switch |
| `invokeTelephonyIntegrationApi/tests/utils.test.js` | Add `isValidE164` test suite |
| `invokeTelephonyIntegrationApi/tests/telephonyIntegrationApi.test.js` | Add `reserveRoutableNumber` test suite |
| `invokeTelephonyIntegrationApi/tests/handler.test.js` | Add handler delegation tests |

## Key Design Decisions

1. **E.164 validation via `isValidE164`**: The source repo has this in its `utils.js`; this target repo does not. We add it as a new export rather than inlining the regex, since it's a reusable boundary-validation concern.

2. **Error enrichment pattern**: The HTTP error handler attaches `.status`, `.retryAfter`, and `.responseData` properties to the thrown error. This differs from other operations in this file (which just throw a plain Error) but matches the source's design — it enables callers to handle rate-limiting (429/503 + retry-after header) programmatically.

3. **Parameter/attribute fallback**: `countryCode`, `callId`, `transactionId` can come from either `event.Details.Parameters` or `event.Details.ContactData.Attributes`. This mirrors the source's dual-source pattern for flexibility in Amazon Connect contact flow configuration.

4. **scrt2Domain extraction**: Uses `new URL(configData.scrtEndpointBase).origin` to strip any path component and pass only the origin to the SCRT API context field.
