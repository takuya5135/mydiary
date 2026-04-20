import { doc, updateDoc, setDoc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "./config";

const COLLECTION_NAME = "users";

export const saveUserToken = async (userId: string, accessToken: string, email?: string | null) => {
  const userRef = doc(db, COLLECTION_NAME, userId);
  const data: any = {
    googleAccessToken: accessToken,
    tokenUpdatedAt: Timestamp.now()
  };

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

export const getUserToken = async (userId: string): Promise<string | null> => {
  const userRef = doc(db, COLLECTION_NAME, userId);
  try {
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      return userDoc.data().googleAccessToken || null;
    }
    return null;
  } catch (error) {
    console.error("Error fetching token:", error);
    return null;
  }
};
