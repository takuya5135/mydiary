import { doc, updateDoc, setDoc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "./config";

const COLLECTION_NAME = "users";

export const saveUserToken = async (
  userId: string, 
  accessToken: string, 
  refreshToken?: string, 
  email?: string | null
) => {
  const userRef = doc(db, COLLECTION_NAME, userId);
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
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      await updateDoc(userRef, data);
    } else {
      await setDoc(userRef, data);
    }
  } catch (error) {
    console.error("Error saving token:", error);
    throw error;
  }
};

export interface UserTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

export const getUserTokens = async (userId: string): Promise<UserTokens | null> => {
  const userRef = doc(db, COLLECTION_NAME, userId);
  try {
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        accessToken: data.googleAccessToken || null,
        refreshToken: data.googleRefreshToken || null
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching tokens:", error);
    return null;
  }
};

export const getUserToken = async (userId: string): Promise<string | null> => {
  const tokens = await getUserTokens(userId);
  return tokens?.accessToken || null;
};

