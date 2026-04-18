"use server";

import { runAIHuddle } from "@/lib/ai/huddle";
import { getBucketList } from "@/lib/firebase/bucketList";
import { getDictionary } from "@/lib/firebase/dictionary";
import { DiaryEntry, saveDiaryEntry, getRecentEntries, getDiaryEntry } from "@/lib/firebase/entries";
import { getUserToken } from "@/lib/firebase/tokens";
import { fetchPhotosByDate, GooglePhoto } from "@/lib/google/photos";
import { uploadMarkdownToDrive } from "@/lib/google/drive";
import { format } from "date-fns";

export async function backupToDriveAction(userId: string, date: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Fetch entry
    const entry = await getDiaryEntry(userId, date);
    if (!entry) {
      return { success: false, error: "No entry found for this date." };
    }

    // 2. Fetch token
    const token = await getUserToken(userId);
    if (!token) {
      return { success: false, error: "Auth token not found." };
    }

    // 3. Generate Markdown content (EXCLUDING AI responses as per user request)
    const mdContent = `
# ${date} (my日記)

## 記録内容
### Home
${entry.segments.home || "なし"}

### Work
${entry.segments.work || "なし"}

### Hobby
${entry.segments.hobby || "なし"}

## 原文
${entry.rawText}

---
Updated at: ${entry.updatedAt.toDate().toLocaleString()}
`.trim();

    // 4. Upload to Drive
    const fileName = `${date}_diary.md`;
    await uploadMarkdownToDrive(token, fileName, mdContent);

    return { success: true };
  } catch (error) {
    console.error("backupToDriveAction failed:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getPhotosAction(userId: string, date: string): Promise<{ success: boolean; data?: GooglePhoto[]; error?: string }> {
  try {
    const token = await getUserToken(userId);
    if (!token) {
      return { success: false, error: "Authentication token not found. Please log in again." };
    }
    const photos = await fetchPhotosByDate(token, date);
    return { success: true, data: photos };
  } catch (error) {
    console.error("getPhotosAction failed:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function executeHuddleAction(
  userId: string, 
  date: string, 
  rawText: string
) {
  try {
    // 1. Context Fetching (Bucket List & Dictionary)
    const bucketList = await getBucketList(userId);
    const dictionary = await getDictionary(userId);
    
    // 2. Context Fetching (Past Entries for Mamo)
    const pastEntries = await getRecentEntries(userId, 5); 

    // 3. Run AI Huddle
    const huddleResult = await runAIHuddle(userId, rawText, pastEntries, bucketList, dictionary);

    // 4. Save to Firestore
    await saveDiaryEntry({
      userId,
      date,
      rawText,
      segments: huddleResult.segments,
      responses: huddleResult.responses
    });

    return { success: true, data: huddleResult };
  } catch (error) {
    console.error("executeHuddleAction failed:", error);
    return { success: false, error: (error as Error).message };
  }
}
