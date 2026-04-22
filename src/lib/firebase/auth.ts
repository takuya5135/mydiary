import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./config";
import { saveUserToken } from "./tokens";

declare global {
  interface Window {
    google: any;
  }
}

/**
 * 指定されたメールアドレスがホワイトリストに登録されているか確認する
 */
export const isUserWhitelisted = async (
  email: string | null
): Promise<boolean> => {
  if (!email) return false;
  try {
    const docRef = doc(db, "whitelisted_users", email.toLowerCase());
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  } catch (error) {
    console.error("Whitelist check failed:", error);
    return false;
  }
};

/**
 * Google Identity Services を使用して認可コードを取得する
 */
const getGoogleAuthCode = (email: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!window.google) {
      reject(new Error("Google GIS client not loaded"));
      return;
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      reject(new Error("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set"));
      return;
    }

    window.google.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/tasks.readonly",
        "openid",
        "email",
        "profile",
      ].join(" "),
      ux_mode: "redirect",
      redirect_uri: window.location.origin,
      hint: email,
      prompt: "consent",
      access_type: "offline",
    }).requestCode();
  });
};

export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  // Firebaseのセッション用スコープ（GSIとは別）
  provider.addScope("https://www.googleapis.com/auth/drive.file");
  provider.addScope("https://www.googleapis.com/auth/calendar.readonly");
  provider.addScope("https://www.googleapis.com/auth/tasks.readonly");

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // ホワイトリストチェック
    const whitelisted = await isUserWhitelisted(user.email);
    if (!whitelisted) {
      await signOut(auth);
      alert(
        `アクセス権限がありません (${user.email})\n管理者に利用許可を依頼してください。`
      );
      throw new Error("Unauthorized user");
    }

    // Google API用のリフレッシュトークンを取得するために認可コードを取得
    try {
      if (!user.email) throw new Error("User email not found");

      const code = await getGoogleAuthCode(user.email);

      // Server Actionを動的インポートして呼び出し（循環依存を避けるため）
      const { exchangeAuthCodeAction } = await import("@/app/actions");
      const exchangeResult = await exchangeAuthCodeAction(
        user.uid,
        code,
        window.location.origin,
        user.email
      );

      if (exchangeResult.success) {
        // クライアント側の権限を使用してFirestoreに保存
        await saveUserToken(
          user.uid,
          exchangeResult.accessToken,
          exchangeResult.refreshToken,
          user.email
        );
      } else {
        console.error("Token exchange failed:", exchangeResult.error);
        alert("Google認証情報の取得に失敗しました。再度お試しください。");
      }
    } catch (err) {
      console.error("Failed to get offline access code:", err);
      // Firebaseログイン自体は成功しているので続行可能
      // ただし自動更新は機能しなくなる
    }

    return user;
  } catch (error) {
    console.error("Login failed:", error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout failed:", error);
    throw error;
  }
};

export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};
