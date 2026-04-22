"use server";

import { uploadMarkdownToDrive } from "@/lib/google/drive";
import { organizeDiary, chatWithCompanion } from "@/lib/ai/huddle";
import { fetchDailyCalendarEvents } from "@/lib/google/calendar";
import { fetchDailyTasks } from "@/lib/google/tasks";
import { ChatMessage } from "@/lib/firebase/chat";
import { searchDiaryEntries } from "@/lib/firebase/entries";
import { generateEmbedding } from "@/lib/ai/gemini";
import { getDictionary } from "@/lib/firebase/dictionary";
import { refreshGoogleAccessToken, exchangeCodeForTokens } from "@/lib/google/oauth";
import { getUserTokens, saveUserToken } from "@/lib/firebase/tokens";

// ============================================================
// バックアップ
// ============================================================
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

// ============================================================
// トークン自動更新ヘルパー
// ============================================================

/**
 * 認可コードをトークンに交換し、Firestoreに保存する
 */
export async function exchangeAuthCodeAction(
  userId: string,
  code: string,
  redirectUri: string,
  email?: string | null
) {
  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    // access_token は必ず返るが、refresh_token は初回のみ返る場合がある
    await saveUserToken(
      userId,
      tokens.access_token,
      tokens.refresh_token,
      email
    );
    return { success: true, accessToken: tokens.access_token };
  } catch (error: any) {
    console.error("exchangeAuthCodeAction failed:", error);
    return { success: false, error: error.message };
  }
}

/**
 * トークンを自動更新してアクションを再試行するためのヘルパー
 */
async function withTokenRefresh<T>(
  userId: string,
  initialToken: string | null,
  action: (token: string | null) => Promise<T>
): Promise<T> {
  try {
    return await action(initialToken);
  } catch (error: any) {
    // 401 または 403 エラーの場合のみリフレッシュを試みる
    const isAuthError =
      error.message?.includes("GOOGLE_API_ERROR: 401") ||
      error.message?.includes("GOOGLE_API_ERROR: 403");

    if (isAuthError) {
      const tokens = await getUserTokens(userId);
      if (tokens?.refreshToken) {
        console.log("Attempting to refresh Google access token for user:", userId);
        const newAccessToken = await refreshGoogleAccessToken(tokens.refreshToken);

        if (newAccessToken) {
          // 新しいトークンを保存（リフレッシュトークンは維持）
          await saveUserToken(userId, newAccessToken);

          // 新しいトークンで再試行
          console.log("Token refreshed. Retrying action...");
          return await action(newAccessToken);
        }
      }
    }
    // リフレッシュできない場合や別のエラーの場合はそのまま投げる
    throw error;
  }
}

// ============================================================
// 日記整理
// ============================================================
type OrganizeDiaryResult =
  | { success: true; data: any; embedding: number[] }
  | { success: false; error: string };

export async function organizeDiaryAction(
  userId: string,
  rawText: string,
  contextStrings: {
    dictionaryContext: string;
  },
  googleToken: string | null,
  dateStr: string
): Promise<OrganizeDiaryResult> {
  return withTokenRefresh(userId, googleToken, async (token): Promise<OrganizeDiaryResult> => {
    try {
      let calendarContext = "なし";
      if (token) {
        const [events, tasks] = await Promise.all([
          fetchDailyCalendarEvents(token, dateStr),
          fetchDailyTasks(token, dateStr),
        ]);
        const eventStrs = events.map(
          (e) => `- [予定] ${e.start}〜${e.end}: ${e.summary}`
        );
        const taskStrs = tasks.map((t) => `- [タスク] ${t.title}`);
        if (eventStrs.length > 0 || taskStrs.length > 0) {
          calendarContext = [...eventStrs, ...taskStrs].join("\n");
        }
      }

      const [result, embedding] = await Promise.all([
        organizeDiary(rawText, contextStrings.dictionaryContext, calendarContext),
        generateEmbedding(rawText),
      ]);

      return { success: true, data: result, embedding };
    } catch (error: any) {
      console.error("organizeDiaryAction internal failed:", error);
      if (
        error.message?.includes("GOOGLE_API_ERROR: 401") ||
        error.message?.includes("GOOGLE_API_ERROR: 403")
      ) {
        // withTokenRefresh が再度キャッチしてリフレッシュを試みるよう throw する
        throw error;
      }
      return { success: false, error: error.message };
    }
  }).catch((error: any): OrganizeDiaryResult => ({
    success: false,
    error: error.message?.includes("GOOGLE_API_ERROR")
      ? "Googleの認証が切れており、自動更新にも失敗しました。右上のアイコンから再ログインしてください。"
      : error.message,
  }));
}

