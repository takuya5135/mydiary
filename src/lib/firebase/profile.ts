import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./config";

export interface UserProfile {
  userId: string;
  birthDate?: string;
  origin?: string;
  school?: string;
  company?: string;
  jobTitle?: string;
  medicalHistory?: string; // 持病・アレルギーなど
  familyStructure?: string;
  memo?: string;
}

const COLLECTION_NAME = "profiles";

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch user profile:", error);
    return null;
  }
};

export const saveUserProfile = async (userId: string, profile: Partial<UserProfile>) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId);
    await setDoc(docRef, { ...profile, userId }, { merge: true });
  } catch (error) {
    console.error("Failed to save user profile:", error);
    throw error;
  }
};
