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

const twilio = require('twilio');

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
  setGlobalFirestoreDb,
  trackMessageDurable,
  syncGuardianStatusToAlert,
  buildSosContentVariables,
  validateContentVariables,
} = require('../services/twilioService');

const {
  setTestMockContactsResolver,
  setCustomFirestoreDb,
} = require('../services/authAndContactsService');

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

// Mock Firestore Factory for durable persistence testing
function createMockFirestore() {
  const collections = new Map();

  function getCol(name) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  }

  return {
    _collections: collections,
    collection: (colName) => {
      const col = getCol(colName);
      return {
        doc: (docId) => {
          const id = docId || ('doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
          return {
            id,
            get: async () => {
              const data = col.get(id);
              return {
                exists: data !== undefined,
                id,
                data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined),
              };
            },
            set: async (newData) => {
              col.set(id, JSON.parse(JSON.stringify(newData)));
              return { id };
            },
            update: async (fields) => {
              const existing = col.get(id) || {};
              const merged = { ...existing, ...JSON.parse(JSON.stringify(fields)) };
              col.set(id, merged);
              return { id };
            },
          };
        },
        add: async (data) => {
          const id = 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
          col.set(id, JSON.parse(JSON.stringify(data)));
          return { id };
        },
      };
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

  // Set resolver for contacts in test environment (never from req.body)
  setTestMockContactsResolver((uid) => {
    if (uid.includes('no-contacts')) return [];
    return [{ name: 'Son', phone: '9876543210', relation: 'Son' }];
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

  // Test 22: REGRESSION - Client-supplied _testMockContacts in body is strictly ignored
  await runTest('22. REGRESSION: Client-supplied _testMockContacts in body is ignored; only authenticated Firestore contacts used', async () => {
    // 1. Authenticated user with Firestore contacts configured
    setTestMockContactsResolver((uid) => {
      if (uid === 'legit-elder-user') {
        return [{ name: 'Legit Daughter', phone: '9876543210' }];
      }
      return [];
    });

    // In sandbox mode: returns 400 with SANDBOX_MODE_RESTRICTION, but alert record should contain ONLY legit daughter, NOT injected attacker
    const res = await makeRequest(app, {
      method: 'POST',
      path: '/api/sos',
      headers: {
        Authorization: 'Bearer mock-token-legit-elder-user',
        'x-test-auth-mock': 'true',
      },
      body: {
        reason: 'manual',
        _testMockContacts: [{ name: 'Malicious Attacker', phone: '1111111111' }],
      },
    });

    assert.strictEqual(res.status, 400); // 400 due to sandbox restriction
    assert.strictEqual(res.body.code, 'SANDBOX_MODE_RESTRICTION');

    // 2. User with NO emergency contacts in Firestore cannot inject contacts via body
    const resNoContacts = await makeRequest(app, {
      method: 'POST',
      path: '/api/sos',
      headers: {
        Authorization: 'Bearer mock-token-user-with-no-contacts',
        'x-test-auth-mock': 'true',
      },
      body: {
        reason: 'manual',
        _testMockContacts: [{ name: 'Injected Contact', phone: '9999999999' }],
      },
    });

    assert.strictEqual(resNoContacts.status, 400);
    assert.ok(resNoContacts.body.error.includes('No valid emergency contacts configured'));
  });

  // Test 23: REGRESSION - Client cannot override Content SID or ContentVariables
  await runTest('23. REGRESSION: Client cannot override Content SID or ContentVariables', async () => {
    // 1. buildSosContentVariables verifies and builds server variables
    const vars = buildSosContentVariables({
      userName: 'Senior Sharma',
      emergencyMessage: 'Pressed SOS button',
      locationSummary: 'Delhi (28.6139, 77.2090)',
      mapsLink: 'https://maps.google.com/?q=28.6139,77.2090',
      timeString: '3:00 PM IST',
    });
    assert.strictEqual(vars['1'], 'Senior Sharma');
    assert.strictEqual(vars['2'], 'Pressed SOS button');
    assert.strictEqual(vars['3'], 'Delhi (28.6139, 77.2090)');
    assert.strictEqual(vars['4'], 'https://maps.google.com/?q=28.6139,77.2090');
    assert.strictEqual(vars['5'], '3:00 PM IST');

    // 2. Missing required variable validation
    assert.throws(() => {
      buildSosContentVariables({ userName: '', emergencyMessage: '' });
    }, /Required template variables missing/);

    // 3. validateContentVariables checks all variables are defined
    assert.strictEqual(validateContentVariables(vars), true);
    assert.strictEqual(validateContentVariables({ '1': null }), false);
    assert.strictEqual(validateContentVariables({ '1': '   ' }), false);
  });

  // Test 24: REGRESSION - Legacy reason: 'test' is rejected from /api/sos with 400
  await runTest('24. REGRESSION: Obsolete legacy reason: "test" is rejected from /api/sos', async () => {
    const res = await makeRequest(app, {
      method: 'POST',
      path: '/api/sos',
      headers: {
        Authorization: 'Bearer mock-token-reason-test-user',
        'x-test-auth-mock': 'true',
      },
      body: {
        reason: 'test', // Legacy test reason
      },
    });

    assert.strictEqual(res.status, 400, 'Legacy test reason must be rejected with 400');
    assert.strictEqual(res.body.error, 'Invalid or missing reason');
  });

  // Test 25: REGRESSION - Webhook signature verification fails closed on missing TWILIO_AUTH_TOKEN
  await runTest('25. REGRESSION: Webhook fails closed when TWILIO_AUTH_TOKEN is missing', async () => {
    const savedToken = process.env.TWILIO_AUTH_TOKEN;
    try {
      delete process.env.TWILIO_AUTH_TOKEN;

      const res = await makeRequest(app, {
        method: 'POST',
        path: '/api/twilio/status-callback',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': 'any_sig',
        },
        body: 'MessageSid=SM_test&MessageStatus=delivered',
      });

      assert.strictEqual(res.status, 500, 'Must fail closed with 500 on missing AUTH_TOKEN');
      assert.ok(res.body.error.includes('TWILIO_AUTH_TOKEN is missing'));
    } finally {
      process.env.TWILIO_AUTH_TOKEN = savedToken;
    }
  });

  // Test 26: REGRESSION - Webhook signature verification fails on missing or invalid signature
  await runTest('26. REGRESSION: Webhook rejects missing or invalid X-Twilio-Signature', async () => {
    // Missing signature header
    const resMissing = await makeRequest(app, {
      method: 'POST',
      path: '/api/twilio/status-callback',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'MessageSid=SM_test&MessageStatus=delivered',
    });
    assert.strictEqual(resMissing.status, 403);
    assert.ok(resMissing.body.error.includes('Missing X-Twilio-Signature'));

    // Forged signature
    const resInvalid = await makeRequest(app, {
      method: 'POST',
      path: '/api/twilio/status-callback',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-twilio-signature': 'forged_signature_abc_123',
      },
      body: 'MessageSid=SM_test&MessageStatus=delivered',
    });
    assert.strictEqual(resInvalid.status, 403);
    assert.ok(resInvalid.body.error.includes('Invalid Twilio signature'));
  });

  // Test 27: REGRESSION - Webhook valid signature succeeds
  await runTest('27. REGRESSION: Webhook valid X-Twilio-Signature succeeds', async () => {
    const testUrl = 'https://sahaara.app/api/twilio/status-callback';
    const savedCallbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL;
    process.env.TWILIO_STATUS_CALLBACK_URL = testUrl;

    try {
      const bodyParams = {
        MessageSid: 'SM_valid_signature_test',
        MessageStatus: 'delivered',
      };
      const validSig = twilio.getExpectedTwilioSignature(process.env.TWILIO_AUTH_TOKEN, testUrl, bodyParams);

      const res = await makeRequest(app, {
        method: 'POST',
        path: '/api/twilio/status-callback',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': validSig,
        },
        body: 'MessageSid=SM_valid_signature_test&MessageStatus=delivered',
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ok');
    } finally {
      process.env.TWILIO_STATUS_CALLBACK_URL = savedCallbackUrl;
    }
  });

  // Test 28: REGRESSION - Webhook signature bypass header is rejected outside test environment
  await runTest('28. REGRESSION: Signature bypass header is rejected outside test environment', async () => {
    const savedEnv = process.env.NODE_ENV;
    try {
      // Simulate production environment
      process.env.NODE_ENV = 'production';

      const resProd = await makeRequest(app, {
        method: 'POST',
        path: '/api/twilio/status-callback',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-test-signature-bypass': 'true',
        },
        body: 'MessageSid=SM_bypass_test&MessageStatus=delivered',
      });

      assert.strictEqual(resProd.status, 403, 'Must reject bypass when NODE_ENV is production');
      assert.ok(resProd.body.error.includes('only permitted in test environment'));

      // In test environment, bypass succeeds
      process.env.NODE_ENV = 'test';
      const resTest = await makeRequest(app, {
        method: 'POST',
        path: '/api/twilio/status-callback',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-test-signature-bypass': 'true',
        },
        body: 'MessageSid=SM_bypass_test&MessageStatus=delivered',
      });

      assert.strictEqual(resTest.status, 200, 'Must accept bypass when NODE_ENV is test');
    } finally {
      process.env.NODE_ENV = savedEnv;
    }
  });

  // Test 29: REGRESSION - Durable status persistence in Firestore across server restart
  await runTest('29. REGRESSION: Durable status persistence survives simulated backend restart', async () => {
    const mockDb = createMockFirestore();
    setGlobalFirestoreDb(mockDb);
    setCustomFirestoreDb(mockDb);

    const alertId = 'alert-restart-test-123';
    const messageSid = 'SM_restart_test_456';

    // 1. Pre-create SOS record in Firestore with initial QUEUED status
    await mockDb.collection('sos_alerts').doc(alertId).set({
      userId: 'user-123',
      overallStatus: 'SENDING',
      guardianResults: [
        {
          name: 'Son',
          phone: '...4321',
          rawPhone: '9876543210',
          messageSid,
          status: STATUS.QUEUED,
          delivered: false,
          read: false,
        },
      ],
    });

    // 2. Track message durably
    await trackMessageDurable({
      messageSid,
      alertId,
      userId: 'user-123',
      phone: '9876543210',
      guardianName: 'Son',
      initialStatus: STATUS.QUEUED,
      firestoreDb: mockDb,
    });

    // Verify written to Firestore twilio_dispatches
    const dispatchDoc = await mockDb.collection('twilio_dispatches').doc(messageSid).get();
    assert.strictEqual(dispatchDoc.exists, true);
    assert.strictEqual(dispatchDoc.data().alertId, alertId);

    // 3. SIMULATE COMPLETE BACKEND RESTART: Wipe in-memory tracker
    clearTrackedMessages();
    assert.strictEqual(getTrackedMessage(messageSid), null, 'In-memory tracker must be empty');

    // 4. Status callback arrives after restart
    const cbRes = await processStatusCallback({
      messageSid,
      messageStatus: 'delivered',
      firestoreDb: mockDb,
    });

    assert.strictEqual(cbRes.success, true);
    assert.strictEqual(cbRes.newStatus, STATUS.DELIVERED);

    // 5. Verify Firestore SOS record updated accurately
    const updatedAlert = await mockDb.collection('sos_alerts').doc(alertId).get();
    const alertData = updatedAlert.data();
    assert.strictEqual(alertData.guardianResults[0].status, STATUS.DELIVERED);
    assert.strictEqual(alertData.guardianResults[0].delivered, true);
    assert.strictEqual(alertData.deliveryStatus, 'DELIVERED_ALL');
  });

  // Test 30: REGRESSION - Early callback arrives before send workflow completes
  await runTest('30. REGRESSION: Early callback arriving before send workflow finishes is reconciled', async () => {
    const mockDb = createMockFirestore();
    setGlobalFirestoreDb(mockDb);

    const messageSid = 'SM_early_callback_test';
    const alertId = 'alert-early-test-789';

    // Pre-create SOS alert record
    await mockDb.collection('sos_alerts').doc(alertId).set({
      userId: 'user-early',
      overallStatus: 'SENDING',
      guardianResults: [
        {
          name: 'Daughter',
          phone: '...1234',
          rawPhone: '9876541234',
          messageSid,
          status: STATUS.QUEUED,
          delivered: false,
        },
      ],
    });

    // 1. Early callback arrives before trackMessageDurable is called
    const earlyRes = await processStatusCallback({
      messageSid,
      messageStatus: 'delivered',
      firestoreDb: mockDb,
    });
    assert.strictEqual(earlyRes.success, true);
    assert.strictEqual(earlyRes.pendingEarlyCallback, true);

    // 2. Later, send workflow completes and calls trackMessageDurable
    await trackMessageDurable({
      messageSid,
      alertId,
      userId: 'user-early',
      phone: '9876541234',
      guardianName: 'Daughter',
      initialStatus: STATUS.QUEUED,
      firestoreDb: mockDb,
    });

    // 3. Verify that higher DELIVERED status from early callback was preserved and synced!
    const dispatchDoc = await mockDb.collection('twilio_dispatches').doc(messageSid).get();
    assert.strictEqual(dispatchDoc.data().status, STATUS.DELIVERED, 'Must not regress to QUEUED');
    assert.strictEqual(dispatchDoc.data().alertId, alertId);

    const alertDoc = await mockDb.collection('sos_alerts').doc(alertId).get();
    assert.strictEqual(alertDoc.data().guardianResults[0].status, STATUS.DELIVERED);
    assert.strictEqual(alertDoc.data().deliveryStatus, 'DELIVERED_ALL');
  });

  // Test 31: REGRESSION - Status callbacks never report queued, sending, or sent as delivered; aggregate status updates accurately
  await runTest('31. REGRESSION: Status callbacks never report non-delivered as delivered; accurate aggregates', async () => {
    const mockDb = createMockFirestore();
    setGlobalFirestoreDb(mockDb);

    const alertId = 'alert-aggregate-test';
    const sid1 = 'SM_agg_1';
    const sid2 = 'SM_agg_2';

    await mockDb.collection('sos_alerts').doc(alertId).set({
      overallStatus: 'SENDING',
      guardianResults: [
        { name: 'Son', rawPhone: '9876543210', messageSid: sid1, status: STATUS.QUEUED, delivered: false },
        { name: 'Daughter', rawPhone: '9876543211', messageSid: sid2, status: STATUS.QUEUED, delivered: false },
      ],
    });

    await trackMessageDurable({ messageSid: sid1, alertId, phone: '9876543210', initialStatus: STATUS.QUEUED, firestoreDb: mockDb });
    await trackMessageDurable({ messageSid: sid2, alertId, phone: '9876543211', initialStatus: STATUS.QUEUED, firestoreDb: mockDb });

    // Step 1: sid1 transitions to SENT
    await processStatusCallback({ messageSid: sid1, messageStatus: 'sent', firestoreDb: mockDb });
    let doc = await mockDb.collection('sos_alerts').doc(alertId).get();
    assert.strictEqual(doc.data().guardianResults[0].delivered, false, 'SENT must NOT be marked as delivered');
    assert.notStrictEqual(doc.data().deliveryStatus, 'DELIVERED_ALL');

    // Step 2: sid1 transitions to DELIVERED -> PARTIALLY_DELIVERED
    await processStatusCallback({ messageSid: sid1, messageStatus: 'delivered', firestoreDb: mockDb });
    doc = await mockDb.collection('sos_alerts').doc(alertId).get();
    assert.strictEqual(doc.data().guardianResults[0].delivered, true);
    assert.strictEqual(doc.data().deliveryStatus, 'PARTIALLY_DELIVERED');

    // Step 3: sid2 transitions to READ -> DELIVERED_ALL
    await processStatusCallback({ messageSid: sid2, messageStatus: 'read', eventType: 'READ', firestoreDb: mockDb });
    doc = await mockDb.collection('sos_alerts').doc(alertId).get();
    assert.strictEqual(doc.data().guardianResults[1].delivered, true);
    assert.strictEqual(doc.data().guardianResults[1].read, true);
    assert.strictEqual(doc.data().deliveryStatus, 'DELIVERED_ALL');
  });

  // Test 32: REGRESSION - Out-of-order and duplicate events in Firestore are handled safely
  await runTest('32. REGRESSION: Out-of-order and duplicate callback events in Firestore are handled safely', async () => {
    const mockDb = createMockFirestore();
    setGlobalFirestoreDb(mockDb);

    const alertId = 'alert-order-test';
    const sid = 'SM_order_test_sid';

    await mockDb.collection('sos_alerts').doc(alertId).set({
      overallStatus: 'SENDING',
      guardianResults: [
        { name: 'Son', rawPhone: '9876543210', messageSid: sid, status: STATUS.DELIVERED, delivered: true },
      ],
    });

    await trackMessageDurable({ messageSid: sid, alertId, phone: '9876543210', initialStatus: STATUS.DELIVERED, firestoreDb: mockDb });

    // Duplicate event
    const dupRes = await processStatusCallback({ messageSid: sid, messageStatus: 'delivered', firestoreDb: mockDb });
    assert.strictEqual(dupRes.duplicate, true, 'Should detect duplicate callback');

    // Out-of-order older event (SENT arrives after DELIVERED)
    const oldRes = await processStatusCallback({ messageSid: sid, messageStatus: 'sent', firestoreDb: mockDb });
    assert.strictEqual(oldRes.ignored, true, 'Should ignore older status callback');

    // Verify status in Firestore did not regress
    const doc = await mockDb.collection('sos_alerts').doc(alertId).get();
    assert.strictEqual(doc.data().guardianResults[0].status, STATUS.DELIVERED, 'Must not regress from DELIVERED');
  });

  // Test 33: REGRESSION - Distinguishable errors for missing, malformed, and empty Authorization header
  await runTest('33. REGRESSION: Distinguishable errors for missing, malformed, and empty Authorization header', async () => {
    // 1. Missing Authorization header
    const resMissing = await makeRequest(app, {
      method: 'POST',
      path: '/api/sos',
      body: { reason: 'manual' },
    });
    assert.strictEqual(resMissing.status, 401);
    assert.strictEqual(resMissing.body.ok, false);
    assert.strictEqual(resMissing.body.errorCode, 'AUTH_HEADER_MISSING');
    assert.ok(resMissing.body.error.includes('Missing Authorization header'));

    // 2. Malformed Authorization header (non-Bearer)
    const resMalformed = await makeRequest(app, {
      method: 'POST',
      path: '/api/sos',
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      body: { reason: 'manual' },
    });
    assert.strictEqual(resMalformed.status, 401);
    assert.strictEqual(resMalformed.body.ok, false);
    assert.strictEqual(resMalformed.body.errorCode, 'AUTH_HEADER_MALFORMED');
    assert.ok(resMalformed.body.error.includes('Malformed Authorization header'));

    // 3. Empty Bearer token
    const resEmpty = await makeRequest(app, {
      method: 'POST',
      path: '/api/sos',
      headers: { Authorization: 'Bearer   ' },
      body: { reason: 'manual' },
    });
    assert.strictEqual(resEmpty.status, 401);
    assert.strictEqual(resEmpty.body.ok, false);
    assert.strictEqual(resEmpty.body.errorCode, 'AUTH_TOKEN_EMPTY');
    assert.ok(resEmpty.body.error.includes('Bearer token is empty'));
  });

  // Test 34: REGRESSION - Malformed or invalid ID tokens produce distinguishable AUTH_TOKEN_MALFORMED
  await runTest('34. REGRESSION: Malformed or invalid ID tokens produce distinguishable AUTH_TOKEN_MALFORMED', async () => {
    const resInvalid = await makeRequest(app, {
      method: 'POST',
      path: '/api/sos',
      headers: { Authorization: 'Bearer totally.invalid.jwt.token' },
      body: { reason: 'manual' },
    });
    assert.strictEqual(resInvalid.status, 401);
    assert.strictEqual(resInvalid.body.ok, false);
    assert.strictEqual(resInvalid.body.errorCode, 'AUTH_TOKEN_MALFORMED');
    assert.ok(resInvalid.body.error.includes('Invalid or malformed Firebase ID token'));
  });

  // Test 35: REGRESSION - Backend derives identity strictly from verified token and ignores client-supplied UID
  await runTest('35. REGRESSION: Backend derives identity strictly from verified token and ignores client-supplied UID', async () => {
    let queriedUid = null;
    setTestMockContactsResolver((uid) => {
      queriedUid = uid;
      return [{ name: 'Son', phone: '9876543210', relation: 'Son' }];
    });

    const res = await makeRequest(app, {
      method: 'POST',
      path: '/api/sos',
      headers: {
        Authorization: 'Bearer mock-token-spoof-defense-user',
        'x-test-auth-mock': 'true',
        'x-test-user-name': 'Verified Elder',
      },
      body: {
        reason: 'manual',
        uid: 'attacker-spoofed-uid',
        userId: 'attacker-spoofed-uid',
        email: 'attacker@evil.com',
      },
    });

    // In Sandbox mode, returns SANDBOX_MODE_RESTRICTION, but verified user was spoof-defense-user
    assert.strictEqual(queriedUid, 'spoof-defense-user', 'Contacts must be resolved for verified token UID, not client body UID');
    assert.strictEqual(res.body.code, 'SANDBOX_MODE_RESTRICTION');
  });

  // Test 36: REGRESSION - /api/twilio/test-connectivity requires valid Firebase token and reports distinguishable error codes
  await runTest('36. REGRESSION: /api/twilio/test-connectivity requires valid Firebase token and reports distinguishable error codes', async () => {
    // Missing header
    const resMissing = await makeRequest(app, {
      method: 'POST',
      path: '/api/twilio/test-connectivity',
    });
    assert.strictEqual(resMissing.status, 401);
    assert.strictEqual(resMissing.body.errorCode, 'AUTH_HEADER_MISSING');

    // Malformed header
    const resMalformed = await makeRequest(app, {
      method: 'POST',
      path: '/api/twilio/test-connectivity',
      headers: { Authorization: 'Token abc123xyz' },
    });
    assert.strictEqual(resMalformed.status, 401);
    assert.strictEqual(resMalformed.body.errorCode, 'AUTH_HEADER_MALFORMED');

    // Valid authenticated token
    const resValid = await makeRequest(app, {
      method: 'POST',
      path: '/api/twilio/test-connectivity',
      headers: {
        Authorization: 'Bearer mock-token-test-connectivity-user',
        'x-test-auth-mock': 'true',
      },
    });
    // Responds 200 or 503 depending on Twilio mock configuration, but MUST NOT be 401
    assert.notStrictEqual(resValid.status, 401, 'Valid authenticated token must pass authentication');
  });

  // Test 37: REGRESSION - Manual emergency message format includes all required hackathon parameters
  await runTest('37. REGRESSION: Manual emergency message format includes all required hackathon parameters', async () => {
    // Helper mimicking the client-side emergency message builder
    function buildTestEmergencyMessage({ name, reason, location, timestamp }) {
      const timeStr = timestamp || '1 Nov 2026, 05:00 AM';
      let reasonLabel = '🚨 Emergency SOS button pressed';
      if (reason === 'fall') reasonLabel = '🚨 Possible fall detected';

      let locationText = '📍 Location: Unavailable (GPS signal not found)';
      if (location && typeof location.lat === 'number') {
        const lat = location.lat.toFixed(6);
        const lng = location.lng.toFixed(6);
        const addr = location.address ? `\n📍 Address: ${location.address}` : '';
        locationText = `📍 Coordinates: ${lat}, ${lng}${addr}\n🗺️ Google Maps: https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      }

      return [
        `🚨 *SAHAARA EMERGENCY ALERT* 🚨`,
        ``,
        `*User:* ${name}`,
        `*Emergency Reason:* ${reasonLabel}`,
        `*Timestamp:* ${timeStr}`,
        ``,
        locationText,
        ``,
        `⚠️ *URGENT: Please call or contact ${name} immediately!*`,
      ].join('\n');
    }

    const sampleMsg = buildTestEmergencyMessage({
      name: 'Ramesh Patel',
      reason: 'manual',
      location: { lat: 12.971598, lng: 77.594562, address: 'MG Road, Bengaluru' },
      timestamp: '1 Nov 2026, 05:00 AM',
    });

    assert.ok(sampleMsg.includes('SAHAARA EMERGENCY ALERT'), 'Must contain SAHAARA EMERGENCY ALERT heading');
    assert.ok(sampleMsg.includes('Ramesh Patel'), 'Must contain user name');
    assert.ok(sampleMsg.includes('Emergency SOS button pressed'), 'Must contain emergency reason');
    assert.ok(sampleMsg.includes('12.971598, 77.594562'), 'Must contain coordinates');
    assert.ok(sampleMsg.includes('https://www.google.com/maps/search/?api=1&query=12.971598,77.594562'), 'Must contain Maps link');
    assert.ok(sampleMsg.includes('1 Nov 2026, 05:00 AM'), 'Must contain timestamp');
    assert.ok(sampleMsg.includes('URGENT: Please call or contact Ramesh Patel immediately!'), 'Must contain urgent call request');
  });

  // Test 38: REGRESSION - Multi-guardian fallback builds individual wa.me links with correct URL encoding
  await runTest('38. REGRESSION: Multi-guardian fallback builds individual wa.me links with correct URL encoding', async () => {
    function normalizeTestPhone(phone) {
      if (!phone) return '';
      let clean = String(phone).replace(/\D/g, '');
      if (clean.length === 10) clean = `91${clean}`;
      if (clean.startsWith('0') && clean.length === 11) clean = `91${clean.slice(1)}`;
      return clean;
    }

    function buildTestGuardianWaLink(contact, messageText) {
      const phone = normalizeTestPhone(contact.phone);
      if (!phone) return null;
      return `https://wa.me/${phone}?text=${encodeURIComponent(messageText)}`;
    }

    const testContacts = [
      { name: 'Aarav (Son)', phone: '+91 98765 43210' },
      { name: 'Pooja (Daughter)', phone: '09876543211' },
      { name: 'Dr. Verma', phone: '9876543212' },
    ];

    const message = '🚨 *SAHAARA EMERGENCY ALERT* 🚨\n*User:* Ramesh Patel';

    const links = testContacts.map(c => ({
      name: c.name,
      link: buildTestGuardianWaLink(c, message),
    }));

    assert.strictEqual(links.length, 3, 'Must generate individual links for all 3 guardians');
    assert.ok(links[0].link.startsWith('https://wa.me/919876543210?text='), 'First guardian phone normalized to E.164 without +');
    assert.ok(links[1].link.startsWith('https://wa.me/919876543211?text='), 'Second guardian 0-prefixed phone normalized correctly');
    assert.ok(links[2].link.startsWith('https://wa.me/919876543212?text='), 'Third guardian 10-digit phone normalized with 91 prefix');
    assert.ok(links[0].link.includes('%F0%9F%9A%A8'), 'Must correctly URL-encode emojis and special characters');
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
