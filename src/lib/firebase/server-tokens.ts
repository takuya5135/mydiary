import { adminDb } from "./server-config";
import { Timestamp } from "firebase-admin/firestore";

const COLLECTION_NAME = "users";

export interface UserTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

/**
 * サーバーサイドから管理者権限でトークンを保存する
 */
export const saveUserTokenAdmin = async (
  userId: string, 
  accessToken: string, 
  refreshToken?: string, 
  email?: string | null
) => {
  if (!adminDb) {
    throw new Error("Admin SDK is not initialized. Check environment variables.");
  }

  const userRef = adminDb.collection(COLLECTION_NAME).doc(userId);
  const data: any = {
    googleAccessToken: accessToken,
    tokenUpdatedAt: Timestamp.now()
  };

  if (refreshToken) {
    data.googleRefreshToken = refreshToken;
  }

  if (email) {
    data.email = email.toLowerCase();
  }
  
  try {
    await userRef.set(data, { merge: true });
    console.log(`[Admin] Token saved successfully for user: ${userId}`);
  } catch (error) {
    console.error("[Admin] Error saving token:", error);
    throw error;
  }
};

/**
 * サーバーサイドから管理者権限でトークンを取得する
 */
export const getUserTokensAdmin = async (userId: string): Promise<UserTokens | null> => {
  if (!adminDb) {
    console.warn("Admin SDK not initialized, falling back to client-side logic?");
    return null;
  }

  const userRef = adminDb.collection(COLLECTION_NAME).doc(userId);
  try {
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      const data = userDoc.data();
      return {
        accessToken: data?.googleAccessToken || null,
        refreshToken: data?.googleRefreshToken || null
      };
    }
    return null;
  } catch (error) {
    console.error("[Admin] Error fetching tokens:", error);
    return null;
  }
};
