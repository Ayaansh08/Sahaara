/**
 * server/test/twilio_sos.test.js
 * 
 * Comprehensive automated test suite verifying all required scenarios
 * and regression checks for SAHAARA Twilio WhatsApp SOS integration.
 * Uses mocked Twilio SDK calls — sends ZERO real WhatsApp messages.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Enforce test environment
process.env.NODE_ENV = 'test';

const assert = require('assert');
const http = require('http');

const {
  STATUS,
  STATUS_RANK,
  isAppointmentReminderContentSid,
  sendTwilioWhatsAppMessage,
  sendSosAlertsToGuardians,
  verifyTwilioConnectivity,
  trackMessage,
  getTrackedMessage,
  clearTrackedMessages,
  processStatusCallback,
  validateTwilioWebhookSignature,
  setGlobalTwilioClient,
} = require('../services/twilioService');

const app = require('../index');

// Test runner tracking
let passedCount = 0;
let failedCount = 0;

async function runTest(name, fn) {
  process.stdout.write(`Testing: ${name} ... `);
  try {
    await fn();
    console.log('✅ PASSED');
    passedCount++;
  } catch (err) {
    console.log(`❌ FAILED: ${err.message}`);
    console.error(err);
    failedCount++;
  }
}

// Mock Twilio Client Factory
function createMockTwilioClient(options = {}) {
  const calls = [];
  return {
    calls,
    messages: {
      create: async (params) => {
        calls.push(params);
        if (options.shouldThrow) {
          const err = new Error(options.throwMessage || 'Mock Twilio Error');
          err.code = options.throwCode || 50000;
          throw err;
        }
        if (options.customBehavior) {
          return options.customBehavior(params);
        }
        return {
          sid: options.sid || `SM_mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          status: options.initialStatus || 'queued',
          to: params.to,
          from: params.from,
        };
      },
    },
    api: {
      accounts: () => ({
        fetch: async () => ({
          status: 'active',
          friendlyName: 'Mock Account',
        }),
      }),
    },
  };
}

// Helper to make local HTTP requests to Express app without external port
function makeRequest(appInstance, { method, path: reqPath, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(appInstance);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const payload = body
        ? (typeof body === 'string' ? body : JSON.stringify(body))
        : null;

      const reqHeaders = { ...headers };
      if (payload && !reqHeaders['Content-Type'] && !reqHeaders['content-type']) {
        reqHeaders['Content-Type'] = 'application/json';
      }
      if (payload) {
        reqHeaders['Content-Length'] = Buffer.byteLength(payload);
      }

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: reqPath,
          method,
          headers: reqHeaders,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            server.close();
            let parsed = null;
            try {
              parsed = JSON.parse(data);
            } catch (_) {
              parsed = data;
            }
            resolve({ status: res.statusCode, headers: res.headers, body: parsed });
          });
        }
      );

      req.on('error', (err) => {
        server.close();
        reject(err);
      });

      if (payload) req.write(payload);
      req.end();
    });
  });
}

async function runAllTests() {
  console.log('================================================================');
  console.log('🧪 SAHAARA Twilio WhatsApp SOS: Automated Verification & Regression Suite');
  console.log('================================================================\n');

  // Test 1: One guardian receives an API submission in production mode
  await runTest('1. One guardian receives an API submission (production mode)', async () => {
    const mockClient = createMockTwilioClient({ sid: 'SM_test_single', initialStatus: 'queued' });
    const res = await sendTwilioWhatsAppMessage({
      toPhone: '9876543210',
      guardianName: 'Aarav',
      contentSid: 'HX_valid_sos_template_123',
      client: mockClient,
      configOverrides: {
        accountSid: 'AC_mock',
        apiKey: 'SK_mock',
        apiSecret: 'secret_mock',
        authToken: 'token_mock',
        from: 'whatsapp:+17372508034',
        mode: 'production',
      },
    });

    assert.strictEqual(res.accepted, true, 'Message should be accepted');
    assert.strictEqual(res.status, STATUS.QUEUED, 'Status should be QUEUED');
    assert.strictEqual(res.messageSid, 'SM_test_single');
    assert.strictEqual(mockClient.calls.length, 1);
    assert.strictEqual(mockClient.calls[0].to, 'whatsapp:+919876543210');
    assert.strictEqual(mockClient.calls[0].contentSid, 'HX_valid_sos_template_123');
  });

  // Test 2: Multiple guardians are processed in production mode
  await runTest('2. Multiple guardians are processed (production mode)', async () => {
    let callIdx = 0;
    const mockClient = createMockTwilioClient({
      customBehavior: (params) => ({
        sid: `SM_multi_${++callIdx}`,
        status: 'queued',
        to: params.to,
      }),
    });

    const sleepDelays = [];
    const res = await sendSosAlertsToGuardians({
      guardians: [
        { name: 'Guardian 1', phone: '9876543210' },
        { name: 'Guardian 2', phone: '9876543211' },
        { name: 'Guardian 3', phone: '9876543212' },
      ],
      contentSid: 'HX_valid_sos_template_123',
      client: mockClient,
      sleepFn: (ms) => sleepDelays.push(ms),
      configOverrides: {
        accountSid: 'AC_mock',
        apiKey: 'SK_mock',
        apiSecret: 'secret_mock',
        authToken: 'token_mock',
        from: 'whatsapp:+17372508034',
        mode: 'production',
      },
    });

    assert.strictEqual(res.acceptedCount, 3);
    assert.strictEqual(res.totalContacts, 3);
    assert.strictEqual(res.overallStatus, 'ACCEPTED_ALL');
    assert.strictEqual(mockClient.calls.length, 3);
    assert.strictEqual(res.results.length, 3);
  });

  // Test 3: Sandbox mode blocks actual SOS dispatch upfront
  await runTest('3. Sandbox mode blocks actual SOS dispatch upfront', async () => {
    const mockClient = createMockTwilioClient();
    const res = await sendSosAlertsToGuardians({
      guardians: [
        { name: 'G1', phone: '9876543210' },
        { name: 'G2', phone: '9876543211' },
      ],
      contentSid: 'HX_valid_sos_template_123',
      client: mockClient,
      configOverrides: {
        accountSid: 'AC_mock',
        apiKey: 'SK_mock',
        apiSecret: 'secret_mock',
        authToken: 'token_mock',
        from: 'whatsapp:+17372508034',
        mode: 'sandbox',
      },
    });

    assert.strictEqual(res.ok, false, 'Must not report ok in Sandbox mode');
    assert.strictEqual(res.overallStatus, 'FAILED');
    assert.strictEqual(res.code, 'SANDBOX_MODE_RESTRICTION');
    assert.strictEqual(res.acceptedCount, 0, 'No guardian should be accepted in Sandbox mode');
    assert.strictEqual(mockClient.calls.length, 0, 'Zero Twilio messages should be sent');
    assert.ok(res.error.includes('Sandbox'));
  });

  // Test 4: An unjoined Sandbox recipient produces a clear failure in production/trial
  await runTest('4. An unjoined Sandbox recipient produces a clear failure', async () => {
    const mockClient = createMockTwilioClient({
      shouldThrow: true,
      throwCode: 63015,
      throwMessage: 'Channel could not find a To address for whatsapp:+919876543210',
    });

    const res = await sendTwilioWhatsAppMessage({
      toPhone: '9876543210',
      contentSid: 'HX_valid_sos_template_123',
      client: mockClient,
      configOverrides: {
        accountSid: 'AC_mock',
        apiKey: 'SK_mock',
        apiSecret: 'secret_mock',
        authToken: 'token_mock',
        from: 'whatsapp:+17372508034',
        mode: 'production',
      },
    });

    assert.strictEqual(res.accepted, false);
    assert.strictEqual(res.status, STATUS.FAILED);
    assert.strictEqual(res.code, 63015);
    assert.ok(
      res.error.includes('has not joined the Twilio WhatsApp Sandbox'),
      'Error message must clearly identify Sandbox join requirement'
    );
  });

  // Test 5: One recipient failure does not stop other recipients in production mode
  await runTest('5. One recipient failure does not stop other recipients', async () => {
    let callCount = 0;
    const mockClient = createMockTwilioClient({
      customBehavior: (params) => {
        callCount++;
        if (callCount === 1) {
          const err = new Error('Sandbox error');
          err.code = 63015;
          throw err;
        }
        return { sid: 'SM_second_success', status: 'queued', to: params.to };
      },
    });

    const res = await sendSosAlertsToGuardians({
      guardians: [
        { name: 'Unjoined Guardian', phone: '9876543210' },
        { name: 'Joined Guardian', phone: '9876543211' },
      ],
      contentSid: 'HX_valid_sos_template_123',
      client: mockClient,
      sleepFn: () => {},
      configOverrides: {
        accountSid: 'AC_mock',
        apiKey: 'SK_mock',
        apiSecret: 'secret_mock',
        authToken: 'token_mock',
        from: 'whatsapp:+17372508034',
        mode: 'production',
      },
    });

    assert.strictEqual(res.results.length, 2, 'Both guardians must be attempted');
    assert.strictEqual(res.results[0].accepted, false);
    assert.strictEqual(res.results[0].code, 63015);
    assert.strictEqual(res.results[1].accepted, true);
    assert.strictEqual(res.results[1].messageSid, 'SM_second_success');
    assert.strictEqual(res.overallStatus, 'PARTIALLY_ACCEPTED');
  });

  // Test 6: Invalid phone numbers are rejected
  await runTest('6. Invalid phone numbers are rejected', async () => {
    const mockClient = createMockTwilioClient();
    const res = await sendTwilioWhatsAppMessage({
      toPhone: '123', // too short
      contentSid: 'HX_valid_sos_template_123',
      client: mockClient,
      configOverrides: {
        accountSid: 'AC_mock',
        apiKey: 'SK_mock',
        apiSecret: 'secret_mock',
        authToken: 'token_mock',
        from: 'whatsapp:+17372508034',
        mode: 'production',
      },
    });

    assert.strictEqual(res.accepted, false);
    assert.strictEqual(res.code, 'INVALID_PHONE_NUMBER');
    assert.strictEqual(mockClient.calls.length, 0, 'No Twilio API call should be made');
  });

  // Test 7: Missing configuration is handled safely
  await runTest('7. Missing configuration is handled safely', async () => {
    const res = await sendTwilioWhatsAppMessage({
      toPhone: '9876543210',
      contentSid: 'HX_valid_sos_template_123',
      configOverrides: {
        accountSid: '', // explicitly missing
        apiKey: '',
      },
    });

    assert.strictEqual(res.accepted, false);
    assert.strictEqual(res.code, 'CONFIG_MISSING');
  });

  // Test 8: Content SID is supplied correctly in production mode
  await runTest('8. Content SID is supplied correctly in production mode', async () => {
    const mockClient = createMockTwilioClient();
    await sendTwilioWhatsAppMessage({
      toPhone: '9876543210',
      contentSid: 'HX_production_sos_alert_template_abc',
      client: mockClient,
      configOverrides: {
        accountSid: 'AC_mock',
        apiKey: 'SK_mock',
        apiSecret: 'secret_mock',
        authToken: 'token_mock',
        from: 'whatsapp:+17372508034',
        mode: 'production',
      },
    });

    assert.strictEqual(mockClient.calls.length, 1);
    assert.strictEqual(mockClient.calls[0].contentSid, 'HX_production_sos_alert_template_abc');
  });

  // Test 9: ContentVariables are supplied only when the configured template requires them
  await runTest('9. ContentVariables supplied only when template requires them', async () => {
    const mockClient1 = createMockTwilioClient();
    // Case A: No variables passed (static template)
    await sendTwilioWhatsAppMessage({
      toPhone: '9876543210',
      contentSid: 'HX_static_template',
      contentVariables: null,
      client: mockClient1,
      configOverrides: {
        accountSid: 'AC_mock',
        apiKey: 'SK_mock',
        apiSecret: 'secret_mock',
        authToken: 'token_mock',
        from: 'whatsapp:+17372508034',
        mode: 'production',
      },
    });
    assert.strictEqual(mockClient1.calls[0].contentVariables, undefined, 'Must not supply contentVariables for static template');

    // Case B: Variables provided
    const mockClient2 = createMockTwilioClient();
    await sendTwilioWhatsAppMessage({
      toPhone: '9876543210',
      contentSid: 'HX_dynamic_template',
      contentVariables: { 1: 'Sita Ram', 2: 'Fall Alert' },
      client: mockClient2,
      configOverrides: {
        accountSid: 'AC_mock',
        apiKey: 'SK_mock',
        apiSecret: 'secret_mock',
        authToken: 'token_mock',
        from: 'whatsapp:+17372508034',
        mode: 'production',
      },
    });
    assert.strictEqual(
      mockClient2.calls[0].contentVariables,
      JSON.stringify({ 1: 'Sita Ram', 2: 'Fall Alert' }),
      'Must supply serialized contentVariables when provided'
    );
  });

  // Test 10: Twilio API errors are recorded
  await runTest('10. Twilio API errors are recorded', async () => {
    const mockClient = createMockTwilioClient({
      shouldThrow: true,
      throwCode: 21608,
      throwMessage: 'The number is unverified for trial account',
    });

    const res = await sendTwilioWhatsAppMessage({
      toPhone: '9876543210',
      contentSid: 'HX_valid_sos_template_123',
      client: mockClient,
      configOverrides: {
        accountSid: 'AC_mock',
        apiKey: 'SK_mock',
        apiSecret: 'secret_mock',
        authToken: 'token_mock',
        from: 'whatsapp:+17372508034',
        mode: 'production',
      },
    });

    assert.strictEqual(res.accepted, false);
    assert.strictEqual(res.code, 21608);
    assert.strictEqual(res.error, 'The number is unverified for trial account');
  });

  // Test 11: API acceptance is not marked as delivery
  await runTest('11. API acceptance is not marked as delivery', async () => {
    const mockClient = createMockTwilioClient({
      initialStatus: 'delivered', // even if Twilio API somehow returns delivered immediately
    });

    const res = await sendTwilioWhatsAppMessage({
      toPhone: '9876543210',
      contentSid: 'HX_valid_sos_template_123',
      client: mockClient,
      configOverrides: {
        accountSid: 'AC_mock',
        apiKey: 'SK_mock',
        apiSecret: 'secret_mock',
        authToken: 'token_mock',
        from: 'whatsapp:+17372508034',
        mode: 'production',
      },
    });

    assert.notStrictEqual(res.status, STATUS.DELIVERED, 'Must NEVER report initial API creation as DELIVERED');
    assert.strictEqual(res.status, STATUS.SENT);
  });

  // Test 12: Valid webhook events update the correct recipient
  await runTest('12. Valid webhook events update the correct recipient', async () => {
    clearTrackedMessages();
    const testSid = 'SM_webhook_update_test';
    trackMessage({
      messageSid: testSid,
      alertId: 'alert-123',
      phone: '9876543210',
      initialStatus: STATUS.QUEUED,
    });

    // 1. Delivery event
    const res1 = await processStatusCallback({
      messageSid: testSid,
      messageStatus: 'delivered',
    });
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.newStatus, STATUS.DELIVERED);
    assert.strictEqual(getTrackedMessage(testSid).status, STATUS.DELIVERED);

    // 2. Read event (via eventType === 'READ' or messageStatus === 'read')
    const res2 = await processStatusCallback({
      messageSid: testSid,
      messageStatus: 'read',
      eventType: 'READ',
    });
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.newStatus, STATUS.READ);
    assert.strictEqual(getTrackedMessage(testSid).status, STATUS.READ);
  });

  // Test 13: Invalid webhook signatures are rejected
  await runTest('13. Invalid webhook signatures are rejected', async () => {
    const res = await makeRequest(app, {
      method: 'POST',
      path: '/api/twilio/status-callback',
      headers: {
        'x-twilio-signature': 'invalid_forged_signature_123',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'MessageSid=SM_test&MessageStatus=delivered',
    });

    assert.strictEqual(res.status, 403, 'Must return 403 Forbidden on invalid signature');
  });

  // Test 14: Duplicate callbacks are handled safely & out-of-order ignored
  await runTest('14. Duplicate callbacks handled safely & out-of-order ignored', async () => {
    clearTrackedMessages();
    const testSid = 'SM_duplicate_test';
    trackMessage({ messageSid: testSid, initialStatus: STATUS.SENT });

    // Step 1: Delivered
    await processStatusCallback({ messageSid: testSid, messageStatus: 'delivered' });
    assert.strictEqual(getTrackedMessage(testSid).status, STATUS.DELIVERED);

    // Step 2: Duplicate Delivered event
    const dupRes = await processStatusCallback({ messageSid: testSid, messageStatus: 'delivered' });
    assert.strictEqual(dupRes.duplicate, true, 'Should recognize duplicate event');
    assert.strictEqual(getTrackedMessage(testSid).status, STATUS.DELIVERED);

    // Step 3: Out-of-order older event (SENT arrives after DELIVERED)
    const oldRes = await processStatusCallback({ messageSid: testSid, messageStatus: 'sent' });
    assert.strictEqual(oldRes.ignored, true, 'Should ignore older status');
    assert.strictEqual(getTrackedMessage(testSid).status, STATUS.DELIVERED, 'Must not regress from DELIVERED to SENT');
  });

  // Test 15: Unauthorized SOS requests are rejected
  await runTest('15. Unauthorized SOS requests are rejected', async () => {
    // Request without Authorization header
    const res1 = await makeRequest(app, {
      method: 'POST',
      path: '/api/sos',
      body: { reason: 'manual' },
    });
    assert.strictEqual(res1.status, 401, 'Request without token must return 401');

    // Request with invalid token
    const res2 = await makeRequest(app, {
      method: 'POST',
      path: '/api/sos',
      headers: { Authorization: 'Bearer totally_invalid_token' },
      body: { reason: 'manual' },
    });
    assert.strictEqual(res2.status, 401, 'Request with invalid token must return 401');
  });

  // Setup Global Mock Client for HTTP endpoints
  const httpGlobalMockClient = createMockTwilioClient({
    customBehavior: (params) => ({
      sid: `SM_http_mock_${Date.now()}`,
      status: 'queued',
      to: params.to,
    }),
  });
  setGlobalTwilioClient(httpGlobalMockClient);

  // Test 16: Location retrieval failure does not prevent SOS creation
  await runTest('16. Location retrieval failure does not prevent SOS record creation in Sandbox', async () => {
    const res = await makeRequest(app, {
      method: 'POST',
      path: '/api/sos',
      headers: {
        Authorization: 'Bearer mock-token-user-location-test',
        'x-test-auth-mock': 'true',
      },
      body: {
        reason: 'manual',
        location: null, // location failed!
        contentSid: 'HX_approved_sos_test',
        _testMockContacts: [{ name: 'Son', phone: '9876543210', relation: 'Son' }],
      },
    });

    // In sandbox mode: returns 400 with SANDBOX_MODE_RESTRICTION, but location is stored as null and alertId is generated
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.code, 'SANDBOX_MODE_RESTRICTION');
    assert.strictEqual(res.body.location, null);
    assert.ok(res.body.alertId, 'Alert ID must be generated to record incident');
  });

  // Test 17: Duplicate SOS requests are blocked by rate limiter
  await runTest('17. Duplicate SOS requests are blocked by rate limiter', async () => {
    const headers = {
      Authorization: 'Bearer mock-token-rate-limit-user',
      'x-test-auth-mock': 'true',
    };

    // First request
    const res1 = await makeRequest(app, {
      method: 'POST',
      path: '/api/sos',
      headers,
      body: {
        reason: 'manual',
        contentSid: 'HX_approved_sos_test',
        _testMockContacts: [{ name: 'Son', phone: '9876543210' }],
      },
    });
    assert.strictEqual(res1.status, 400); // 400 due to sandbox restriction

    // Immediate second request (within 15s cooldown)
    const res2 = await makeRequest(app, {
      method: 'POST',
      path: '/api/sos',
      headers,
      body: {
        reason: 'manual',
        contentSid: 'HX_approved_sos_test',
        _testMockContacts: [{ name: 'Son', phone: '9876543210' }],
      },
    });

    assert.strictEqual(res2.status, 429, 'Immediate second SOS must return 429 Rate Limit Exceeded');
    assert.ok(res2.body.error.includes('Rate limit exceeded'));
  });

  // Test 18: 🚨 Never use Appointment Reminder Content SID for SAHAARA SOS
  await runTest('18. CRITICAL: Appointment Reminder Content SID is strictly blocked', async () => {
    const res = await sendTwilioWhatsAppMessage({
      toPhone: '9876543210',
      contentSid: 'HXfe5ab5f00277942d4d4200328b4d403c', // Twilio Appointment Reminder SID
      configOverrides: {
        accountSid: 'AC_mock',
        apiKey: 'SK_mock',
        apiSecret: 'secret_mock',
        authToken: 'token_mock',
        from: 'whatsapp:+17372508034',
        mode: 'production',
      },
    });

    assert.strictEqual(res.accepted, false);
    assert.strictEqual(res.code, 'APPOINTMENT_REMINDER_BLOCKED');
    assert.ok(
      res.error.includes('Appointment Reminder template'),
      'Must explain that appointment reminder template cannot represent SOS'
    );
  });

  // Test 19: REGRESSION - Arbitrary Content SID cannot bypass Sandbox restriction
  await runTest('19. REGRESSION: Arbitrary Content SID cannot bypass Sandbox restriction', async () => {
    const mockClient = createMockTwilioClient();
    const res = await sendTwilioWhatsAppMessage({
      toPhone: '9876543210',
      contentSid: 'HX_arbitrary_custom_template_bypass_attempt',
      client: mockClient,
      configOverrides: {
        accountSid: 'AC_mock',
        apiKey: 'SK_mock',
        apiSecret: 'secret_mock',
        authToken: 'token_mock',
        from: 'whatsapp:+17372508034',
        mode: 'sandbox', // Sandbox mode active!
      },
    });

    assert.strictEqual(res.accepted, false);
    assert.strictEqual(res.code, 'SANDBOX_MODE_RESTRICTION');
    assert.strictEqual(mockClient.calls.length, 0, 'No outbound message should be dispatched');
    assert.ok(res.error.includes('Sandbox mode'));
  });

  // Test 20: REGRESSION - Dedicated Connectivity Testing verifies Twilio without dispatching SOS
  await runTest('20. REGRESSION: Connectivity test verifies credentials without dispatching SOS', async () => {
    const mockClient = createMockTwilioClient();
    const res = await verifyTwilioConnectivity({
      client: mockClient,
      configOverrides: {
        accountSid: 'AC_mock',
        apiKey: 'SK_mock',
        apiSecret: 'secret_mock',
        authToken: 'token_mock',
        from: 'whatsapp:+17372508034',
        mode: 'sandbox',
      },
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.twilioApiConnected, true, 'Twilio API must be connected');
    assert.strictEqual(res.sosDispatched, false, 'Must NOT dispatch actual SOS');
    assert.strictEqual(res.deliveryConfirmed, false, 'Must NOT claim delivery confirmed');
    assert.strictEqual(mockClient.calls.length, 0, 'Must NOT send any WhatsApp message');
  });

  // Test 21: REGRESSION - HTTP /api/twilio/test-connectivity endpoint
  await runTest('21. REGRESSION: HTTP /api/twilio/test-connectivity requires auth and returns status', async () => {
    // Unauthenticated
    const resUnauth = await makeRequest(app, {
      method: 'POST',
      path: '/api/twilio/test-connectivity',
    });
    assert.strictEqual(resUnauth.status, 401);

    // Authenticated
    const resAuth = await makeRequest(app, {
      method: 'POST',
      path: '/api/twilio/test-connectivity',
      headers: {
        Authorization: 'Bearer mock-token-test-user',
        'x-test-auth-mock': 'true',
      },
    });

    assert.strictEqual(resAuth.status, 200);
    assert.strictEqual(resAuth.body.twilioApiConnected, true);
    assert.strictEqual(resAuth.body.sosDispatched, false);
    assert.strictEqual(resAuth.body.deliveryConfirmed, false);
  });

  console.log('\n================================================================');
  console.log(`Results: ${passedCount} passed, ${failedCount} failed.`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
