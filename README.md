# Sahaara

Sahaara is a senior-friendly mobile and web app for connection, wellbeing, and preserving memories. It is built with Expo Router and React Native, with Firebase for authentication, Firestore, and photo storage. The Saathi companion uses a small Express backend to call the Groq API without exposing the API key in the client.

## Features

- Hindi and English language support
- Email authentication and profile management
- Saathi AI chat and voice-oriented companion screens
- Personal memories with photos, stories, years, editing, and deletion
- Family and elder-circle views
- Bhajan and wellness experiences
- SOS access for urgent help
- Android, iOS, and web targets through Expo

## Technology

- Expo SDK 54 and Expo Router
- React 19.1 and React Native 0.81
- Firebase Authentication, Firestore, and Storage
- Express and Groq API for the Saathi backend

## Prerequisites

- Node.js 20.19 or newer
- npm
- An Expo-compatible workflow such as Expo Go, an Android emulator, an iOS simulator, or a web browser
- A Firebase project with Authentication, Firestore, and Storage enabled
- A Groq API key if you want to use Saathi chat

The app currently uses Expo SDK 54. Keep the Expo, React Native, and Expo package versions aligned when installing or upgrading dependencies. See the [Expo SDK 54 documentation](https://docs.expo.dev/versions/v54.0.0/) for the relevant SDK guidance.

## Installation

Clone the repository and install the app dependencies:

```bash
npm install
```

Install the Saathi backend dependencies separately:

```bash
cd server
npm install
cd ..
```

## Firebase configuration

The client Firebase configuration is in `firebase/config.js`. Verify that it points to the intended Firebase project before using the app.

Enable these Firebase services:

1. Authentication, with the sign-in providers required by the app.
2. Cloud Firestore.
3. Firebase Storage.

Deploy the included security rules with the Firebase CLI, or copy them into the Firebase Console:

```bash
firebase deploy --only firestore:rules,storage
```

The memory feature stores documents under `users/{uid}/memories` and photos under `users/{uid}/memories/{memoryId}/`.

## Running the app

Start the Expo development server from the project root:

```bash
npm start
```

Then choose a target from the Expo terminal UI or use one of these commands:

```bash
npm run android
npm run ios
npm run web
```

`npm run ios` requires macOS with Xcode. The web target can be opened in a regular browser.

## Running Saathi locally

Create `server/.env`:

```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-8b-instant
PORT=3000
HOST=0.0.0.0
```

Start the backend in a second terminal:

```bash
cd server
npm start
```

Check that it is running:

```text
http://localhost:3000/health
```

The backend exposes `POST /api/saathi/chat` for chat requests.

### Connecting the app to the backend

The app accepts `EXPO_PUBLIC_SAATHI_API_URL`. For web or an iOS simulator, localhost normally works:

```bash
EXPO_PUBLIC_SAATHI_API_URL=http://localhost:3000 npm start
```

For a physical phone, replace `192.168.1.10` with the computer's LAN IP address and make sure both devices are on the same network:

```bash
EXPO_PUBLIC_SAATHI_API_URL=http://192.168.1.10:3000 npm start
```

On Windows PowerShell, set the variable for the current session first:

```powershell
$env:EXPO_PUBLIC_SAATHI_API_URL = "http://192.168.1.10:3000"
npm start
```

The computer firewall must allow inbound connections to port 3000. Never put `GROQ_API_KEY` in the Expo app's environment or client code.

## Project structure

```text
app/                 Expo Router screens and routes
app/(tabs)/          Main tab navigation
components/          Reusable UI components
constants/           Theme and shared constants
context/             React context providers
firebase/            Firebase initialization
services/            Client service functions, including Saathi
server/              Express backend for Saathi
assets/              App icons and other static assets
```

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm start` | Start Expo development mode |
| `npm run android` | Start Expo for Android |
| `npm run ios` | Start Expo for iOS |
| `npm run web` | Start Expo for web |
| `cd server && npm start` | Start the Saathi backend |

## Notes

- Audio narration for memories is currently represented by a coming-soon action.
- The Saathi backend is intended for local development and should be deployed behind suitable authentication, rate limiting, and secret management before production use.
- Firestore and Storage rules should be reviewed before deploying to a shared or production Firebase project.


## Emergency SOS & Twilio WhatsApp Integration

SAHAARA includes an emergency SOS alerting system that dispatches individual WhatsApp notifications to registered family guardians when an elder triggers an alert or when fall detection occurs.

The backend uses the official **Twilio Node.js SDK** with Content API templates to dispatch alerts and tracks real-time message delivery through Twilio status callbacks.

### 1. Twilio Environment Variables

Configure these variables in `server/.env` (see `server/.env.example`):

``env
# Twilio Account & API Key Credentials (used for outbound API calls)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_API_KEY=your_twilio_api_key_sid
TWILIO_API_SECRET=your_twilio_api_key_secret

# Twilio Auth Token (used to validate inbound X-Twilio-Signature webhooks)
TWILIO_AUTH_TOKEN=your_twilio_auth_token

# WhatsApp Sender
# For Sandbox: whatsapp:+17372508034 (or your assigned Twilio Sandbox number)
# For Production: whatsapp:+<your_approved_twilio_business_number>
TWILIO_WHATSAPP_FROM=whatsapp:+17372508034

# Operating Mode: 'sandbox' or 'production'
TWILIO_WHATSAPP_MODE=sandbox

# Approved WhatsApp Content Template SID
# NOTE: In Sandbox, the pre-approved Appointment Reminder template
# (HXfe5ab5f00277942d4d4200328b4d403c) is blocked from SOS alerts.
# An approved production emergency SOS template Content SID is required.
TWILIO_WHATSAPP_CONTENT_SID=your_approved_content_sid

# Public HTTPS Status Callback Webhook URL (optional for delivery callbacks)
TWILIO_STATUS_CALLBACK_URL=https://your-domain.com/api/twilio/status-callback
``

> **Security Note:** Never commit `server/.env` or expose Twilio API credentials to Git, client mobile code, or client API responses.

---

### 2. Twilio WhatsApp Sandbox Setup

Twilio provides a free WhatsApp Sandbox for development and testing.

#### Activating the Sandbox
1. Log in to the [Twilio Console](https://console.twilio.com/).
2. Navigate to **Messaging > Try it out > Send a WhatsApp message**.
3. Locate your Sandbox phone number (e.g., `+1 737 250 8034`) and your unique Sandbox Join Code (e.g., `join <word>-<word>`).

#### Joining the Sandbox as a Guardian
Because Twilio Sandbox is a restricted trial environment, recipients cannot receive business-initiated notifications until they opt in:
1. Open WhatsApp on the guardian's phone.
2. Send the exact message `join <your-sandbox-code>` to the Twilio Sandbox number (e.g., `+1 737 250 8034`).
3. Twilio will reply with a confirmation message: *"You are all set! The sandbox session is now active."*
4. **Expiry:** Sandbox sessions automatically expire after **72 hours (3 days)**. If expired, the guardian must re-send the join code.

#### Sandbox Restrictions & Limitations
- **Recipient Opt-in Required:** Only phone numbers that have actively joined the Sandbox within the last 72 hours can receive messages. Unjoined numbers fail immediately with Twilio Error `63015`.
- **Pre-Approved Templates Only:** The Sandbox only permits business-initiated messages using Twilio's default pre-approved templates (such as appointment reminders, verification codes, or order notifications). Custom templates cannot be registered in the Sandbox.
- **Appointment Reminder Restriction:** The default Sandbox template (`HXfe5ab5f00277942d4d4200328b4d403c`) is an appointment reminder (*"Reminder: Appt Tue Oct 29..."*). SAHAARA strictly blocks sending this template for emergency SOS alerts to avoid misleading family members.
- **Rate Limit:** Twilio enforces a strict rate limit of **1 message per 3 seconds** on the Sandbox sender. The backend automatically enforces sequential sending with a 3-second delay between guardian alerts.

---

### 3. Testing WhatsApp SOS

#### Automated Test Suite (Mocked)
The backend includes a comprehensive automated test suite testing all 38 failure and success scenarios without sending real messages or incurring Twilio costs:

``bash
cd server
npm test
``

This verifies:
1. Single guardian API submission.
2. Sequential multi-guardian dispatch.
3. 3-second interval enforcement in Sandbox mode.
4. Error `63015` handling for unjoined recipients.
5. Independent guardian failure isolation.
6. Invalid phone number rejection.
7. Missing configuration handling.
8. Content SID resolution.
9. ContentVariables serialization.
10. Twilio API error recording.
11. Accurate status mapping (`QUEUED`/`SENT`, never falsely marked as `DELIVERED`).
12. Status callback updates (`DELIVERED`, `READ`).
13. `X-Twilio-Signature` webhook validation.
14. Idempotency and out-of-order callback protection.
15. Unauthenticated SOS request rejection (Firebase ID token required).
16. Location retrieval failure resilience (alert proceeds even without GPS).
17. Duplicate SOS rate limiting and debounce protection.
18. Blocking of the default Appointment Reminder Content SID.
19. Arbitrary Content SID cannot bypass Sandbox restriction.
20. Dedicated connectivity testing verifies Twilio credentials without dispatching alerts.
21. Dedicated connectivity test endpoint requires Firebase ID token authentication.
22. Rejection of client-controlled emergency recipients (`_testMockContacts` in HTTP body is strictly ignored; only authenticated Firestore contacts used).
23. Server-controlled Content SID & ContentVariables (client body cannot override).
24. Legacy `reason: 'test'` rejected from `/api/sos` with 400.
25. Webhook fails closed when `TWILIO_AUTH_TOKEN` is missing (500).
26. Webhook rejects missing or invalid `X-Twilio-Signature` (403).
27. Webhook valid `X-Twilio-Signature` succeeds (200).
28. Webhook signature bypass header is rejected outside test environment (403).
29. Durable status persistence in Firestore across simulated backend restarts.
30. Early callback arriving before initial send completes is reconciled.
31. Non-delivered statuses never reported as delivered; accurate aggregate status tracking.
32. Out-of-order and duplicate callback events in Firestore handled safely.
33. Distinguishable errors for missing, malformed, and empty Authorization headers.
34. Malformed or invalid ID tokens produce distinguishable `AUTH_TOKEN_MALFORMED`.
35. Identity derived strictly from verified token (client-supplied `uid` in body is strictly ignored).
36. `/api/twilio/test-connectivity` requires valid Firebase token and reports distinguishable error codes.
37. Manual emergency message format includes all required hackathon parameters (heading, name, reason, coordinates, Maps link, timestamp, urgent call request).
38. Multi-guardian fallback builds individual `wa.me` links with correct phone normalization and URI encoding.

#### Testing Workflow & Sandbox vs Production Distinction

It is critical to distinguish between **automated testing**, **API connectivity verification**, and **actual live SOS WhatsApp delivery**:

1. **Automated Mocked Test Suite (Safe & Cost-Free):**
   The backend includes an automated test suite verifying all error-handling, rate-limiting, and template-rejection scenarios using mocked Twilio SDK calls:
   ```bash
   cd server
   npm test
   ```
   *Zero real WhatsApp messages are dispatched during automated tests.*

2. **Twilio API Connectivity Verification (Sandbox Mode):**
   - The successful Sandbox test using the pre-approved Appointment Reminder template (`HXfe5ab5f00277942d4d4200328b4d403c`) **verifies Twilio API authentication and account connectivity only**.
   - It **does not** test actual emergency SOS dispatch.
   - You can verify backend Twilio credentials safely without creating an emergency alert:
     - In the SAHAARA app, tap **Send test message** under **More > Emergency Contacts**.
     - Or send an authenticated request to `POST /api/twilio/test-connectivity`.
     - The backend verifies Twilio API credentials and confirms connectivity without sending false emergency messages.

3. **Actual SOS WhatsApp Delivery (Requires Production Mode):**
   - **Twilio Sandbox CANNOT dispatch live SAHAARA SOS emergency alerts.** Twilio Sandbox strictly restricts messaging to pre-approved system templates (e.g., appointment reminders), and custom templates are prohibited in the Sandbox.
   - The app **strictly blocks** dispatching the Appointment Reminder template (`HXfe5ab5f00277942d4d4200328b4d403c`) or arbitrary templates in Sandbox mode.
   - If an elder presses the SOS button while the backend is in Sandbox mode, the backend safely records the alert incident in Firestore, logs the restriction, and returns `SANDBOX_MODE_RESTRICTION`.
   - The mobile app displays an informative notice explaining that production WhatsApp configuration is required, while keeping the green **Send via WhatsApp yourself** (`wa.me`) fallback button active so the elder can still reach their family immediately.
   - **Live delivery requirement:** Actual emergency SOS WhatsApp delivery requires upgrading to a production Twilio account (`TWILIO_WHATSAPP_MODE=production`), registering a dedicated WhatsApp Business Profile (WABA) sender, and securing Meta approval for an official emergency alert template.

---

### 4. Configuring Status Callbacks (Real-time Delivery Tracking)

Twilio can report delivery receipts (`delivered`) and read receipts (`read`) back to the SAHAARA backend:

1. Deploy the backend to a publicly accessible HTTPS domain (or use a secure tunnel like `ngrok` for local development):
   ``bash
   ngrok http 3000
   ``
2. Set `TWILIO_STATUS_CALLBACK_URL` in `server/.env`:
   ``env
   TWILIO_STATUS_CALLBACK_URL=https://your-tunnel.ngrok-free.app/api/twilio/status-callback
   ``
3. The backend validates `X-Twilio-Signature` using your `TWILIO_AUTH_TOKEN`.
4. Delivery events (`delivered`, `read`, `failed`, `undelivered`) automatically update the Firestore `sos_alerts` record.

If `TWILIO_STATUS_CALLBACK_URL` is not set, outbound alerts will still be sent, but delivery updates will not be received.

---

### 5. Moving to Production

To send free-form emergency alerts or custom branded SOS templates without Sandbox restrictions:

1. **Twilio Upgraded Account:** Upgrade your Twilio trial account to a full paid account.
2. **WhatsApp Business Profile (WABA):** Register a dedicated Twilio WhatsApp sender under **Messaging > Senders > WhatsApp senders** and complete Meta Business Verification.
3. **Approved Emergency Content Template:**
   - Create a WhatsApp Utility template in the Twilio Content Editor (e.g., `sahaara_sos_emergency_alert`).
   - Submit it to Meta for review and approval.
   - Example template body:
     ``text
     ?? EMERGENCY SOS: {{1}} needs immediate assistance!
     Message: {{2}}
     Location: {{3}}
     Maps: {{4}}
     Time: {{5}}
     ``
   - Obtain the approved `Content SID` (starts with `HX...`).
4. **Switch Configuration:**
   - Set `TWILIO_WHATSAPP_MODE=production`.
   - Set `TWILIO_WHATSAPP_FROM=whatsapp:+<your_approved_number>`.
   - Set `TWILIO_WHATSAPP_CONTENT_SID=HX<your_approved_sos_template_sid>`.


---

## Smartwatch Integration & Vitals Emergency Monitoring

SAHAARA includes a **Vitals Monitoring & Emergency Detection** system that connects to Android Health Connect to read smartwatch health measurements and automatically trigger emergency assistance when critical vitals are detected.

### 1. Architectural Data Flow

```
Smartwatch (e.g. Galaxy Watch, Pixel Watch)
   │
   ▼
Manufacturer Companion App (Samsung Health, Fitbit, Garmin Connect)
   │
   ▼
Android Health Connect (Unified on-device health datastore)
   │
   ▼
SAHAARA Health Connect Service (services/healthConnectService.js)
   │
   ▼
Vitals Screen (app/vitals.js) & Critical Event Detection Engine (services/vitalsEngine.js)
   │
   ▼
Emergency Countdown Modal (components/VitalsEmergencyModal.js)
   │
   ▼
Existing SAHAARA SOS Workflow (Foreground GPS + Firestore + Twilio WhatsApp / Fallback)
```

### 2. Supported Health Metrics & Permissions

SAHAARA requests only the minimum necessary read permissions:

| Metric | Health Connect Permission | Purpose & Rationale |
|---|---|---|
| **Heart Rate** | `android.permission.health.READ_HEART_RATE` | Detect severe bradycardia (<40 BPM) or critical tachycardia (>140 BPM). |
| **Blood Oxygen (SpO2)** | `android.permission.health.READ_OXYGEN_SATURATION` | Detect respiratory distress and severe hypoxemia (<90%). |
| **Blood Pressure** | `android.permission.health.READ_BLOOD_PRESSURE` | Monitor hypertensive crises (>=180 mmHg) or severe hypotension (<80 mmHg). |
| **Respiratory Rate** | `android.permission.health.READ_RESPIRATORY_RATE` | Monitor depressed respiration (<10 breaths/min) or severe tachypnea (>=28 breaths/min). |
| **Resting Heart Rate** | `android.permission.health.READ_RESTING_HEART_RATE` | Track baseline resting cardiac stability. |

### 3. Setting Up Health Connect & Smartwatch Sync

1. **Install Android Health Connect:** Available natively on Android 14+ (Settings > Security & Privacy > Health Connect) or from Google Play on Android 9–13.
2. **Connect Smartwatch Companion App:**
   - **Samsung Galaxy Watch:** Open **Samsung Health > Settings > Connected Services > Health Connect** and allow data sharing.
   - **Google Pixel Watch:** Open **Fitbit app > Settings > Health Connect** and toggle on data sync.
   - **Google Fit:** Open **Google Fit > Profile > Settings > Sync Fit with Health Connect**.
3. **Grant SAHAARA Access:** In the SAHAARA app, tap **More > Smartwatch Vitals > Permissions**, and toggle the desired metrics.

### 4. Expo Development Build Requirements

Health Connect requires native Android Jetpack libraries (`androidx.health.connect.client`) and custom Android manifest activity-aliases for permission rationales. 

Standard **Expo Go** does not include native Health Connect code. To test with a live smartwatch:

```bash
# 1. Clean native prebuild
npx expo prebuild --clean

# 2. Run local Android Development Build
npx expo run:android
```

> **Note on Expo Go:** If running in Expo Go or iOS, the Vitals screen automatically detects the environment and provides the **Hackathon Demo Simulator**, allowing full presentation and testing without a physical wearable.

### 5. Critical Event Detection Engine

Vitals evaluation is decoupled from React components inside `services/vitalsEngine.js` and governed by `config/vitalsRules.js`:

- **Classification States:** `NORMAL`, `ATTENTION`, `CRITICAL`, `UNKNOWN`, `STALE`.
- **Repeated-Measurement Validation:** A single abnormal reading is held at `ATTENTION` with a verification requirement. At least **2 consecutive abnormal readings** are required to confirm a critical event, preventing false alarms from motion artifacts or sensor slippage.
- **5-Minute Emergency Cutoff:** Measurements older than 5 minutes are classified as `STALE` for emergency purposes. Historical records can never trigger an automated SOS alert.
- **Cooldown Debounce:** 15-minute cooldown between automated emergency notifications.
- **User Opt-Out:** Elders can toggle automatic emergency detection on or off at any time.

### 6. User Safety & Alert Countdown

When a critical health event is detected:
1. A 10-second high-contrast alert countdown modal opens with a prominent **"I Am Okay — Cancel Alert"** button.
2. If the user cancels: The countdown aborts, cancellation is logged in Firestore, and no external messages are sent.
3. If the countdown elapses: The existing SAHAARA SOS workflow is invoked with `reason: 'vitals_critical'`, capturing foreground GPS coordinates and initiating guardian alerts.

### 7. Hackathon Demo Mode

The Vitals screen includes an isolated **Hackathon Demo Simulator**:
- **Simulate Normal:** Loads synthetic normal vitals (74 BPM, 98% SpO2, 118/76 BP).
- **Simulate Critical Heart Rate:** Triggers simulated 152 BPM event with alert countdown.
- **Simulate Critical SpO2:** Triggers simulated 86% SpO2 event with alert countdown.
- **Demo Safeguards:** All simulated records are labeled `[DEMO DATA]`, `isDemo: true`. Twilio WhatsApp dispatch is isolated, guaranteeing zero unintended messages to real family members during presentations.

### 8. Clinical & Diagnostic Disclaimer

⚠️ **SAHAARA is an informational safety companion, not a certified medical diagnostic device.**
- Automated real-world emergency dispatch requires formal clinical certification (`isClinicallyApproved: true` in `config/vitalsRules.js`).
- In uncertified reference mode, real readings surface as informational attention prompts.
- Twilio Sandbox restrictions remain active on the backend, preventing accidental broadcast in sandbox mode while preserving the manual WhatsApp fallback.

### 9. Automated Verification Suite

The backend includes a comprehensive 80-test automated verification suite covering:
- Twilio WhatsApp SOS Integration (38 tests)
- Health Connect Vitals Emergency Orchestration (20 tests)
- WhatsGateway Self-Hosted WhatsApp REST API Integration (22 tests)

```bash
# Run entire test suite (80 passed, 0 failed)
npm --prefix server test

# Run WhatsGateway test suite only (22 passed, 0 failed)
npm --prefix server run test:whatsgateway

# Run vitals & smartwatch emergency suite only (20 passed, 0 failed)
npm --prefix server run test:vitals

# Run Twilio WhatsApp suite only (38 passed, 0 failed)
npm --prefix server run test:twilio
```

---

## WhatsGateway Self-Hosted WhatsApp Integration

SAHAARA supports self-hosted WhatsApp delivery via **WhatsGateway** ([navneetyadav-code/whatsapp-api](https://github.com/navneetyadav-code/whatsapp-api)), an independent, open-source REST API gateway powered by **PHP 8.2**, **Node.js (@whiskeysockets/baileys)**, and **MySQL 8.0**.

WhatsGateway runs as an isolated microservice on the host machine or in a separate container network, providing free, template-free WhatsApp messaging without third-party SaaS fees.

### 1. WhatsGateway Docker Installation

Run WhatsGateway as an independent service on the development host (e.g. via Docker Desktop for Windows):

```bash
# 1. Clone WhatsGateway into an independent directory outside SAHAARA
git clone https://github.com/navneetyadav-code/whatsapp-api.git
cd whatsapp-api

# 2. Launch multi-container stack (Apache PHP 8.2, Node.js 20 Baileys worker, MySQL 8.0)
docker compose up -d

# 3. Verify services are running
docker compose ps
```

The gateway dashboard will be accessible at `http://localhost:8080`.

> **IMPORTANT Architectural Boundary:** Do NOT clone, merge, or copy WhatsGateway PHP/MySQL code into the SAHAARA repository. It operates strictly as an external HTTP microservice.

### 2. Required Backend Environment Variables

In `server/.env`:

```env
# Active provider selector ('whatsgateway' or 'twilio')
WHATSAPP_PROVIDER=whatsgateway

# WhatsGateway endpoint on local host
WHATSAPP_GATEWAY_URL=http://127.0.0.1:8080

# API key generated in WhatsGateway Dashboard (/api-keys)
WHATSAPP_GATEWAY_API_KEY=your_whatsgateway_api_key_here

# Outbound timeout in milliseconds (default: 15000)
WHATSAPP_GATEWAY_TIMEOUT_MS=15000

# Webhook HMAC-SHA256 signature secret configured in Dashboard (/webhooks)
WHATSAPP_GATEWAY_WEBHOOK_SECRET=your_whatsgateway_webhook_secret_here

# Optional public HTTPS status callback URL (for message.sent callbacks)
WHATSAPP_GATEWAY_STATUS_CALLBACK_URL=
```

> **Container / Remote Deployment Note:** If the Express backend is later containerized or deployed to a remote server, `127.0.0.1:8080` will no longer point to the host. Use the Docker bridge network DNS (e.g. `http://whatsgateway:80`) or your private internal network hostname. Never expose the Gateway API key to mobile clients or public repository files.

### 3. Dashboard Access & Account Setup

1. Open `http://localhost:8080` in your browser.
2. Sign in with the administrator credentials configured in `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` (or your local database seed).

### 4. API Key Creation

1. In the WhatsGateway dashboard, navigate to **API Keys** (`/api-keys`).
2. Click **Generate New Key**.
3. Copy the live API key (`wa_live_...`).
4. Paste the key into `server/.env` as `WHATSAPP_GATEWAY_API_KEY`.
5. Note: Plaintext API keys are never stored on the gateway; only SHA-256 hashes are persisted.

### 5. WhatsApp Device Pairing

1. In the WhatsGateway dashboard, navigate to **Device** (`/device`) and click **Connect**.
2. Open **WhatsApp** on your mobile device (personal or WhatsApp Business).
3. Navigate to **Linked Devices > Link a Device**.
4. Scan the QR code displayed on the screen.
5. Once the session state transitions to `connected`, the gateway is ready to dispatch alerts.

### 6. Health Probe Endpoint

Verify gateway readiness without authentication:

```bash
curl http://localhost:8080/api/health.php
```

Expected response (`200 OK`):
```json
{
  "ok": true,
  "status": "healthy",
  "database": { "ok": true, "connected": true, "schema_ready": true },
  "worker": { "ok": true, "status_code": 200, "service": "whatsapp-worker" }
}
```

The SAHAARA backend exposes an authenticated connectivity endpoint at `POST /api/whatsapp/test-connectivity` (and backward-compatible alias `/api/twilio/test-connectivity`) which verifies this health probe before initiating live alerts.

### 7. Test Message Procedure

Before testing real emergency triggers:
1. In the SAHAARA app, navigate to **More > Emergency Contacts**.
2. Tap the test connectivity icon or button.
3. The app executes an authenticated check verifying API reachability, MySQL health, and Node.js Baileys worker connectivity without dispatching an actual SOS message.

### 8. Recipient Phone Number Requirements

- Destination numbers are normalized by the backend into international format **without** `+` or `whatsapp:` prefix (e.g. `919876543210`).
- Valid international country codes are preserved (e.g. `15551234567` for US, `447123456789` for UK).
- 10-digit Indian numbers are automatically prepended with `91`.
- Numbers shorter than 10 digits or containing invalid characters are rejected with `INVALID_PHONE_NUMBER`.
- Emergency recipients are **strictly** retrieved from the authenticated user's Firestore path (`users/{uid}/emergencyContacts`). Client requests can never inject or override recipients.

### 9. Delivery Semantics: Queued vs Sent vs Delivered

It is critical to distinguish message states in WhatsGateway:
1. **`ACCEPTED_BY_GATEWAY` (`status: "queued"` from REST API):** The message has been validated and placed into the MySQL FIFO queue. It has **NOT** been transmitted to WhatsApp yet. The UI shows `Accepted (Queued)`, never `Delivered`.
2. **`SENT` (`message.sent` webhook event):** The Node.js Baileys worker claimed the message and dispatched it across the Noise protocol WebSocket to WhatsApp servers.
3. **`DELIVERED`:** Unofficial Baileys multi-device emulation does not guarantee receipt delivery confirmations. Therefore, SAHAARA marks messages as `SENT` upon worker dispatch, and never claims `DELIVERED` without verified evidence.
4. **`FAILED` (`message.failed` webhook event):** The worker failed to deliver the message (e.g. device disconnected, recipient not on WhatsApp, or socket timeout).

### 10. Troubleshooting Device Disconnections

| Symptom | Cause | Solution |
|---|---|---|
| `409 Conflict: Device Not Connected` | The paired phone lost internet or WhatsApp logged out the session. | Open `/device` in the dashboard, click Reconnect, and re-scan the QR code. |
| `502 Bad Gateway: Worker Unreachable` | The background Node.js worker microservice crashed or stopped. | In Docker: `docker compose restart worker`. On Windows host: run `start-worker.bat restart`. |
| `503 Service Degraded` | Database connection lost or schema unready. | Run database migrations via `php scripts/migrate.php` and verify MySQL port. |
| `GATEWAY_TIMEOUT` | Gateway queue is saturated or worker is busy. | Backend times out safely after 15s. Zero silent retries are attempted to avoid duplicate emergency alerts. |

### 11. Unofficial Baileys Integration Limitations & Hackathon Scope

⚠️ **Critical Operational Disclaimers:**
- **Unofficial Reverse-Engineered Protocol:** WhatsGateway connects using [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys), which emulates the WhatsApp Web multi-device protocol. Meta does not officially sponsor or guarantee multi-device web client stability.
- **Phone Must Remain Active:** The paired phone must maintain an active WhatsApp installation. If WhatsApp revokes the linked session, automated alerts will fail until re-linked.
- **Not a Certified Life-Safety System:** This integration is engineered for **hackathon demonstrations and local development**. It must never be relied upon as a primary substitute for official emergency response services (112 / 911).
- **Manual WhatsApp Fallback Preserved:** If WhatsGateway is disconnected or offline, the SAHAARA app preserves the green manual WhatsApp fallback button, opening direct pre-filled `wa.me` links so seniors can always contact guardians manually.

