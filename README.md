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
The backend includes a comprehensive automated test suite testing all 18 failure and success scenarios without sending real messages or incurring Twilio costs:

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
