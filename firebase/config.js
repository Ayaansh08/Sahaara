import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  browserLocalPersistence,
  getAuth,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Sahaara Firebase Project Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBXaXD-Ez_VK_nhEW-rYIfhi8Elwq3UvLY",
  authDomain: "sahaara-93ecc.firebaseapp.com",
  projectId: "sahaara-93ecc",
  storageBucket: "sahaara-93ecc.firebasestorage.app",
  messagingSenderId: "131323179119",
  appId: "1:131323179119:web:510f0648091a468d5a5d9a",
  measurementId: "G-ZDGV8PJ7Y6"
};

// Initialize Firebase App instance safely (prevents duplicate initializations)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with cross-platform persistence (browserLocalPersistence for Web, AsyncStorage for iOS/Android)
let auth;
try {
  const authPersistence =
    Platform.OS === 'web'
      ? browserLocalPersistence
      : getReactNativePersistence(AsyncStorage);

  auth = initializeAuth(app, {
    persistence: authPersistence,
  });
} catch (error) {
  auth = getAuth(app);
}

// Initialize Firestore & Storage instances
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
