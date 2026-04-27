import * as admin from "firebase-admin";

const project_id = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const client_email = process.env.FIREBASE_CLIENT_EMAIL;
// 改行コード \n を正しく処理し、前後を囲む引用符も除去する
const private_key = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").replace(/^"(.*)"$/, "$1");

if (!admin.apps.length) {
  if (!project_id || !client_email || !private_key) {
    console.warn("Firebase Admin SDK credentials missing. Server-side operations may fail.");
  } else {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: project_id,
          clientEmail: client_email,
          privateKey: private_key,
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
