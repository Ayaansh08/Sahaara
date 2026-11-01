/**
 * server/test/whatsgateway_sos.test.js
 * 
 * Comprehensive automated 22-scenario verification & regression suite
 * for SAHAARA WhatsGateway WhatsApp SOS integration.
 * 
 * Uses mocked HTTP calls — sends ZERO real WhatsApp messages.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Enforce test environment
process.env.NODE_ENV = 'test';
process.env.WHATSAPP_PROVIDER = 'whatsgateway';

const assert = require('assert');
const http = require('http');
const crypto = require('crypto');

const {
  GATEWAY_STATUS,
  GATEWAY_STATUS_RANK,
  normalizeGatewayPhone,
  getWhatsGatewayConfig,
  formatGatewayEmergencyMessage,
  sendWhatsGatewayMessage,
  sendSosAlertsToGuardiansGateway,
  checkWhatsGatewayHealth,
  validateGatewayWebhookSignature,
  processGatewayCallback,
  setGlobalGatewayFetch,
  clearGatewayTrackedMessages,
  trackGatewayMessageDurable,
} = require('../services/whatsGatewayService');

const {
  setTestMockContactsResolver,
  setCustomFirestoreDb,
} = require('../services/authAndContactsService');

const app = require('../index');

// Test runner tracking
let passedCount = 0;
let failedCount = 0;

async function runTest(name, fn) {
  process.stdout.write(`Testing WhatsGateway: ${name} ... `);
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

// Mock Firestore Factory for persistence testing
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
            set: async (newData, options = {}) => {
              const existing = col.get(id) || {};
              const merged = options.merge
                ? { ...existing, ...JSON.parse(JSON.stringify(newData)) }
                : JSON.parse(JSON.stringify(newData));
              col.set(id, merged);
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
        where: () => ({
          limit: () => ({
            get: async () => ({ empty: true, docs: [] }),
          }),
        }),
      };
    },
  };
}

// Helper to make local HTTP requests to Express app
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

      const req = http.request(
        {
          host: '127.0.0.1',
          port,
          method,
          path: reqPath,
          headers: reqHeaders,
        },
        (res) => {
          let rawData = '';
          res.on('data', (chunk) => {
            rawData += chunk;
          });
          res.on('end', () => {
            server.close();
            let parsed = null;
            try {
              parsed = JSON.parse(rawData);
            } catch (_) {
              parsed = rawData;
            }
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: parsed,
              raw: rawData,
            });
          });
        }
      );

      req.on('error', (err) => {
        server.close();
        reject(err);
      });

      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  });
}

async function runAllTests() {
  console.log('\n================================================================');
  console.log('🧪 SAHAARA WhatsGateway WhatsApp SOS: 22-Scenario Automated Suite');
  console.log('================================================================\n');

  // Test 1: Gateway health check succeeds
  await runTest('1. Gateway health check succeeds', async () => {
    const mockFetch = async (url) => {
      assert(url.includes('/api/health.php'));
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          ok: true,
          status: 'healthy',
          service: 'whatsapp-api-hub',
          database: { ok: true, connected: true },
          worker: { ok: true, status_code: 200 },
        }),
      };
    };

    const res = await checkWhatsGatewayHealth({
      config: { url: 'http://127.0.0.1:8080' },
      injectedFetch: mockFetch,
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.reachable, true);
    assert.strictEqual(res.databaseHealthy, true);
    assert.strictEqual(res.workerHealthy, true);
    assert.strictEqual(res.sosDispatched, false);
    assert.strictEqual(res.deliveryConfirmed, false);
  });

  // Test 2: Gateway health check fails
  await runTest('2. Gateway health check fails (degraded/worker offline)', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 503,
      text: async () => JSON.stringify({
        ok: false,
        status: 'degraded',
        database: { ok: true, connected: true },
        worker: { ok: false, status_code: 502, error: 'Worker offline' },
      }),
    });

    const res = await checkWhatsGatewayHealth({
      config: { url: 'http://127.0.0.1:8080' },
      injectedFetch: mockFetch,
    });

    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.workerHealthy, false);
    assert.strictEqual(res.sosDispatched, false);
    assert.strictEqual(res.deliveryConfirmed, false);
  });

  // Test 3: API key missing
  await runTest('3. API key missing upfront', async () => {
    const res = await sendWhatsGatewayMessage({
      to: '919876543210',
      message: 'Test message',
      config: { url: 'http://127.0.0.1:8080', apiKey: '', timeoutMs: 5000 },
    });

    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 'GATEWAY_API_KEY_MISSING');
    assert.strictEqual(res.accepted, false);
  });

  // Test 4: API key invalid (HTTP 401)
  await runTest('4. API key invalid handled gracefully', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ ok: false, error: 'Unauthorized: Invalid API key' }),
    });

    const res = await sendWhatsGatewayMessage({
      to: '919876543210',
      message: 'Test message',
      config: { url: 'http://127.0.0.1:8080', apiKey: 'invalid_key', timeoutMs: 5000 },
      injectedFetch: mockFetch,
    });

    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.code, 'GATEWAY_UNAUTHORIZED');
    assert.strictEqual(res.accepted, false);
  });

  // Test 5: Valid single-guardian message
  await runTest('5. Valid single-guardian message is enqueued', async () => {
    let capturedBody = null;
    let capturedHeaders = null;

    const mockFetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      capturedHeaders = options.headers;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          ok: true,
          status: 'queued',
          message_id: 142,
          request_id: 'req_test_123',
          messages: [{ id: 'wamid.2bad39f34245' }],
        }),
      };
    };

    const res = await sendWhatsGatewayMessage({
      to: '9876543210', // 10-digit number -> should normalize to 919876543210
      message: '🚨 SAHAARA EMERGENCY ALERT',
      config: { url: 'http://127.0.0.1:8080', apiKey: 'wa_live_key', timeoutMs: 5000 },
      injectedFetch: mockFetch,
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, GATEWAY_STATUS.ACCEPTED_BY_GATEWAY);
    assert.strictEqual(res.delivered, false); // NOT delivered!
    assert.strictEqual(res.accepted, true);
    assert.strictEqual(res.messageId, '142');
    assert.strictEqual(res.requestId, 'req_test_123');
    assert.strictEqual(res.wamid, 'wamid.2bad39f34245');
    assert.strictEqual(capturedBody.to, '919876543210');
    assert.strictEqual(capturedHeaders['X-API-Key'], 'wa_live_key');
  });

  // Test 6: Multiple registered guardians
  await runTest('6. Multiple registered guardians processed', async () => {
    const guardians = [
      { name: 'Son', phone: '+91 98765 43210', relation: 'Son' },
      { name: 'Daughter', phone: '9876543211', relation: 'Daughter' },
    ];

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        ok: true,
        status: 'queued',
        message_id: Math.floor(Math.random() * 1000),
        request_id: 'req_' + Math.random().toString(36).slice(2, 6),
      }),
    });

    const result = await sendSosAlertsToGuardiansGateway({
      guardians,
      userName: 'Senior User',
      emergencyMessage: 'Help needed',
      userId: 'test-user',
      alertId: 'alert-123',
      config: { url: 'http://127.0.0.1:8080', apiKey: 'key', timeoutMs: 5000 },
      injectedFetch: mockFetch,
    });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.totalContacts, 2);
    assert.strictEqual(result.acceptedCount, 2);
    assert.strictEqual(result.acceptedAll, true);
    assert.strictEqual(result.overallStatus, 'ACCEPTED_ALL');
  });

  // Test 7: One guardian failure does not stop others
  await runTest('7. One guardian failure does not stop other guardians', async () => {
    const guardians = [
      { name: 'Invalid Contact', phone: 'invalid-number' },
      { name: 'Valid Contact', phone: '919876543210' },
    ];

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        ok: true,
        status: 'queued',
        message_id: 143,
        request_id: 'req_part_123',
      }),
    });

    const result = await sendSosAlertsToGuardiansGateway({
      guardians,
      userName: 'Senior User',
      emergencyMessage: 'Help needed',
      userId: 'test-user',
      alertId: 'alert-partial',
      config: { url: 'http://127.0.0.1:8080', apiKey: 'key', timeoutMs: 5000 },
      injectedFetch: mockFetch,
    });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.totalContacts, 2);
    assert.strictEqual(result.acceptedCount, 1);
    assert.strictEqual(result.acceptedAll, false);
    assert.strictEqual(result.overallStatus, 'PARTIALLY_ACCEPTED');
    assert.strictEqual(result.results[0].accepted, false);
    assert.strictEqual(result.results[1].accepted, true);
  });

  // Test 8: Invalid phone number is rejected
  await runTest('8. Invalid phone number is rejected upfront', async () => {
    const invalidInputs = ['', '12345', 'abc', null, undefined];
    for (const raw of invalidInputs) {
      const norm = normalizeGatewayPhone(raw);
      assert.strictEqual(norm, null, `Expected null for invalid phone "${raw}"`);
    }

    const res = await sendWhatsGatewayMessage({
      to: '12345',
      message: 'Test',
      config: { url: 'http://127.0.0.1:8080', apiKey: 'key', timeoutMs: 5000 },
    });
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 'INVALID_PHONE_NUMBER');
  });

  // Test 9: Correct emergency message generated
  await runTest('9. Correct emergency message generated with all required fields', async () => {
    const msg = formatGatewayEmergencyMessage({
      userName: 'Ramesh Sharma',
      emergencyMessage: 'Pressed the SOS button and needs immediate emergency assistance!',
      locationSummary: 'Connaught Place, New Delhi (28.6139, 77.2090)',
      mapsLink: 'https://maps.google.com/?q=28.6139,77.2090',
      timeString: '1 Nov 2026, 10:30 AM IST',
    });

    assert(msg.includes('🚨 *SAHAARA EMERGENCY ALERT* 🚨'));
    assert(msg.includes('*Ramesh Sharma* has triggered an SOS alert!'));
    assert(msg.includes('Pressed the SOS button'));
    assert(msg.includes('Connaught Place'));
    assert(msg.includes('https://maps.google.com/?q=28.6139,77.2090'));
    assert(msg.includes('1 Nov 2026, 10:30 AM IST'));
    assert(msg.includes('⚠️ *Please contact them immediately.*'));
  });

  // Test 10: Recipient injection through request body rejected
  await runTest('10. Recipient injection through request body is strictly rejected', async () => {
    const mockFirestore = createMockFirestore();
    setCustomFirestoreDb(mockFirestore);

    // Register legit contact for legit-user
    setTestMockContactsResolver((uid) => {
      if (uid === 'attacker-test-user') {
        return [{ name: 'Real Guardian', phone: '+919876543210' }];
      }
      return [];
    });

    const dispatchedNumbers = [];
    setGlobalGatewayFetch(async (url, options) => {
      const body = JSON.parse(options.body);
      dispatchedNumbers.push(body.to);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          ok: true,
          status: 'queued',
          message_id: 201,
          request_id: 'req_inject_safe',
        }),
      };
    });

    // Client maliciously attempts to inject attacker phone number in body
    const res = await makeRequest(app, {
      method: 'POST',
      path: '/api/sos',
      headers: {
        authorization: 'Bearer mock-token-attacker-test-user',
        'x-test-auth-mock': 'true',
      },
      body: {
        reason: 'manual',
        contacts: [{ name: 'Hacker', phone: '+919999999999' }],
        _testMockContacts: [{ name: 'Hacker', phone: '+919999999999' }],
      },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(dispatchedNumbers.length, 1);
    assert.strictEqual(dispatchedNumbers[0], '919876543210'); // Only real registered guardian received!
    assert(!dispatchedNumbers.includes('919999999999'));
  });

  // Test 11: Client-supplied UID ignored
  await runTest('11. Client-supplied UID in body is ignored (identity derived from token)', async () => {
    const mockFirestore = createMockFirestore();
    setCustomFirestoreDb(mockFirestore);

    setTestMockContactsResolver((uid) => {
      // Legit user has contacts, victim user has none
      if (uid === 'verified-token-uid') {
        return [{ name: 'Legit Guardian', phone: '919876543210' }];
      }
      return [];
    });

    setGlobalGatewayFetch(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        ok: true,
        status: 'queued',
        message_id: 202,
        request_id: 'req_spoof_safe',
      }),
    }));

    // Body specifies victim-uid, but token belongs to verified-token-uid
    const res = await makeRequest(app, {
      method: 'POST',
      path: '/api/sos',
      headers: {
        authorization: 'Bearer mock-token-verified-token-uid',
        'x-test-auth-mock': 'true',
      },
      body: {
        reason: 'manual',
        userId: 'victim-uid',
      },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
  });

  // Test 12: Client cannot override gateway URL or API key
  await runTest('12. Client cannot override gateway URL or API key via request body', async () => {
    const mockFirestore = createMockFirestore();
    setCustomFirestoreDb(mockFirestore);

    setTestMockContactsResolver(() => [{ name: 'Guardian', phone: '919876543210' }]);

    let targetUrlCalled = null;
    setGlobalGatewayFetch(async (url) => {
      targetUrlCalled = url;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          ok: true,
          status: 'queued',
          message_id: 203,
          request_id: 'req_url_safe',
        }),
      };
    });

    const res = await makeRequest(app, {
      method: 'POST',
      path: '/api/sos',
      headers: {
        authorization: 'Bearer mock-token-test-override-user',
        'x-test-auth-mock': 'true',
      },
      body: {
        reason: 'manual',
        url: 'http://attacker-controlled-site.com',
        WHATSAPP_GATEWAY_URL: 'http://attacker-controlled-site.com',
        apiKey: 'attacker-stolen-key',
      },
    });

    assert.strictEqual(res.status, 200);
    assert(targetUrlCalled.includes('127.0.0.1:8080') || targetUrlCalled.includes('/api/send.php'));
    assert(!targetUrlCalled.includes('attacker-controlled-site.com'));
  });

  // Test 13: Queue acceptance is not shown as delivered
  await runTest('13. Queue acceptance (queued) is not represented as delivered', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        ok: true,
        status: 'queued',
        message_id: 145,
        request_id: 'req_queued_test',
      }),
    });

    const res = await sendWhatsGatewayMessage({
      to: '919876543210',
      message: 'Test message',
      config: { url: 'http://127.0.0.1:8080', apiKey: 'key', timeoutMs: 5000 },
      injectedFetch: mockFetch,
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 'ACCEPTED_BY_GATEWAY');
    assert.strictEqual(res.delivered, false); // NOT delivered!
    assert.strictEqual(res.accepted, true);
  });

  // Test 14: Timeout handled without unsafe duplicate retries
  await runTest('14. Timeout handled cleanly without unsafe duplicate retries', async () => {
    let callCount = 0;
    const mockTimeoutFetch = async () => {
      callCount++;
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    };

    const res = await sendWhatsGatewayMessage({
      to: '919876543210',
      message: 'Test message',
      config: { url: 'http://127.0.0.1:8080', apiKey: 'key', timeoutMs: 500 },
      injectedFetch: mockTimeoutFetch,
    });

    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 'GATEWAY_TIMEOUT');
    assert.strictEqual(callCount, 1); // Exactly 1 call; no automatic retry!
  });

  // Test 15: Callback HMAC validation succeeds
  await runTest('15. Callback HMAC-SHA256 validation succeeds with valid secret', async () => {
    const secret = 'test_webhook_secret_key_12345';
    const payload = JSON.stringify({ event: 'message.sent', message_id: 142 });
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const isValid = validateGatewayWebhookSignature(payload, signature, secret);
    assert.strictEqual(isValid, true);
  });

  // Test 16: Invalid callback signatures rejected (HTTP 403)
  await runTest('16. Invalid callback signatures rejected with 403', async () => {
    const res = await makeRequest(app, {
      method: 'POST',
      path: '/api/whatsgateway/callback',
      headers: {
        'x-wa-hub-signature': 'invalid_signature_hex_deadbeef',
      },
      body: {
        event: 'message.sent',
        message_id: 142,
      },
    });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error, 'Forbidden: Invalid WhatsGateway signature');
  });

  // Test 17: Missing webhook secret fails closed
  await runTest('17. Missing webhook secret fails closed (500)', async () => {
    const origSecret = process.env.WHATSAPP_GATEWAY_WEBHOOK_SECRET;
    delete process.env.WHATSAPP_GATEWAY_WEBHOOK_SECRET;

    try {
      const res = await makeRequest(app, {
        method: 'POST',
        path: '/api/whatsgateway/callback',
        headers: {
          'x-wa-hub-signature': 'deadbeef1234',
        },
        body: { event: 'message.sent' },
      });

      assert.strictEqual(res.status, 500);
      assert(res.body.error.includes('WHATSAPP_GATEWAY_WEBHOOK_SECRET is missing'));
    } finally {
      process.env.WHATSAPP_GATEWAY_WEBHOOK_SECRET = origSecret || 'sahaara_gateway_webhook_secret_32char';
    }
  });

  // Test 18: Duplicate callbacks handled idempotently
  await runTest('18. Duplicate callbacks handled idempotently without error', async () => {
    clearGatewayTrackedMessages();

    // Initial state: accepted
    await trackGatewayMessageDurable({
      messageId: '142',
      status: GATEWAY_STATUS.ACCEPTED_BY_GATEWAY,
    });

    // Callback 1
    const res1 = await processGatewayCallback({
      event: 'message.sent',
      messageId: '142',
      status: 'sent',
    });
    assert.strictEqual(res1.ok, true);
    assert.strictEqual(res1.status, GATEWAY_STATUS.SENT);

    // Duplicate callback 2
    const res2 = await processGatewayCallback({
      event: 'message.sent',
      messageId: '142',
      status: 'sent',
    });
    assert.strictEqual(res2.ok, true);
    assert.strictEqual(res2.status, GATEWAY_STATUS.SENT);
  });

  // Test 19: Delivery status mapping is accurate (never claims delivered for sent)
  await runTest('19. Delivery status mapping is accurate (SENT does not equal DELIVERED)', async () => {
    clearGatewayTrackedMessages();

    await trackGatewayMessageDurable({
      messageId: '150',
      status: GATEWAY_STATUS.ACCEPTED_BY_GATEWAY,
    });

    const res = await processGatewayCallback({
      event: 'message.sent',
      messageId: '150',
      status: 'sent',
    });

    assert.strictEqual(res.status, GATEWAY_STATUS.SENT);
    assert.notStrictEqual(res.status, 'DELIVERED'); // Crucial: sent is not delivered!

    // Out-of-order callback check: an older "queued" callback arriving after "sent" is ignored
    const outOfOrder = await processGatewayCallback({
      event: 'message.queued',
      messageId: '150',
      status: 'queued',
    });
    assert.strictEqual(outOfOrder.status, 'ignored_out_of_order');
  });

  // Test 20: Firebase authentication and SOS debounce still work
  await runTest('20. Firebase authentication and SOS debounce are enforced', async () => {
    // A: Missing auth header -> 401
    const unauthRes = await makeRequest(app, {
      method: 'POST',
      path: '/api/sos',
      body: { reason: 'manual' },
    });
    assert.strictEqual(unauthRes.status, 401);

    // B: Debounce rate limit -> 429
    setGlobalGatewayFetch(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, status: 'queued', message_id: 301 }),
    }));

    setTestMockContactsResolver(() => [{ name: 'Contact', phone: '919876543210' }]);

    const userToken = 'mock-token-debounce-gateway-user';
    const firstReq = await makeRequest(app, {
      method: 'POST',
      path: '/api/sos',
      headers: {
        authorization: `Bearer ${userToken}`,
        'x-test-auth-mock': 'true',
      },
      body: { reason: 'manual' },
    });
    assert.strictEqual(firstReq.status, 200);

    const secondReq = await makeRequest(app, {
      method: 'POST',
      path: '/api/sos',
      headers: {
        authorization: `Bearer ${userToken}`,
        'x-test-auth-mock': 'true',
      },
      body: { reason: 'manual' },
    });
    assert.strictEqual(secondReq.status, 429);
    assert(secondReq.body.error.includes('Rate limit exceeded'));
  });

  // Test 21: Foreground location retrieval failure does not prevent incident recording
  await runTest('21. Location failure does not prevent SOS incident recording', async () => {
    const mockFirestore = createMockFirestore();
    setCustomFirestoreDb(mockFirestore);

    setTestMockContactsResolver(() => [{ name: 'Contact', phone: '919876543210' }]);

    setGlobalGatewayFetch(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, status: 'queued', message_id: 302 }),
    }));

    const res = await makeRequest(app, {
      method: 'POST',
      path: '/api/sos',
      headers: {
        authorization: 'Bearer mock-token-no-location-user',
        'x-test-auth-mock': 'true',
      },
      body: {
        reason: 'manual',
        location: null, // GPS unavailable
      },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.location, null);
    assert.strictEqual(res.body.provider, 'whatsgateway');
    assert(res.body.alertId !== null);
  });

  // Test 22: Twilio Sandbox restrictions do not incorrectly block WhatsGateway provider
  await runTest('22. Twilio Sandbox mode does NOT block WhatsGateway provider', async () => {
    const origTwilioMode = process.env.TWILIO_WHATSAPP_MODE;
    const origProvider = process.env.WHATSAPP_PROVIDER;

    try {
      // Set Twilio to sandbox mode, but active provider is whatsgateway
      process.env.TWILIO_WHATSAPP_MODE = 'sandbox';
      process.env.WHATSAPP_PROVIDER = 'whatsgateway';

      setTestMockContactsResolver(() => [{ name: 'Guardian', phone: '919876543210' }]);

      setGlobalGatewayFetch(async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          ok: true,
          status: 'queued',
          message_id: 303,
          request_id: 'req_sandbox_bypass_safe',
        }),
      }));

      const res = await makeRequest(app, {
        method: 'POST',
        path: '/api/sos',
        headers: {
          authorization: 'Bearer mock-token-gateway-active-user',
          'x-test-auth-mock': 'true',
        },
        body: { reason: 'manual' },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.ok, true);
      assert.strictEqual(res.body.provider, 'whatsgateway');
      assert.notStrictEqual(res.body.code, 'SANDBOX_MODE_RESTRICTION');
    } finally {
      process.env.TWILIO_WHATSAPP_MODE = origTwilioMode || 'sandbox';
      process.env.WHATSAPP_PROVIDER = origProvider || 'whatsgateway';
    }
  });

  console.log('\n================================================================');
  console.log(`Results: ${passedCount} passed, ${failedCount} failed.`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runAllTests().catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}

module.exports = { runAllTests };
