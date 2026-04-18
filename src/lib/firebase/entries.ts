import { 
  collection, 
  doc, 
  getDoc, 
  setDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp 
} from "firebase/firestore";
import { db as serverDb } from "./config";

export interface DiaryEntry {
  userId: string;
  date: string; // YYYY-MM-DD
  rawText: string;
  segments: {
    home: string;
    work: string;
    hobby: string;
  };
  keywords?: string[]; // AI抽出キーワード
  healthData?: {
    morning?: { 
      comment?: string;
      weight?: number; 
      bloodPressure?: string; // "上/下" の形式
      sleepHours?: number;
      medsCompleted?: boolean;
    };
    evening?: { 
      comment?: string;
      weight?: number; 
      bloodPressure?: string; 
      medsCompleted?: boolean;
    };
  };
  responses: {
    c1?: string;
    c2?: string;
    c3?: string;
    c4?: string;
  };
  photos?: string[];
  updatedAt?: Timestamp;
}

const COLLECTION_NAME = "entries";

// ドキュメントIDを生成 (userId_YYYY-MM-DD)
const getEntryId = (userId: string, date: string) => `${userId}_${date}`;

export const getDiaryEntry = async (userId: string, date: string): Promise<DiaryEntry | null> => {
  try {
    const docRef = doc(serverDb, COLLECTION_NAME, getEntryId(userId, date));
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as DiaryEntry;
    }
    return null;
  } catch (error) {
    console.error("getDiaryEntry failed:", error);
    return null;
  }
};

export const saveDiaryEntry = async (entry: Partial<DiaryEntry> & { userId: string, date: string }) => {
  try {
    const entryId = getEntryId(entry.userId, entry.date);
    const docRef = doc(serverDb, COLLECTION_NAME, entryId);
    const data = {
      ...entry,
      updatedAt: Timestamp.now()
    };
    return await setDoc(docRef, data, { merge: true });
  } catch (error) {
    console.error("saveDiaryEntry failed:", error);
    throw error;
  }
};

export const getRecentEntries = async (userId: string, count: number = 10): Promise<DiaryEntry[]> => {
  try {
    const q = query(
      collection(serverDb, COLLECTION_NAME),
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);
    const results = querySnapshot.docs.map(doc => doc.data() as DiaryEntry);
    
    // メモリ内でソートして制限
    return results
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, count);
  } catch (error) {
    console.error("getRecentEntries failed:", error);
    return [];
  }
};
