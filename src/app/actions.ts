"use server";

import { uploadToDrive } from "@/lib/google/drive";
import { syncUnsyncedEntriesToDrive } from "@/lib/google/sync";
import { organizeDiary, chatWithCompanion } from "@/lib/ai/huddle";
import { fetchDailyCalendarEvents } from "@/lib/google/calendar";
import { fetchDailyTasks } from "@/lib/google/tasks";
import { ChatMessage } from "@/lib/firebase/chat";
import { searchDiaryEntries } from "@/lib/firebase/entries";
import { generateEmbedding } from "@/lib/ai/gemini";
import { getDictionary } from "@/lib/firebase/dictionary";
import { refreshGoogleAccessToken, exchangeCodeForTokens } from "@/lib/google/oauth";
import { getUserTokensAdmin, saveUserTokenAdmin } from "@/lib/firebase/server-tokens";

// ============================================================
// バックアップ
// ============================================================

/**
 * 未同期の日記を Google Drive へ一括バックアップ・更新する
 */
export async function syncBackupAction(
  userId: string,
  googleToken: string | null
): Promise<{ success: boolean; error?: string }> {
  return withTokenRefresh(userId, googleToken, async (token) => {
    try {
      if (!token) throw new Error("GOOGLE_API_ERROR: MISSING_TOKEN");
      await syncUnsyncedEntriesToDrive(userId, token);
      return { success: true };
    } catch (error: any) {
      console.error("syncBackupAction internal failed:", error);
      throw error;
    }
  }).catch((error: any) => {
    console.error("syncBackupAction failed:", error);
    return { success: false, error: error.message };
  });
}

export async function backupToDriveAction(
  userId: string,
  googleToken: string | null,
  fileName: string,
  mdContent: string
): Promise<{ success: boolean; error?: string }> {
  return withTokenRefresh(userId, googleToken, async (token) => {
    try {
      if (!token) throw new Error("GOOGLE_API_ERROR: MISSING_TOKEN");
      await uploadToDrive(token, fileName, mdContent);
      return { success: true };
    } catch (error: any) {
      console.error("backupToDriveAction internal failed:", error);
      throw error;
    }
  }).catch((error: any) => {
    console.error("backupToDriveAction failed:", error);
    let errorMessage = error.message;
    if (error.message?.includes("NO_REFRESH_TOKEN")) {
      errorMessage = "Google連携が必要です。右上のアイコンから再ログインしてください。";
    } else if (error.message?.includes("REFRESH_FAILED")) {
      errorMessage = "認証情報の更新に失敗しました。再ログインをお願いします。";
    }
    return { success: false, error: errorMessage };
  });
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
): Promise<{ success: true; accessToken: string; refreshToken?: string } | { success: false; error: string }> {
  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    
    // Admin SDK を使用してサーバー側で安全に保存
    await saveUserTokenAdmin(
      userId, 
      tokens.access_token, 
      tokens.refresh_token, 
      email
    );

    return { 
      success: true, 
      accessToken: tokens.access_token, 
      refreshToken: tokens.refresh_token 
    };
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
  let currentToken = initialToken;

  // トークンが渡されていない場合、まずは Firestore から取得し、必要なら即座にリフレッシュを試みる
  if (!currentToken) {
    console.log(`[AuthRefresh] No token provided for user: ${userId}. Checking Firestore...`);
    const tokens = await getUserTokensAdmin(userId);
    currentToken = tokens?.accessToken || null;

    if (!currentToken && tokens?.refreshToken) {
      console.log(`[AuthRefresh] No access_token but refresh_token exists. Attempting silent refresh...`);
      currentToken = await refreshGoogleAccessToken(tokens.refreshToken);
      if (currentToken) {
        await saveUserTokenAdmin(userId, currentToken);
      }
    }
  }

  try {
    return await action(currentToken);
  } catch (error: any) {
    // 401 または 403 エラーの場合のみリフレッシュを試みる
    const isAuthError =
      error.message?.includes("GOOGLE_API_ERROR: 401") ||
      error.message?.includes("GOOGLE_API_ERROR: 403") ||
      // トークンが元々ない場合も、リフレッシュトークンがあれば更新を試みる価値がある
      (!currentToken && (error.message?.includes("No token") || error.message?.includes("MISSING_TOKEN")));

    if (isAuthError) {
      console.log(`[AuthRefresh] Authentication error detected (isAuthError=true). Attempting recovery for user: ${userId}`);
      const tokens = await getUserTokensAdmin(userId);
      
      if (tokens?.refreshToken) {
        console.log(`[AuthRefresh] Found refresh_token in Firestore. Attempting Google token refresh...`);
        const newAccessToken = await refreshGoogleAccessToken(tokens.refreshToken);

        if (newAccessToken) {
          console.log(`[AuthRefresh] Successfully obtained new access_token. Saving to Firestore...`);
          // 新しいトークンを保存（Admin SDK を使用）
          await saveUserTokenAdmin(userId, newAccessToken);

          // 新しいトークンで再試行
          console.log("[AuthRefresh] Token updated in Firestore. Retrying original action...");
          return await action(newAccessToken);
        } else {
          console.error(`[AuthRefresh] Google token refresh failed. refresh_token might be expired or revoked.`);
          throw new Error("GOOGLE_API_ERROR: REFRESH_FAILED (Invalid refresh token)");
        }
      } else {
        console.warn(`[AuthRefresh] Recovery impossible: No refresh_token found in Firestore for user: ${userId}. User must re-authenticate with prompt=consent.`);
        throw new Error("GOOGLE_API_ERROR: NO_REFRESH_TOKEN");
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
  }).catch((error: any): OrganizeDiaryResult => {
    let errorMessage = error.message;
    if (error.message?.includes("GOOGLE_API_ERROR: NO_REFRESH_TOKEN")) {
      errorMessage = "Googleの認証が切れており、自動更新のための情報が見つかりません。右上のアイコンから再ログインして権限を許可してください。";
    } else if (error.message?.includes("GOOGLE_API_ERROR: REFRESH_FAILED")) {
      errorMessage = "Googleの認証情報の更新に失敗しました。お手数ですが右上のアイコンから再ログインをお願いします。";
    } else if (error.message?.includes("GOOGLE_API_ERROR")) {
      errorMessage = "Googleの認証に問題が発生しました。再度ログインを試みてください。";
    }
    return { success: false, error: errorMessage };
  });
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
      if (!token) throw new Error("GOOGLE_API_ERROR: MISSING_TOKEN");

      const [events, tasks] = await Promise.all([
        fetchDailyCalendarEvents(token, dateStr),
        fetchDailyTasks(token, dateStr),
      ]);

      return { success: true, events, tasks };
    } catch (error: any) {
      console.error("getGoogleCalendarAndTasksAction error:", error);
      throw error; // withTokenRefresh でリフレッシュを試みる
    }
  }).catch((error: any): GetCalendarResult => {
    let errorMessage = error.message || "Unknown Error";
    let isAuthError = error.message?.includes("401") || error.message?.includes("403") || error.message?.includes("GOOGLE_API_ERROR");

    if (error.message?.includes("NO_REFRESH_TOKEN") || error.message?.includes("REFRESH_FAILED")) {
      errorMessage = "認証の有効期限が切れました。再ログインが必要です。";
    }

    return {
      success: false,
      error: errorMessage,
      isAuthError
    };
  });
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
