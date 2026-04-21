import * as admin from 'firebase-admin';

/**
 * Firebase Admin SDK の初期化を安全に行う関数
 */
function getFirebaseAdminApp() {
  // すでに初期化済みのアプリがあればそれを返す
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  // デフォルトのプロジェクトIDを可能な限り取得
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "mydiary-af314";

  if (serviceAccountKey) {
    try {
      console.log("[Firebase Admin] Detected credentials. Checking format...");
      let rawKey = serviceAccountKey.trim();
      
      // Base64判定: { で始まっていない場合はBase64とみなしてデコードを試みる
      if (rawKey && !rawKey.startsWith('{')) {
        console.log("[Firebase Admin] Format seems to be Base64. Decoding...");
        try {
          rawKey = Buffer.from(rawKey, 'base64').toString('utf-8');
        } catch (decodeError) {
          console.error("[Firebase Admin] Base64 decoding failed:", decodeError);
        }
      }

      // 前後の不要な引用符を除去
      let cleanedKey = rawKey.trim().replace(/^['"]|['"]$/g, '');
      
      let serviceAccount;
      try {
        serviceAccount = JSON.parse(cleanedKey);
      } catch (e: any) {
        console.warn("[Firebase Admin] Standard JSON parse failed. Retrying with escaped newline fix...");
        serviceAccount = JSON.parse(cleanedKey.replace(/\\n/g, '\n'));
      }

      const app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId
      });
      console.log("[Firebase Admin] SDK initialized successfully with service account.");
      return app;
    } catch (e) {
      console.error("[Firebase Admin] Service account initialization failed. Falling back to default:", e);
      // ここではエラーを投げず、下のデフォルト初期化へフォールバックさせてクラッシュを防ぐ
    }
  }

  // 最終的なフォールバック: プロジェクトIDのみで最小限の初期化
  console.log(`[Firebase Admin] Initializing with default settings. Project ID: ${projectId}`);
  return admin.initializeApp({
    projectId: projectId
  });
}

// モジュール読み込み時に実行
const app = getFirebaseAdminApp();

// 安全にFirestoreインスタンスをエクスポート
export const adminDb = app.firestore();
