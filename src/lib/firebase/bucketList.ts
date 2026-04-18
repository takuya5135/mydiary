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

export interface BucketItem {
  id?: string;
  userId: string;
  title: string;
  completed: boolean;
  category?: string;
  createdAt: Timestamp;
}

const COLLECTION_NAME = "bucket_list";

export const getBucketList = async (userId: string): Promise<BucketItem[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME), 
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);
    const results = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as BucketItem));
    
    // 作成日時の降順でソート（新しい順）
    return results.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  } catch (error: any) {
    console.error("getBucketList error detail:", {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    return [];
  }
};

export const addBucketItem = async (userId: string, title: string) => {
  return await addDoc(collection(db, COLLECTION_NAME), {
    userId,
    title,
    completed: false,
    createdAt: Timestamp.now()
  });
};

export const toggleBucketItem = async (itemId: string, completed: boolean) => {
  const itemRef = doc(db, COLLECTION_NAME, itemId);
  return await updateDoc(itemRef, { completed });
};

export const deleteBucketItem = async (itemId: string) => {
  const itemRef = doc(db, COLLECTION_NAME, itemId);
  return await deleteDoc(itemRef);
};
