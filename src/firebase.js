import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAjuABH3ohKi8tltknByC-locn4jgK5RaU",
  authDomain: "boss-a8566.firebaseapp.com",
  projectId: "boss-a8566",
  storageBucket: "boss-a8566.firebasestorage.app",
  messagingSenderId: "590466732842",
  appId: "1:590466732842:web:fc94ad9ae1d96117998453"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);