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
import { ChatMessage, saveChatMessage } from "@/lib/firebase/chat";
import { searchDiaryEntries } from "@/lib/firebase/entries";
import { generateEmbedding } from "@/lib/ai/gemini";

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

    // AIに問い合わせ
    let aiResult = await chatWithCompanion(
      message,
      history,
      contextStrings.pastContext,
      contextStrings.bucketListContext,
      contextStrings.dictionaryContext,
      contextStrings.profileContext,
      calendarContext,
      contextStrings.todaysDiaryContext,
      persona
    );

    // ツール呼び出しのハンドリング
    if (aiResult.toolCall) {
      const { name, args } = aiResult.toolCall;
      
      if (name === "search_past_diary") {
        const queryVector = await generateEmbedding(args.query);
        const searchResults = await searchDiaryEntries(userId, args.query, queryVector);
        const searchSummary = searchResults.length > 0 
          ? searchResults.map(r => `【${r.date}】 ${r.rawText.substring(0, 100)}...`).join("\n")
          : "該当する記録は見つかりませんでした。";
        
        // 検索結果をコンテキストに含めて再度AIに回答させる
        aiResult = await chatWithCompanion(
          `以下の検索結果に基づいてユーザーに応答してください:\n${searchSummary}`,
          history,
          contextStrings.pastContext,
          contextStrings.bucketListContext,
          contextStrings.dictionaryContext,
          contextStrings.profileContext,
          calendarContext,
          contextStrings.todaysDiaryContext,
          persona
        );
      } else if (name === "jump_to_date") {
        // ジャンプの場合は、ツール情報をそのままフロントエンドに返し、フロントエンド側で遷移させる
        return {
          success: true,
          reply: `${args.date}の日記を表示します。`,
          agentId: aiResult.agentId,
          toolCall: aiResult.toolCall
        };
      }
    }

    return { 
      success: true, 
      reply: aiResult.reply, 
      agentId: aiResult.agentId,
      calendarError,
      toolCall: aiResult.toolCall
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
    // 403エラー（API無効化など）の情報をフロントへ流す
    return { 
      success: false, 
      error: error.message || "Unknown Error",
      isAuthError: error.message?.includes("401") || error.message?.includes("403")
    };
  }
}
