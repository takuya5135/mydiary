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
import { db } from "./config";

export interface DiaryEntry {
  userId: string;
  date: string; // YYYY-MM-DD
  rawText: string;
  segments: {
    home: string;
    work: string;
    hobby: string;
  };
  healthData?: {
    morning?: { temperature?: number; bloodPressure?: string; mood?: number };
    evening?: { temperature?: number; bloodPressure?: string; mood?: number };
    medsCompleted?: boolean;
  };
  responses: {
    c1?: string;
    c2?: string;
    c3?: string;
    c4?: string;
  };
  photos?: string[];
  updatedAt: Timestamp;
}

const COLLECTION_NAME = "entries";

// ドキュメントIDを生成 (userId_YYYY-MM-DD)
const getEntryId = (userId: string, date: string) => `${userId}_${date}`;

export const getDiaryEntry = async (userId: string, date: string): Promise<DiaryEntry | null> => {
  const docRef = doc(db, COLLECTION_NAME, getEntryId(userId, date));
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data() as DiaryEntry;
  }
  return null;
};

export const saveDiaryEntry = async (entry: Partial<DiaryEntry> & { userId: string, date: string }) => {
  const entryId = getEntryId(entry.userId, entry.date);
  const docRef = doc(db, COLLECTION_NAME, entryId);
  
  const data = {
    ...entry,
    updatedAt: Timestamp.now()
  };

  return await setDoc(docRef, data, { merge: true });
};

export const getRecentEntries = async (userId: string, count: number = 10): Promise<DiaryEntry[]> => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("userId", "==", userId),
    orderBy("date", "desc"),
    limit(count)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as DiaryEntry);
};
