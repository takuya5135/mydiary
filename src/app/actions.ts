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
import { ChatMessage, saveChatMessage } from "@/lib/firebase/chat";

export async function organizeDiaryAction(
  rawText: string,
  contextStrings: {
    dictionaryContext: string;
  }
) {
  try {
    const result = await organizeDiary(rawText, contextStrings.dictionaryContext);
    return { success: true, data: result };
  } catch (error: any) {
    console.error("organizeDiaryAction failed:", error);
    let availableModelsStr = "";
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
      if (resp.ok) {
        const data = await resp.json();
        const models = data.models
          .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
          .map((m: any) => m.name.replace('models/', ''))
          .join(", ");
        availableModelsStr = `\n利用可能なモデル一覧: ${models}`;
      }
    } catch (_) {}
    return { success: false, error: error.message + availableModelsStr };
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
          // @ts-ignore
          import("@/lib/google/tasks").then(mod => mod.fetchDailyTasks(googleToken))
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
    const aiResult = await chatWithCompanion(
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

    // AIの返信と人格IDを返す
    return { 
      success: true, 
      reply: aiResult.reply, 
      agentId: aiResult.agentId,
      calendarError
    };
  } catch (error: any) {
    console.error("chatWithAIAction failed:", error);
    return { success: false, error: error.message };
  }
}
