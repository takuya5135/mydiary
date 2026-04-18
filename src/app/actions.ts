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
  dateStr: string
) {
  try {
    // カレンダーの予定を取得
    let calendarContext = "予定なし";
    if (googleToken) {
      const events = await fetchDailyCalendarEvents(googleToken, dateStr);
      if (events.length > 0) {
        calendarContext = events.map(e => `- ${e.start}〜${e.end}: ${e.summary}`).join("\n");
      }
    }

    // AIに問い合わせ
    const replyText = await chatWithCompanion(
      message,
      history,
      contextStrings.pastContext,
      contextStrings.bucketListContext,
      contextStrings.dictionaryContext,
      contextStrings.profileContext,
      calendarContext,
      contextStrings.todaysDiaryContext
    );

    // AIの返信を返すだけにする（保存はクライアント側で行う）
    return { success: true, reply: replyText };
  } catch (error: any) {
    console.error("chatWithAIAction failed:", error);
    return { success: false, error: error.message };
  }
}
