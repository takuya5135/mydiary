import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User 
} from "firebase/auth";
import { auth } from "./config";
import { saveUserToken } from "./tokens";

export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  // Add necessary scopes for Phase 3
  provider.addScope("https://www.googleapis.com/auth/drive.file");
  provider.addScope("https://www.googleapis.com/auth/photolibrary.readonly");
  
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;
    const user = result.user;

    if (token) {
      // Save token to Firestore for server-side/background API use
      await saveUserToken(user.uid, token);
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
