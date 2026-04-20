"use server";

import { uploadMarkdownToDrive } from "@/lib/google/drive";

export async function backupToDriveAction(
  token: string, 
  fileName: string, 
  mdContent: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await uploadMarkdownToDrive(token, fileName, mdContent);
    return { success: true };
  } catch (error) {
    console.error("backupToDriveAction failed:", error);
    return { success: false, error: (error as Error).message };
  }
}

import { organizeDiary, chatWithCompanion } from "@/lib/ai/huddle";
import { fetchDailyCalendarEvents } from "@/lib/google/calendar";
import { fetchDailyTasks } from "@/lib/google/tasks";
import { ChatMessage, saveChatMessage, deleteChatHistory } from "@/lib/firebase/chat";
import { searchDiaryEntries } from "@/lib/firebase/entries";
import { generateEmbedding } from "@/lib/ai/gemini";
import { getDictionary } from "@/lib/firebase/dictionary";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db as serverDb } from "@/lib/firebase/config";

export async function organizeDiaryAction(
  rawText: string,
  contextStrings: {
    dictionaryContext: string;
  },
  googleToken: string | null,
  dateStr: string
) {
  try {
    let calendarContext = "なし";
    if (googleToken) {
      const [events, tasks] = await Promise.all([
        fetchDailyCalendarEvents(googleToken, dateStr),
        fetchDailyTasks(googleToken, dateStr)
      ]);
      const eventStrs = events.map(e => `- [予定] ${e.start}〜${e.end}: ${e.summary}`);
      const taskStrs = tasks.map(t => `- [タスク] ${t.title}`);
      if (eventStrs.length > 0 || taskStrs.length > 0) {
        calendarContext = [...eventStrs, ...taskStrs].join("\n");
      }
    }

    const [result, embedding] = await Promise.all([
      organizeDiary(rawText, contextStrings.dictionaryContext, calendarContext),
      generateEmbedding(rawText)
    ]);

    return { success: true, data: result, embedding };
  } catch (error: any) {
    console.error("organizeDiaryAction failed:", error);
    return { success: false, error: error.message };
  }
}

export async function chatWithAIAction(
  userId: string,
  message: string,
  history: ChatMessage[],
  contextStrings: {
    bucketListContext: string;
    dictionaryContext: string;
    pastContext: string;
    profileContext: string;
    todaysDiaryContext: string;
  },
  googleToken: string | null,
  dateStr: string,
  persona?: "log" | "mamo" | "waku" | "zen"
) {
  try {
    // カレンダーの予定とタスクを取得
    let calendarContext = "予定・タスクなし";
    let calendarError = false;
    
    if (googleToken) {
      try {
        const [events, tasks] = await Promise.all([
          fetchDailyCalendarEvents(googleToken, dateStr),
          fetchDailyTasks(googleToken, dateStr)
        ]);

        const eventStrs = events.map(e => `- [予定] ${e.start}〜${e.end}: ${e.summary}`);
        const taskStrs = tasks.map(t => `- [タスク] ${t.title}${t.due ? ` (期限: ${t.due})` : ""}`);
        
        const combined = [...eventStrs, ...taskStrs];
        if (combined.length > 0) {
          calendarContext = combined.join("\n");
        }
      } catch (e: any) {
        if (e.message === "GOOGLE_CALENDAR_UNAUTHORIZED") {
          calendarContext = "【重要】Google関連の認証が切れています。ユーザーに再ログインを促してください。";
          calendarError = true;
        }
      }
    }

    // AI軍師たちの順次回答 (MAMO -> WAKU -> LOG -> ZEN)
    const personas: ("mamo" | "waku" | "log" | "zen")[] = ["mamo", "waku", "log", "zen"];
    let currentHistory = [...history];
    const replies: ChatMessage[] = [];

    // ユーザーのメッセージを履歴に追加（一時的）
    const userMsg: ChatMessage = { role: "user", content: message, createdAt: new Date() as any };

    for (const p of personas) {
      let aiResult;
      let loopCount = 0;
      let personaMessage = message;

      // 各ペルソナがツール（検索など）を使う可能性を考慮してループ
      while (loopCount < 3) {
        aiResult = await chatWithCompanion(
          personaMessage,
          [...currentHistory, userMsg],
          contextStrings.pastContext,
          contextStrings.bucketListContext,
          contextStrings.dictionaryContext,
          contextStrings.profileContext,
          calendarContext,
          contextStrings.todaysDiaryContext,
          p
        );

        if (!aiResult.toolCall) break;

        const { name, args } = aiResult.toolCall;
        
        if (name === "jump_to_date") {
          // ジャンプの場合はその時点で終了し、フロントへ返す
          return {
            success: true,
            replies: [
              ...replies,
              { role: "model", content: `${args.date}の日記を表示します。`, agentId: aiResult.agentId, createdAt: new Date() as any }
            ],
            toolCall: aiResult.toolCall
          };
        }

        if (name === "search_past_diary") {
          const queryVector = await generateEmbedding(args.query);
          const searchResults = await searchDiaryEntries(userId, args.query, queryVector);
          const searchSummary = searchResults.length > 0 
            ? searchResults.map(r => `【${r.date}】 ${r.rawText.substring(0, 200)}`).join("\n---\n")
            : "該当する記録は見つかりませんでした。";
          
          personaMessage = `以下の検索結果に基づいて回答してください:\n${searchSummary}`;
          loopCount++;
        } else {
          break;
        }
      }

      if (aiResult) {
        const aiMsg: ChatMessage = { 
          role: "model", 
          content: aiResult.reply, 
          agentId: aiResult.agentId, 
          createdAt: new Date() as any 
        };
        replies.push(aiMsg);
        // 次のペルソナがこの発言を読めるように履歴に追加
        currentHistory = [...currentHistory, aiMsg];
      }
    }

    return { 
      success: true, 
      replies, 
      calendarError
    };
  } catch (error: any) {
    console.error("chatWithAIAction failed:", error);
    return { success: false, error: error.message };
  }
}

/**
 * クライアントコンポーネント用。Googleカレンダーとタスクを取得する
 */
export async function getGoogleCalendarAndTasksAction(googleToken: string, dateStr: string) {
  try {
    const [events, tasks] = await Promise.all([
      fetchDailyCalendarEvents(googleToken, dateStr),
      fetchDailyTasks(googleToken, dateStr)
    ]);

    return {
      success: true,
      events,
      tasks
    };
  } catch (error: any) {
    console.error("getGoogleCalendarAndTasksAction error:", error);
    return { 
      success: false, 
      error: error.message || "Unknown Error",
      isAuthError: error.message?.includes("401") || error.message?.includes("403")
    };
  }
}

/**
 * 検索用に全日記データを取得する (サーバー側で一度に取得)
 */
export async function getAllDiaryEntriesSummaryAction(userId: string) {
  try {
    const q = query(
      collection(serverDb, "entries"),
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);
    // @ts-ignore
    const entries = querySnapshot.docs.map(doc => doc.data());
    
    return {
      success: true,
      entries
    };
  } catch (error: any) {
    console.error("getAllDiaryEntriesSummaryAction error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * 検索用に辞書データを取得する
 */
export async function getDictionaryAction(userId: string) {
  try {
    const dictionary = await getDictionary(userId);
    return { success: true, dictionary };
  } catch (error: any) {
    console.error("getDictionaryAction error:", error);
    return { success: false, error: error.message };
  }
}

export async function clearChatAction(userId: string) {
  try {
    await deleteChatHistory(userId);
    return { success: true };
  } catch (error: any) {
    console.error("clearChatAction failed:", error);
    return { success: false, error: error.message };
  }
}
