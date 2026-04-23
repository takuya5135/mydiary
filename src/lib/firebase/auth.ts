import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./config";

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

export const loginWithGoogle = async () => {
  console.log("[Auth] Falling back to original loginWithGoogle with token saving");
  const provider = new GoogleAuthProvider();
  // スコープの再追加
  provider.addScope("https://www.googleapis.com/auth/drive.file");
  provider.addScope("https://www.googleapis.com/auth/calendar.readonly");
  provider.addScope("https://www.googleapis.com/auth/tasks.readonly");

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Googleアクセストークンの取得
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    if (accessToken) {
      console.log("[Auth] Saving access token to Firestore for:", user.uid);
      // トークンをFirestoreに保存
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        accessToken: accessToken,
        updatedAt: serverTimestamp(),
      }, { merge: true });
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
