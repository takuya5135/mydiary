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
    where("userId", "==", userId),
    orderBy("name", "asc")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as DictionaryItem));
};

export const upsertDictionaryItem = async (userId: string, item: Partial<DictionaryItem>) => {
  if (item.id) {
    const itemRef = doc(db, COLLECTION_NAME, item.id);
    return await updateDoc(itemRef, { ...item, userId });
  } else {
    return await addDoc(collection(db, COLLECTION_NAME), {
      ...item,
      userId,
      createdAt: Timestamp.now()
    });
  }
};

export const deleteDictionaryItem = async (itemId: string) => {
  const itemRef = doc(db, COLLECTION_NAME, itemId);
  return await deleteDoc(itemRef);
};
