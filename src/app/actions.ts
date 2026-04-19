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

    // AIに問い合わせ (履歴を管理しながらループ)
    let currentHistory = [...history];
    let currentMessage = message;
    let aiResult;
    let loopCount = 0;

    while (loopCount < 3) {
      aiResult = await chatWithCompanion(
        currentMessage,
        currentHistory,
        contextStrings.pastContext,
        contextStrings.bucketListContext,
        contextStrings.dictionaryContext,
        contextStrings.profileContext,
        calendarContext,
        contextStrings.todaysDiaryContext,
        persona
      );

      // ツール呼び出しがなければ終了
      if (!aiResult.toolCall) break;

      const { name, args } = aiResult.toolCall;
      
      // ジャンプの場合は、ツール情報をそのままフロントエンドに返し、フロントエンド側で遷移させる
      if (name === "jump_to_date") {
        return {
          success: true,
          reply: `${args.date}の日記を表示します。`,
          agentId: aiResult.agentId,
          toolCall: aiResult.toolCall
        };
      }

      if (name === "search_past_diary") {
        const queryVector = await generateEmbedding(args.query);
        const searchResults = await searchDiaryEntries(userId, args.query, queryVector);
        const searchSummary = searchResults.length > 0 
          ? searchResults.map(r => `【${r.date}】 ${r.rawText.substring(0, 200)}`).join("\n---\n")
          : "該当する記録は見つかりませんでした。";
        
        // 履歴を更新してAIに再答させる
        // 1. ユーザーの元の質問を追加
        // 2. AIの「データを取得します」という返答（モデルのターン）を追加
        // 3. 検索結果（ツール出力のターン）を追加してループを回す
        currentHistory = [
          ...currentHistory,
          { role: "user", content: currentMessage, createdAt: new Date() as any },
          { role: "model", content: "データを取得します...", agentId: aiResult.agentId, createdAt: new Date() as any }
        ];
        currentMessage = `以下の検索結果に基づいて回答してください:\n${searchSummary}`;
        loopCount++;
      } else {
        break; // 未知のツール
      }
    }

    if (!aiResult) throw new Error("AI response was empty");

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
