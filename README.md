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
