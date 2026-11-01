# SAHAARA: WhatsGateway Self-Hosted WhatsApp API Migration Report

## 1. Initial Repository Audit

We audited the SAHAARA repository at `main` commit `8428eac` (following earlier milestones `14bb43b`, `340b64c`, `d2c978e`, `eb5be98`, `f72fec4`):

- **Backend Routing (`server/index.js`):** Previously routed SOS alerts directly and exclusively to Twilio (`twilioService.js`). In Sandbox mode, it refused live dispatch with `SANDBOX_MODE_RESTRICTION` and blocked the default Appointment Reminder Content SID (`HXfe5ab5f00277942d4d4200328b4d403c`).
- **Firebase Authentication & Contacts (`server/authAndContactsService.js`):** Enforces strict identity verification via Firebase ID tokens (`verifyFirebaseUser`). Derives UID solely from decoded token payloads, completely ignoring client-supplied UIDs. Retrieves contacts strictly from `users/{uid}/emergencyContacts` and ignores client overrides (`_testMockContacts`).
- **Client Service (`services/sos.js`):** Dispatches foreground GPS coordinates (`getCurrentLocation`), queries registered Firestore emergency contacts, and issues `POST /api/sos` with Firebase ID token authentication in the `Authorization: Bearer <token>` header. Features a isolated demo mode (`isDemo: true`) for hackathons that dispatches zero external messages.
- **Client UI (`components/SosModal.js`):** Calm two-step modal with high-contrast confirmation, live location display, error handling, and manual green WhatsApp fallback button generating pre-filled individual `wa.me` links.
- **Emergency Contacts (`app/emergency-contacts.js`):** Manages Firestore contacts and includes a connectivity test button calling backend test-connectivity endpoints without sending real alerts.

---

## 2. Files Changed & Added

