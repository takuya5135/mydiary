import { adminDb } from "../firebase/server-config";
import { uploadToDrive } from "./drive";
import { DiaryEntry } from "../firebase/entries";
import { Timestamp } from "firebase-admin/firestore";

/**
 * 日記データをバックアップ用のハイブリッド形式（Markdown + JSON）に変換する
 */
function formatEntryForBackup(entry: DiaryEntry): string {
  const { date, rawText, segments, keywords, healthData, responses } = entry;
  
  let markdown = `# Diary: ${date}\n\n`;
  
  markdown += `## 💡 今日のハイライト\n${rawText || "本文なし"}\n\n`;
  
  markdown += `## 🏠 生活の記録\n`;
  markdown += `- **家庭**: ${segments?.home || "なし"}\n`;
  markdown += `- **仕事**: ${segments?.work || "なし"}\n`;
  markdown += `- **趣味**: ${segments?.hobby || "なし"}\n\n`;
  
  if (keywords && keywords.length > 0) {
    markdown += `## 🏷️ キーワード\n${keywords.join(", ")}\n\n`;
  }
  
  if (healthData) {
    markdown += `## 🩺 健康データ\n`;
    if (healthData.morning) {
      markdown += `### 朝\n`;
      if (healthData.morning.weight) markdown += `- 体重: ${healthData.morning.weight}kg\n`;
      if (healthData.morning.bloodPressure) markdown += `- 血圧: ${healthData.morning.bloodPressure}\n`;
      if (healthData.morning.comment) markdown += `- メモ: ${healthData.morning.comment}\n`;
    }
    if (healthData.evening) {
      markdown += `### 晩\n`;
      if (healthData.evening.weight) markdown += `- 体重: ${healthData.evening.weight}kg\n`;
      if (healthData.evening.bloodPressure) markdown += `- 血圧: ${healthData.evening.bloodPressure}\n`;
      if (healthData.evening.comment) markdown += `- メモ: ${healthData.evening.comment}\n`;
    }
    markdown += `\n`;
  }
  
  markdown += `## 💬 AIからのフィードバック\n`;
  if (responses?.c1) markdown += `### ログ (C1)\n${responses.c1}\n\n`;
  if (responses?.c2) markdown += `### マモ (C2)\n${responses.c2}\n\n`;
  if (responses?.c3) markdown += `### ワク (C3)\n${responses.c3}\n\n`;
  if (responses?.c4) markdown += `### ゼン (C4)\n${responses.c4}\n\n`;

  // メタデータを末尾に隠しテキストとして埋め込む
  markdown += `\n---\n`;
  markdown += `<!-- METADATA_START\n${JSON.stringify(entry, null, 2)}\nMETADATA_END -->\n`;
  
  return markdown;
}

/**
 * 未同期または更新された日記をGoogle Driveへ同期する
 */
export async function syncUnsyncedEntriesToDrive(userId: string, accessToken: string) {
  if (!adminDb) {
    console.error("[Backup] adminDb is not initialized.");
    return;
  }

  const entriesRef = adminDb.collection("entries");
  
  try {
    // ユーザーの全日記を取得
    const snapshot = await entriesRef.where("userId", "==", userId).get();
    
    const unsyncedEntries = snapshot.docs.filter(doc => {
      const data = doc.data() as DiaryEntry;
      if (!data.driveSyncedAt) return true; // 未同期
      
      // updatedAt が driveSyncedAt より新しい場合に同期
      const updatedAt = (data.updatedAt as any)?.toDate() || new Date(0);
      const driveSyncedAt = (data.driveSyncedAt as any)?.toDate() || new Date(0);
      return updatedAt > driveSyncedAt;
    });

    if (unsyncedEntries.length === 0) {
      console.log(`[Backup] No entries to sync for user: ${userId}`);
      return;
    }

    console.log(`[Backup] Found ${unsyncedEntries.length} entries to sync for user: ${userId}`);

    for (const doc of unsyncedEntries) {
      const entry = doc.data() as DiaryEntry;
      const fileName = `diary_${entry.date}.md`;
      const content = formatEntryForBackup(entry);

      try {
        const result = await uploadToDrive(accessToken, fileName, content, entry.driveFileId);
        
        // Firestore側を更新
        await doc.ref.update({
          driveFileId: result.id,
          driveSyncedAt: Timestamp.now()
        });
        
        console.log(`[Backup] Successfully synced entry: ${entry.date} (FileID: ${result.id})`);
      } catch (error) {
        console.error(`[Backup] Failed to sync entry ${entry.date}:`, error);
      }
    }
  } catch (error) {
    console.error("[Backup] Error during sync process:", error);
    throw error;
  }
}
