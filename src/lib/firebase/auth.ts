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
 * Google Identity Services を使用して認可リダイレクトを開始する
 * ログインとは別に、APIの権限（カレンダー等）が必要な時に呼び出す
 */
export const authorizeGoogle = (email?: string | null): void => {
  console.log("[Auth] authorizeGoogle started for:", email);
  
  if (!window.google) {
    console.error("[Auth] Google GIS client not loaded. Make sure the script is in layout.tsx");
    alert("Google認証クライアントがロードされていません。ページを更新してください。");
    return;
  }

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.error("[Auth] NEXT_PUBLIC_GOOGLE_CLIENT_ID is missing");
    alert("環境設定エラー: クライアントIDが見つかりません。");
    return;
  }

  try {
    const state = btoa(Math.random().toString()).substring(0, 16);
    sessionStorage.setItem("oauth_state", state);

    console.log("[Auth] Initializing initCodeClient with redirect mode");
    const client = window.google.accounts.oauth2.initCodeClient({
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
      redirect_uri: window.location.origin + "/auth/callback",
      state: state,
      hint: email || undefined,
      prompt: "consent",
      access_type: "offline",
    });

    console.log("[Auth] Requesting auth code...");
    client.requestCode();
  } catch (error) {
    console.error("[Auth] Failed to trigger Google Auth redirect:", error);
    alert("Google連携の開始に失敗しました。コンソールを確認してください。");
  }
};

/**
 * Firebaseのログイン（本人確認）のみを行う
 */
export const loginWithGoogle = async () => {
  console.log("[Auth] loginWithGoogle started");
  const provider = new GoogleAuthProvider();
  
  try {
    // すでにログインしているか確認
    let user = auth.currentUser;
    
    if (!user) {
      console.log("[Auth] No current user, opening signInWithPopup");
      const result = await signInWithPopup(auth, provider);
      user = result.user;
      console.log("[Auth] signInWithPopup successful:", user.email);
    } else {
      console.log("[Auth] Already logged in as:", user.email);
    }

    // ホワイトリストチェック
    console.log("[Auth] Checking whitelist for:", user.email);
    const whitelisted = await isUserWhitelisted(user.email);
    
    if (!whitelisted) {
      console.warn("[Auth] User not in whitelist:", user.email);
      await signOut(auth);
      alert(
        `アクセス権限がありません (${user.email})\n管理者に利用許可を依頼してください。`
      );
      throw new Error("Unauthorized user");
    }

    console.log("[Auth] loginWithGoogle completed successfully");
    return user;
  } catch (error: any) {
    console.error("[Auth] loginWithGoogle failed:", error);
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