| File | Change Type | Purpose |
|---|---|---|
| [`server/services/whatsGatewayService.js`](file:///C:/Users/gkv47/Downloads/Sahaara/server/services/whatsGatewayService.js) | **NEW** | Reusable WhatsGateway service: phone normalization, payload formatting, async queue handling, timeout management, durable Firestore tracking, HMAC webhook verification, and health probes. |
| [`server/test/whatsgateway_sos.test.js`](file:///C:/Users/gkv47/Downloads/Sahaara/server/test/whatsgateway_sos.test.js) | **NEW** | 22-scenario automated verification & regression test suite. |
| [`server/index.js`](file:///C:/Users/gkv47/Downloads/Sahaara/server/index.js) | **MODIFIED** | Added `req.rawBody` buffer capture, dynamic provider switching via `WHATSAPP_PROVIDER`, `/api/whatsgateway/callback` webhook endpoint, provider-aware `/api/whatsapp/test-connectivity`, and updated `/health` endpoint. |
| [`server/.env.example`](file:///C:/Users/gkv47/Downloads/Sahaara/server/.env.example) | **MODIFIED** | Documented `WHATSAPP_PROVIDER`, `WHATSAPP_GATEWAY_URL`, `WHATSAPP_GATEWAY_API_KEY`, `WHATSAPP_GATEWAY_TIMEOUT_MS`, and webhook secrets. |
| [`server/.env`](file:///C:/Users/gkv47/Downloads/Sahaara/server/.env) | **MODIFIED** | Configured `WHATSAPP_PROVIDER=whatsgateway`, gateway URL, and dev keys. |
| [`services/sos.js`](file:///C:/Users/gkv47/Downloads/Sahaara/services/sos.js) | **MODIFIED** | Updated provider metadata defaults to `whatsgateway` and mode `gateway`. |
| [`components/SosModal.js`](file:///C:/Users/gkv47/Downloads/Sahaara/components/SosModal.js) | **MODIFIED** | Provider-aware status cards: displays WhatsGateway connection/worker errors without showing false Twilio sandbox warnings; distinguishes queue acceptance (`ACCEPTED_BY_GATEWAY`) from delivery; preserves manual WhatsApp fallback. |
| [`app/emergency-contacts.js`](file:///C:/Users/gkv47/Downloads/Sahaara/app/emergency-contacts.js) | **MODIFIED** | Points connectivity check to provider-agnostic `/api/whatsapp/test-connectivity`. |
| [`server/package.json`](file:///C:/Users/gkv47/Downloads/Sahaara/server/package.json) | **MODIFIED** | Added `test:whatsgateway` and updated `test` script to execute all 3 test suites. |
| [`server/test/twilio_sos.test.js`](file:///C:/Users/gkv47/Downloads/Sahaara/server/test/twilio_sos.test.js) | **MODIFIED** | Enforced `WHATSAPP_PROVIDER=twilio` within test file to ensure Twilio regression suite tests Twilio provider isolation. |
| [`server/test/vitals_sos.test.js`](file:///C:/Users/gkv47/Downloads/Sahaara/server/test/vitals_sos.test.js) | **MODIFIED** | Scoped `WHATSAPP_PROVIDER=twilio` within Twilio Sandbox test scenario 19. |
| [`README.md`](file:///C:/Users/gkv47/Downloads/Sahaara/README.md) | **MODIFIED** | Added comprehensive WhatsGateway setup, Docker deployment, pairing, delivery semantics, and Baileys caveats. |

---

## 3. Gateway Integration Architecture

```mermaid
flowchart TD
    subgraph MobileClient["SAHAARA Mobile Client (Android / Expo)"]
        UI["SosModal.js / VitalsEmergencyModal.js"]
        Auth["Firebase Auth (getIdToken)"]
        Loc["Foreground GPS Location"]
        Manual["Manual WhatsApp Fallback (wa.me)"]
    end

    subgraph Backend["SAHAARA Express Backend (:3000)"]
        Route["POST /api/sos"]
        TokenCheck["verifyFirebaseUser() (Fail closed)"]
        Contacts["Firestore: users/{uid}/emergencyContacts"]
        Router{"WHATSAPP_PROVIDER"}
        WGService["whatsGatewayService.js"]
        TwilioService["twilioService.js"]
        CallbackRoute["POST /api/whatsgateway/callback"]
    end

    subgraph WhatsGateway["WhatsGateway Microservice (:8080)"]
        PHPAPI["Apache / PHP 8.2 Ingestion (/api/send.php)"]
        MySQL[("MySQL 8.0 FIFO Queue")]
        Worker["Node.js Worker (:3107) (@whiskeysockets/baileys)"]
    end

    subgraph WANetwork["WhatsApp Network"]
        WA["Meta WhatsApp Noise Protocol"]
        Guardian["Guardian's WhatsApp Phone"]
    end

    UI -->|1. Tap SOS| Auth
    Auth -->|2. Bearer Token| Route
    Loc -->|Foreground Coords| Route
    Route --> TokenCheck
    TokenCheck --> Contacts
    Contacts --> Router
    Router -->|whatsgateway| WGService
    Router -->|twilio| TwilioService

    WGService -->|POST /api/send.php with X-API-Key| PHPAPI
    PHPAPI -->|Enqueue 'queued'| MySQL
    PHPAPI -->|Return 200 {status: 'queued'}| WGService
    WGService -->|ACCEPTED_BY_GATEWAY (Never Delivered)| UI

    Worker -->|Claim Queue Batch| MySQL
    Worker -->|Noise WebSocket| WA
    WA --> Guardian

    Worker -.->|HMAC Signed message.sent| CallbackRoute
    CallbackRoute -->|X-WA-Hub-Signature Verification| WGService

    UI -.->|If Gateway Offline| Manual
    Manual -.->|wa.me deep link| Guardian
```

### Key Architectural Boundaries:
1. **Independent Service:** WhatsGateway remains in its own runtime container; zero PHP or Baileys dependencies inside SAHAARA.
2. **Network Isolation:** Express backend runs on the Windows host and talks to `http://127.0.0.1:8080`. The Android app never communicates directly with the Gateway.
3. **Queue Semantics:** The API response `status: "queued"` maps to `ACCEPTED_BY_GATEWAY`. It is never represented as `DELIVERED`.
4. **No Unsafe Retries:** If an outbound request times out or is interrupted, the backend reports `GATEWAY_TIMEOUT` and never silently retries to prevent duplicate panic alerts.

---

## 4. Required Environment Variables

```env
# ─── WhatsApp Provider Selection ──────────────────────────────────────────
# Active WhatsApp provider: 'whatsgateway' (default) or 'twilio'
WHATSAPP_PROVIDER=whatsgateway

# ─── WhatsGateway Self-Hosted WhatsApp API Configuration ─────────────────────
# Gateway endpoint on host machine:
WHATSAPP_GATEWAY_URL=http://127.0.0.1:8080

# API key generated in WhatsGateway Dashboard (/api-keys):
WHATSAPP_GATEWAY_API_KEY=your_whatsgateway_api_key_here

# Timeout in milliseconds for outbound API requests:
WHATSAPP_GATEWAY_TIMEOUT_MS=15000

# Webhook HMAC secret configured in WhatsGateway Dashboard (/webhooks):
WHATSAPP_GATEWAY_WEBHOOK_SECRET=your_whatsgateway_webhook_secret_here

# Optional public HTTPS status callback URL:
WHATSAPP_GATEWAY_STATUS_CALLBACK_URL=
```

---

## 5. Automated Test Suite Execution & Results

We executed the complete backend verification suite covering all 3 domains. **80 tests executed, 80 passed, 0 failed.**

### Test Summary:
- **Twilio WhatsApp SOS Suite (`test/twilio_sos.test.js`):** 38 / 38 passed.
- **Smartwatch Vitals SOS Suite (`test/vitals_sos.test.js`):** 20 / 20 passed.
- **WhatsGateway SOS Suite (`test/whatsgateway_sos.test.js`):** 22 / 22 passed.

### WhatsGateway 22-Scenario Breakdown:
```text
Testing WhatsGateway: 1. Gateway health check succeeds ... ✅ PASSED
Testing WhatsGateway: 2. Gateway health check fails (degraded/worker offline) ... ✅ PASSED
Testing WhatsGateway: 3. API key missing upfront ... ✅ PASSED
Testing WhatsGateway: 4. API key invalid handled gracefully ... ✅ PASSED
Testing WhatsGateway: 5. Valid single-guardian message is enqueued ... ✅ PASSED
Testing WhatsGateway: 6. Multiple registered guardians processed ... ✅ PASSED
Testing WhatsGateway: 7. One guardian failure does not stop other guardians ... ✅ PASSED
Testing WhatsGateway: 8. Invalid phone number is rejected upfront ... ✅ PASSED
Testing WhatsGateway: 9. Correct emergency message generated with all required fields ... ✅ PASSED
Testing WhatsGateway: 10. Recipient injection through request body is strictly rejected ... ✅ PASSED
Testing WhatsGateway: 11. Client-supplied UID in body is ignored (identity derived from token) ... ✅ PASSED
Testing WhatsGateway: 12. Client cannot override gateway URL or API key via request body ... ✅ PASSED
Testing WhatsGateway: 13. Queue acceptance (queued) is not represented as delivered ... ✅ PASSED
Testing WhatsGateway: 14. Timeout handled cleanly without unsafe duplicate retries ... ✅ PASSED
Testing WhatsGateway: 15. Callback HMAC-SHA256 validation succeeds with valid secret ... ✅ PASSED
Testing WhatsGateway: 16. Invalid callback signatures rejected with 403 ... ✅ PASSED
Testing WhatsGateway: 17. Missing webhook secret fails closed (500) ... ✅ PASSED
Testing WhatsGateway: 18. Duplicate callbacks handled idempotently without error ... ✅ PASSED
Testing WhatsGateway: 19. Delivery status mapping is accurate (SENT does not equal DELIVERED) ... ✅ PASSED
Testing WhatsGateway: 20. Firebase authentication and SOS debounce are enforced ... ✅ PASSED
Testing WhatsGateway: 21. Location failure does not prevent SOS incident recording ... ✅ PASSED
Testing WhatsGateway: 22. Twilio Sandbox mode does NOT block WhatsGateway provider ... ✅ PASSED
```

---

## 6. Manual Device-Pairing & Live Send Procedure

When running live for a hackathon demonstration:

1. **Launch WhatsGateway:**
   ```bash
   cd whatsapp-api
   docker compose up -d
   ```
2. **Open Dashboard:** Navigate to `http://localhost:8080`.
3. **Generate API Key:**
   - Go to **API Keys** (`/api-keys`).
   - Create a key and copy `wa_live_...`.
   - Add it to `server/.env` as `WHATSAPP_GATEWAY_API_KEY`.
4. **Pair WhatsApp Account:**
   - In the dashboard, click **Device** (`/device`) > **Connect**.
   - Open WhatsApp on your demonstration phone > **Linked Devices > Link a Device**.
   - Scan the QR code. Wait until status shows `connected`.
5. **Verify Connectivity in SAHAARA:**
   - Start SAHAARA backend: `cd server && npm start`.
   - In the mobile app, go to **More > Emergency Contacts > Test Connectivity**.
   - The probe calls `GET http://127.0.0.1:8080/api/health.php` and verifies API + MySQL + Baileys worker health.
6. **Trigger SOS:**
   - Tap the SOS button on the Home screen or simulate a critical vitals event.
   - Confirm in the modal: message is submitted to `/api/send.php`, queued in MySQL, and sent by the Baileys worker to the guardian's WhatsApp.

---

## 7. Webhook & Callback Status

- **HMAC Verification:** The callback endpoint `POST /api/whatsgateway/callback` uses constant-time comparison (`crypto.timingSafeEqual`) against the raw request body (`req.rawBody`).
- **Fail Closed:** If `WHATSAPP_GATEWAY_WEBHOOK_SECRET` is missing, callbacks are rejected with HTTP 500.
- **Local Testing Reality:** When running WhatsGateway and SAHAARA locally on `localhost` without an ngrok/Cloudflare tunnel or public HTTPS domain, outbound sending functions normally, and the backend marks dispatches as `ACCEPTED_BY_GATEWAY`. Status callbacks are reported as `deliveryCallbacksEnabled: false`, and the app does not falsely claim delivery.

---

## 8. Remaining Limitations & Operational Caveats

1. **Unofficial Baileys Protocol:** WhatsGateway connects via reverse-engineered WhatsApp Web WebSocket emulation. Meta may revoke linked device sessions or update protocols without notice.
2. **Physical Phone Dependency:** The paired phone must maintain an active WhatsApp installation.
3. **Delivery Receipts:** Unofficial multi-device protocols cannot guarantee carrier-grade delivery receipts. SAHAARA marks dispatches as `SENT` (worker dispatched) and never claims `DELIVERED` without explicit verification.
4. **Emergency Services Disclaimer:** This integration is intended strictly for developer evaluation and hackathon presentations, and must never be used as a primary life-safety or 112 emergency dispatch system.
