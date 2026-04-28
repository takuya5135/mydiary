import * as admin from "firebase-admin";

const project_id = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const client_email = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, '')
  : undefined;

if (!privateKey) {
  console.error("[Admin] Missing Private Key: FIREBASE_PRIVATE_KEY is not set or empty.");
}

if (!admin.apps.length) {
  if (!project_id || !client_email || !privateKey) {
    console.warn("Firebase Admin SDK credentials missing. Server-side operations may fail.");
  } else {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: project_id,
          clientEmail: client_email,
          privateKey: privateKey,
        }),
      });
      console.log("Firebase Admin SDK initialized successfully.");
    } catch (error) {
      console.error("Firebase Admin SDK initialization error:", error);
    }
  }
}

export const adminDb = admin.apps.length ? admin.firestore() : null;
export const adminAuth = admin.apps.length ? admin.auth() : null;
