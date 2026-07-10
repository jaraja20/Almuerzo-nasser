import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Detect missing env vars early so we can show a helpful error
// instead of hanging forever on Firestore queries.
export const FIREBASE_CONFIG_MISSING = !firebaseConfig.apiKey || !firebaseConfig.projectId;

if (FIREBASE_CONFIG_MISSING) {
  // eslint-disable-next-line no-console
  console.error(
    "[Firebase] Faltan variables de entorno REACT_APP_FIREBASE_*. " +
      "Configuralas en Vercel (Settings → Environment Variables) y redeployá."
  );
}

const app = getApps()[0] || initializeApp(firebaseConfig);
export const db = getFirestore(app);

export const LOGO_URL =
  "https://customer-assets.emergentagent.com/job_weekly-menu-picker/artifacts/4o01spyu_image.png";

export const ADMIN_USER = process.env.REACT_APP_ADMIN_USER || "recepcion";
export const ADMIN_PASSWORD =
  process.env.REACT_APP_ADMIN_PASSWORD || "rec73491654";
