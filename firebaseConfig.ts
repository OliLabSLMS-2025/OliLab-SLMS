import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
// FIX: Changed to named import for firebase/firestore to use v9 modular SDK correctly.
import { getFirestore } from 'firebase/firestore';


/**
 * Firebase Configuration
 *
 * IMPORTANT: Replace the placeholder values below with your own Firebase project's configuration.
 * You can find this in your Firebase project settings.
 *
 * This configuration is essential for connecting the application to your Firebase backend.
 * Without it, authentication and database features will not work.
 */
const firebaseConfig = {
  apiKey: "AIzaSyBRmw-QM0oN2npwwc6RhUGVGUr04r8HTUU",
  authDomain: "olilab-slms.firebaseapp.com",
  projectId: "olilab-slms",
  storageBucket: "olilab-slms.firebasestorage.app",
  messagingSenderId: "577037826165",
  appId: "1:577037826165:web:6762310f65a1ccf8e6603c"
};

// A simple check to see if the config is still using placeholder values
if (firebaseConfig.apiKey === "YOUR_API_KEY") {
    console.warn(
        "Firebase is not configured. Please add your project credentials in `firebaseConfig.ts`."
    );
}


// Initialize Firebase
const app = initializeApp(firebaseConfig);


// Export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);