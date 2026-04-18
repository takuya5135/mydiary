import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  deleteDoc,
  orderBy,
  Timestamp 
} from "firebase/firestore";
import { db } from "./config";

export interface DictionaryItem {
  id?: string;
  userId: string;
  name: string;      // 正式名称
  ruby?: string;    // よみがな
  aliases: string[]; // ニックネーム、略称
  category: "person" | "place" | "organization" | "custom";
  attributes?: {
    birthYear?: number;
    birthDate?: string;    // 生年月日 (YYYY-MM-DD or MM-DD)
    origin?: string;
    relationship?: string; // 人物の場合
    memo?: string;
  };
  createdAt: Timestamp;
}

const COLLECTION_NAME = "dictionary";

export const getDictionary = async (userId: string): Promise<DictionaryItem[]> => {
  const q = query(
    collection(db, COLLECTION_NAME), 
    where("userId", "==", userId)
  );
  const querySnapshot = await getDocs(q);
  const results = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as DictionaryItem));

  // 名前順にソート
  return results.sort((a, b) => a.name.localeCompare(b.name, "ja"));
};

import { sanitizeData } from "./utils";

export const upsertDictionaryItem = async (userId: string, item: Partial<DictionaryItem>) => {
  if (item.id) {
    const itemRef = doc(db, COLLECTION_NAME, item.id);
    const data = sanitizeData({ ...item, userId });
    return await updateDoc(itemRef, data);
  } else {
    const data = sanitizeData({
      ...item,
      userId,
      createdAt: Timestamp.now()
    });
    return await addDoc(collection(db, COLLECTION_NAME), data);
  }
};

export const deleteDictionaryItem = async (itemId: string) => {
  const itemRef = doc(db, COLLECTION_NAME, itemId);
  return await deleteDoc(itemRef);
};
