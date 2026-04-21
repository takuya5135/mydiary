import * as admin from 'firebase-admin';

/**
 * サーバーサイド専用の管理者権限付きFirestore接続
 * 環境変数 FIREBASE_SERVICE_ACCOUNT_KEY からサービスアカウント情報を読み取ります
 */
if (!admin.apps.length) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  
  try {
    if (serviceAccountKey) {
      // 環境変数が引用符で囲まれていたり、改行が含まれていたりする場合の対策
      let cleanedKey = serviceAccountKey.trim();
      // もし ' で囲まれていたら外す
      if (cleanedKey.startsWith("'") && cleanedKey.endsWith("'")) {
        cleanedKey = cleanedKey.slice(1, -1);
      }
      
      const serviceAccount = JSON.parse(cleanedKey);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        // プロジェクトIDを明示的に指定することで "Unable to detect a Project Id" エラーを回避
        projectId: serviceAccount.project_id 
      });
      console.log("Firebase Admin SDK initialized successfully with service account.");
    } else {
      // サービスアカウントキーがない場合は環境のデフォルト設定を使用（プロジェクトIDは極力指定）
      const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      admin.initializeApp({
        projectId: projectId
      });
      console.log(`Firebase Admin SDK initialized with default credentials. Project ID: ${projectId || "detecting..."}`);
    }
  } catch (e) {
    console.error("Firebase Admin initialization error:", e);
    // 致命的なエラーとしてログに残すが、アプリ自体がクラッシュしないよう配慮
    // ただし、projectIdがない場合は後続のFirestore操作で結局エラーになる
  }
}

export const adminDb = admin.firestore();
