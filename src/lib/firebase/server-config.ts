import * as admin from 'firebase-admin';

/**
 * サーバーサイド専用の管理者権限付きFirestore接続
 * 環境変数 FIREBASE_SERVICE_ACCOUNT_KEY からサービスアカウント情報を読み取ります
 */
if (!admin.apps.length) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  
  try {
    if (serviceAccountKey) {
      console.log("[Firebase Admin] Environment variable detected. Length:", serviceAccountKey.length);
      
      // 前後の不要な空白や引用符を徹底的に除去
      let cleanedKey = serviceAccountKey.trim().replace(/^['"]|['"]$/g, '');
      
      let serviceAccount;
      try {
        serviceAccount = JSON.parse(cleanedKey);
      } catch (parseError: any) {
        console.warn("[Firebase Admin] First JSON parse attempt failed. Retrying with escaped newline fix...");
        // Vercelなどで \n がエスケープされた文字列として入っている場合への対策
        const fixedKey = cleanedKey.replace(/\\n/g, '\n');
        serviceAccount = JSON.parse(fixedKey);
      }
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id 
      });
      console.log("[Firebase Admin] SDK initialized successfully with service account.");
    } else {
      console.warn("[Firebase Admin] FIREBASE_SERVICE_ACCOUNT_KEY is missing in process.env");
      // サービスアカウントキーがない場合は環境のデフォルト設定を使用
      const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      admin.initializeApp({
        projectId: projectId
      });
      console.log(`[Firebase Admin] Initialized with default credentials. Project ID: ${projectId || "unknown"}`);
    }
  } catch (e) {
    console.error("[Firebase Admin] Critical configuration error:", e);
  }
}

export const adminDb = admin.firestore();
