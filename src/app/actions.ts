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
  } catch (error) {
    console.error("executeHuddleAction failed:", error);
    return { success: false, error: (error as Error).message };
  }
}
