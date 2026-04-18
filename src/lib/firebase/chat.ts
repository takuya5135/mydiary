import { 
  collection, 
  doc, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  Timestamp 
} from "firebase/firestore";
import { db as serverDb } from "./config";

export interface ChatMessage {
  id?: string;
  role: "user" | "model";
  agentId?: "log" | "mamo" | "waku" | "zen";
  content: string;
  createdAt: Timestamp;
}

export const saveChatMessage = async (
  userId: string, 
  role: "user" | "model", 
  content: string,
  agentId?: "log" | "mamo" | "waku" | "zen"
) => {
  try {
    const messagesRef = collection(serverDb, "chats", userId, "messages");
    await addDoc(messagesRef, {
      role,
      content,
      agentId,
      createdAt: Timestamp.now()
    });
  } catch (error: any) {
    console.error("saveChatMessage error detail:", {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
};

export const getRecentChatMessages = async (userId: string, count: number = 30): Promise<ChatMessage[]> => {
  try {
    const messagesRef = collection(serverDb, "chats", userId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "desc"), limit(count));
    const qs = await getDocs(q);
    
    // 取得したものは新しい順(desc)なので、古い順に直して返す
    const messages = qs.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ChatMessage[];
    
    return messages.reverse();
  } catch (error: any) {
    console.error("getRecentChatMessages error detail:", {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    return [];
  }
};
