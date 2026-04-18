"use server";

import { runAIHuddle } from "@/lib/ai/huddle";
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

export async function executeHuddleAction(
  rawText: string,
  contextStrings: {
    bucketListContext: string;
    dictionaryContext: string;
    pastContext: string;
    profileContext?: string;
  }
) {
  try {
    // DBアクセスを行わず、渡されたコンテキスト文字列を使ってGeminiを実行する
    const huddleResult = await runAIHuddle(
      rawText, 
      contextStrings.pastContext, 
      contextStrings.bucketListContext, 
      contextStrings.dictionaryContext,
      contextStrings.profileContext
    );

    return { success: true, data: huddleResult };
  } catch (error: any) {
    console.error("executeHuddleAction failed:", error);
    
    let availableModelsStr = "";
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
      if (resp.ok) {
        const data = await resp.json();
        const models = data.models
          .filter((m: any) => m.supportedGenerationMethods.includes("generateContent"))
          .map((m: any) => m.name.replace('models/', ''))
          .join(", ");
        availableModelsStr = `\n利用可能なモデル一覧: ${models}`;
      }
    } catch (_) {
      // 取得エラー時は無視
    }

    return { success: false, error: error.message + availableModelsStr };
  }
}
