/**
 * Firebase Admin SDK のダミー初期化
 * 
 * Vercelでの環境変数設定（サービスアカウントJSON）が困難なため、
 * Server Actionでの Admin SDK 使用を停止しました。
 * 
 * 今後は以下の運用となります：
 * 1. 権限チェック: Firestoreのセキュリティルール（request.auth）で行う
 * 2. データ操作: クライアントSDKで行うか、必要に応じて REST API を検討
 */

export const adminDb = {
  collection: () => {
    throw new Error("Admin SDK is disabled. Use Client SDK or REST API instead.");
  }
} as any;
