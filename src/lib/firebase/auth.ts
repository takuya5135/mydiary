import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./config";
import { GOOGLE_API_SCOPES } from "../google/oauth";

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

export interface AuthorizeOptions {
  prompt?: "consent" | "select_account" | "none";
  email?: string | null;
}

/**
 * Google Identity Services を使用して認可リダイレクトを開始する
 * 永続的な Refresh Token を取得するために必要
 */
export const authorizeGoogle = (options: AuthorizeOptions = {}): void => {
  const { prompt, email } = options;
  console.log(`[Auth] authorizeGoogle started (Redirect Mode, prompt: ${prompt || "default"})`);
  
  if (!window.google) {
    console.error("[Auth] Google GIS client not loaded.");
    alert("認証クライアントがロードされていません。ページを更新してください。");
    return;
  }

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    alert("環境設定エラー: クライアントIDが見つかりません。");
    return;
  }

  try {
    const state = btoa(Math.random().toString()).substring(0, 16);
    sessionStorage.setItem("oauth_state", state);

    // localStorage または引数からリフレッシュトークンの存在を確認
    const cachedToken = typeof window !== "undefined" ? localStorage.getItem("googleRefreshToken") : null;
    const effectivePrompt = prompt || (cachedToken ? "" : "consent");

    console.log(`[Auth] authorizeGoogle: effectivePrompt="${effectivePrompt}" (cachedToken: ${!!cachedToken})`);

    const client = window.google.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: GOOGLE_API_SCOPES,
      ux_mode: "redirect",
      redirect_uri: window.location.origin + "/auth/callback",
      state: state,
      hint: email || undefined,
      prompt: effectivePrompt,
      access_type: "offline",
    });

    client.requestCode();
  } catch (error) {
    console.error("[Auth] Failed to trigger Google Auth redirect:", error);
  }
};

export const loginWithGoogle = async () => {
  console.log("[Auth] Basic loginWithGoogle (Popup Mode)");
  const provider = new GoogleAuthProvider();
  // 統一されたスコープをセット
  GOOGLE_API_SCOPES.split(" ").forEach(scope => {
    provider.addScope(scope);
  });

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // ホワイトリストチェック
    const whitelisted = await isUserWhitelisted(user.email);
    if (!whitelisted) {
      await signOut(auth);
      alert(`アクセス権限がありません (${user.email})`);
      throw new Error("Unauthorized user");
    }

    return user;
  } catch (error: any) {
    console.error("[Auth] Login failed:", error);
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