// ============================================================
// AIチャット
// ============================================================
type ChatWithAIResult =
  | { success: true; replies: ChatMessage[]; calendarError?: boolean; toolCall?: { name: string; args: any } }
  | { success: false; error: string };

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
): Promise<ChatWithAIResult> {
  return withTokenRefresh<ChatWithAIResult>(userId, googleToken, async (token) => {
    try {
      // カレンダーの予定とタスクを取得
      let calendarContext = "予定・タスクなし";
      let calendarError = false;

      if (token) {
        try {
          const [events, tasks] = await Promise.all([
            fetchDailyCalendarEvents(token, dateStr),
            fetchDailyTasks(token, dateStr),
          ]);

          const eventStrs = events.map(
            (e) => `- [予定] ${e.start}〜${e.end}: ${e.summary}`
          );
          const taskStrs = tasks.map(
            (t) =>
              `- [タスク] ${t.title}${t.due ? ` (期限: ${t.due})` : ""}`
          );

          const combined = [...eventStrs, ...taskStrs];
          if (combined.length > 0) {
            calendarContext = combined.join("\n");
          }
        } catch (e: any) {
          if (
            e.message?.includes("GOOGLE_API_ERROR: 401") ||
            e.message?.includes("GOOGLE_API_ERROR: 403")
          ) {
            // withTokenRefresh がキャッチしてリフレッシュを試みる
            throw e;
          }
          // その他のエラーはカレンダーなしで継続
          calendarError = true;
        }
      }

      // AI軍師たちの順次回答 (MAMO -> WAKU -> LOG -> ZEN)
      const personas: ("mamo" | "waku" | "log" | "zen")[] = [
        "mamo",
        "waku",
        "log",
        "zen",
      ];
      let currentHistory = [...history];
      const replies: ChatMessage[] = [];

      // ユーザーのメッセージを履歴に追加（一時的）
      const userMsg: ChatMessage = {
        role: "user",
        content: message,
        createdAt: new Date() as any,
      };

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
                {
                  role: "model",
                  content: `${args.date}の日記を表示します。`,
                  agentId: aiResult.agentId,
                  createdAt: new Date() as any,
                },
              ],
              toolCall: aiResult.toolCall,
            };
          }

          if (name === "search_past_diary") {
            const queryVector = await generateEmbedding(args.query);
            const searchResults = await searchDiaryEntries(
              userId,
              args.query,
              queryVector
            );
            const searchSummary =
              searchResults.length > 0
                ? searchResults
                    .map(
                      (r) =>
                        `【${r.date}】 ${r.rawText.substring(0, 200)}`
                    )
                    .join("\n---\n")
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
            createdAt: new Date() as any,
          };
          replies.push(aiMsg);
          // 次のペルソナがこの発言を読めるように履歴に追加
          currentHistory = [...currentHistory, aiMsg];
        }
      }

      return { success: true, replies, calendarError };
    } catch (error: any) {
      console.error("chatWithAIAction internal failed:", error);
      throw error;
    }
  }).catch((error: any): ChatWithAIResult => ({ success: false, error: error.message }));
}

// ============================================================
// Googleカレンダー・タスク取得（クライアントコンポーネント用）
// ============================================================
type GetCalendarResult =
  | { success: true; events: any[]; tasks: any[] }
  | { success: false; error: string; isAuthError?: boolean; events?: never; tasks?: never };

export async function getGoogleCalendarAndTasksAction(
  userId: string,
  googleToken: string | null,
  dateStr: string
): Promise<GetCalendarResult> {
  return withTokenRefresh<GetCalendarResult>(userId, googleToken, async (token) => {
    try {
      if (!token) return { success: false, error: "No token" };

      const [events, tasks] = await Promise.all([
        fetchDailyCalendarEvents(token, dateStr),
        fetchDailyTasks(token, dateStr),
      ]);

      return { success: true, events, tasks };
    } catch (error: any) {
      console.error("getGoogleCalendarAndTasksAction error:", error);
      throw error; // withTokenRefresh でリフレッシュを試みる
    }
  }).catch((error: any): GetCalendarResult => ({
    success: false,
    error: error.message || "Unknown Error",
    isAuthError:
      error.message?.includes("401") || error.message?.includes("403"),
  }));
}

// ============================================================
// その他のアクション
// ============================================================

/**
 * 検索用に全日記データを取得する（クライアント側で取得するため空を返す）
 */
export async function getAllDiaryEntriesSummaryAction(userId: string) {
  return {
    success: false,
    error: "Server-side admin access disabled. Use client-side search instead.",
  };
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
