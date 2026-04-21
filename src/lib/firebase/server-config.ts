import * as admin from 'firebase-admin';

/**
 * サーバーサイド専用の管理者権限付きFirestore接続
 * 環境変数 FIREBASE_SERVICE_ACCOUNT_KEY からサービスアカウント情報を読み取ります
 */
if (!admin.apps.length) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  
  if (serviceAccountKey) {
    try {
      const serviceAccount = JSON.parse(serviceAccountKey);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e);
      admin.initializeApp();
    }
  } else {
    // 環境変数がない場合はデフォルト（Google Cloud環境など）を使用
    admin.initializeApp();
  }
}

export const adminDb = admin.firestore();
