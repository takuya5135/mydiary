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
 */
const triggerGoogleAuthRedirect = (email: string): void => {
  if (!window.google) {
    console.error("Google GIS client not loaded");
    return;
  }

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.error("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set");
    return;
  }

  const state = btoa(Math.random().toString()).substring(0, 16);
  sessionStorage.setItem("oauth_state", state);

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
    hint: email,
    prompt: "consent",
    access_type: "offline",
  });

  client.requestCode();
};

export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  // Firebaseのセッション用スコープ
  provider.addScope("https://www.googleapis.com/auth/drive.file");
  provider.addScope("https://www.googleapis.com/auth/calendar.readonly");
  provider.addScope("https://www.googleapis.com/auth/tasks.readonly");

  try {
    // 既にログインしているか確認
    let user = auth.currentUser;
    
    if (!user) {
      const result = await signInWithPopup(auth, provider);
      user = result.user;
    }

    // ホワイトリストチェック
    const whitelisted = await isUserWhitelisted(user.email);
    if (!whitelisted) {
      await signOut(auth);
      alert(
        `アクセス権限がありません (${user.email})\n管理者に利用許可を依頼してください。`
      );
      throw new Error("Unauthorized user");
    }

    // Google API用の認可リダイレクトを開始
    if (user.email) {
      triggerGoogleAuthRedirect(user.email);
      // リダイレクトが発生するため、ここから先の処理は実行されない（または中断される）
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
