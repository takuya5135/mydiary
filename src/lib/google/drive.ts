export interface DriveInsertResult {
  id: string;
  name: string;
}

const BACKUP_FOLDER_NAME = "myDiary_Backup";

/**
 * Google Driveへファイルをアップロードまたは更新する
 */
export const uploadToDrive = async (
  accessToken: string,
  fileName: string,
  content: string,
  existingFileId?: string | null
): Promise<DriveInsertResult> => {
  // 1. フォルダの取得または作成
  const folderId = await getOrCreateFolder(accessToken, BACKUP_FOLDER_NAME);

  // 2. 既存ファイルの検索（IDが指定されていない場合のみ）
  const fileId = existingFileId || await findFileInFolder(accessToken, folderId, fileName);

  const metadata = {
    name: fileName,
    mimeType: "text/markdown",
    parents: [folderId],
  };

  const file = new Blob([content], { type: "text/markdown" });
  const formData = new FormData();
  formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  formData.append("file", file);

  let url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
  let method = "POST";

  if (fileId) {
    url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
    method = "PATCH";
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("Drive upload failed:", error);
    throw new Error(`Google Drive Upload Failed: ${response.statusText}`);
  }

  return await response.json();
};

const getOrCreateFolder = async (accessToken: string, folderName: string): Promise<string> => {
  const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();

  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Create folder
  const createUrl = "https://www.googleapis.com/drive/v3/files";
  const createResponse = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  const folder = await createResponse.json();
  return folder.id;
};

const findFileInFolder = async (accessToken: string, folderId: string, fileName: string): Promise<string | null> => {
  const query = `name = '${fileName}' and '${folderId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();

  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
};
