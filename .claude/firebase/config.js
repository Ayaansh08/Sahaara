import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBXaXD-Ez_VK_nhEW-rYIfhi8Elwq3UvLY",
  authDomain: "sahaara-93ecc.firebaseapp.com",
  projectId: "sahaara-93ecc",
  storageBucket: "sahaara-93ecc.firebasestorage.app",
  messagingSenderId: "131323179119",
  appId: "1:131323179119:web:510f0648091a468d5a5d9a",
  measurementId: "G-ZDGV8PJ7Y6"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
 

 