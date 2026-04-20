import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User 
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./config";
import { saveUserToken } from "./tokens";

/**
 * 指定されたメールアドレスがホワイトリストに登録されているか確認する
 */
export const isUserWhitelisted = async (email: string | null): Promise<boolean> => {
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
  const provider = new GoogleAuthProvider();
  // Add necessary scopes for Phase 3 and Calendar
  provider.addScope("https://www.googleapis.com/auth/drive.file");
  provider.addScope("https://www.googleapis.com/auth/calendar.readonly");
  provider.addScope("https://www.googleapis.com/auth/tasks.readonly"); // 追加
  
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // ホワイトリストチェック
    const whitelisted = await isUserWhitelisted(user.email);
    if (!whitelisted) {
      await signOut(auth);
      alert(`アクセス権限がありません (${user.email})\n管理者に利用許可を依頼してください。`);
      throw new Error("Unauthorized user");
    }

    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (token) {
      await saveUserToken(user.uid, token, user.email);
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
