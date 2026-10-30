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
















Summary of Completed Work (Parts A – D)

Part A — Backend (POST /api/sos):

Implemented in server/index.js with coordinate validation (-90 to 90, -180 to 180), IST timestamps, single location block with Google Maps link, 10s fetch timeout with 1.5s delay between multiple contacts, env fallback (CALLMEBOT_PHONE, CALLMEBOT_KEY), phone normalization (91 prefix for 10-digit numbers), and rate limiting.
Updated server/.env.example.

Part B — Emergency Contacts (Firestore + UI):

Created app/emergency-contacts.js storing contacts under users/{uid}/emergencyContacts/{id} (max 3, masked numbers •••• 1234, edit/delete modal, plain 18px CallMeBot instructions, and "Send test message" button calling /api/sos with reason "test").
Added demo security notice comment: // NOTE: Storing the CallMeBot API key in Firestore is for the hackathon demo only.
Linked as a prominent list row in app/(tabs)/more.js.
Updated firestore.rules to allow authenticated users to manage their emergency contacts.

Part C — Client SOS Service & Location Capture:

Implemented services/sos.js:
getCurrentLocation(): checks foreground permissions, tries High accuracy (6s timeout) 
→
→ Balanced (4s timeout) 
→
→ getLastKnownPositionAsync() with age in seconds, followed by reverse geocoding (3s timeout).
sendSOS({ reason }): reads contacts, captures GPS, calls POST /api/sos, and generates a fallback wa.me URL with pre-filled text.

Part D — Manual SOS Confirm & Result Screens:

Updated components/SosModal.js and components/ScreenHeader.js:
Displays friendly prompt to add contacts if 0 contacts are configured.
Two-step confirm screen showing recipients and direct link to emergency contacts.
Success screen with green check, contacts reached, address/coordinates, and "Map par dekhein" button.
Failure screen with clear message and "WhatsApp se khud bhejein" button opening the pre-filled wa.me fallback link.
All bilingual copy added to i18n/translations.js and location descriptions updated in app.json.