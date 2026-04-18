import { getGeminiModel } from "./gemini";
import { ChatMessage } from "../firebase/chat";

export interface OrganizeResult {
  home: string;
  work: string;
  hobby: string;
}

export const organizeDiary = async (
  rawText: string, 
  dictionaryContext: string,
): Promise<OrganizeResult> => {
  const model = getGeminiModel();

  const prompt = `
あなたは優秀な秘書エージェントです。
ユーザーから投げられた支離滅裂なメモや日記のダンプ（"あー"や"えー"などの不要な言葉が含まれている場合あり）を、以下の3つのカテゴリ（Home, Work, Hobby）に整理・清書してください。

### ユーザーの入力 (raw text):
"""
${rawText}
"""

### 固有名詞辞書 (ユーザー独自の用語・人物・場所):
${dictionaryContext || "未登録"}
（※入力内に未知の固有名詞らしきものがあれば、推測して文脈を壊さないように整形し、必要に応じてユーザーに後で辞書登録を促すようなメモは残さず、自然な文章を維持してください）

### 出力要件:
1. 「Home（家庭や生活）」、「Work（仕事やキャリア）」、「Hobby（趣味や自己研鑽・バケットリスト）」に関わる内容に仕分けてください。
2. そのカテゴリに該当する内容が無い場合は空文字（""）にしてください。
3. 文体は「です・ます」調で読みやすく簡潔に整形してください。AIの意見やコメントは絶対に含めず、ユーザーが記録した事実と感情のみをきれいに整理してください。

### 出力フォーマット (JSON形式のみ):
{
  "home": "家庭・生活に関する整理されたテキスト",
  "work": "仕事に関する整理されたテキスト",
  "hobby": "趣味に関する整理されたテキスト"
}
`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const jsonStr = responseText.replace(/```json\n?|```/g, "").trim();
    return JSON.parse(jsonStr) as OrganizeResult;
  } catch (error) {
    console.error("Diary organization failed:", error);
    throw error;
  }
};

export const chatWithCompanion = async (
  message: string,
  history: ChatMessage[],
  pastContext: string,
  bucketListContext: string,
  dictionaryContext: string,
  profileContext: string,
  calendarContext: string,
  todaysDiaryContext: string
): Promise<string> => {
  const model = getGeminiModel();

  // 以前の4人の人格を包括した、優秀な「チャンピオンメーカー・チーム」として振る舞うプロンプト
  let systemContext = `
あなたは、ユーザーの人生の質（QOL）を最大化するためのAI「チャンピオンメーカー」です。
ユーザーが「したたかに世渡りし、情熱的に遊び、家庭を慈しみ、仕事を勝ち取る」ための「に伴走する外部脳」としてLINEのようなチャットでフレンドリーかつ知的に会話します。

### あなたの中にいる4つの視点（必要に応じてこの視点からアドバイスをしてください）:
- **LOG (合理的・秘書)**: 事務的で完璧な段取り、進捗管理を行う。
- **MAMO (リスク管理者)**: 過去の失敗や持病・過労リスクを警戒し、守りの警告を行う。
- **WAKU (トレーナー)**: 好奇心満載で、ピンチをチャンスに変える情熱的な鼓舞を行う。
- **ZEN (大軍師)**: 歴史や兵法を引用し、大局的な「勝ち筋」を示す。

### ユーザーの前提コンテキスト:
0. **今日のカレンダー予定:**
${calendarContext || "予定なし"}

1. **今日入力した日記の構造化データ:**
${todaysDiaryContext || "まだ入力なし"}

2. **ユーザーの基本プロフィール・持病:**
${profileContext || "未登録"}

3. **バケットリスト (人生の目標):**
${bucketListContext || "未登録"}

4. **固有名詞辞書:**
${dictionaryContext || "未登録"}

5. **過去の記録 (教訓など):**
${pastContext || "なし"}

これらを踏まえ、ユーザーからの最新のメッセージに短く端的に（チャットアプリのようなテンポで）応答してください。長い長文は避け、親身に、時には鋭くアドバイスしてください。ユーザーが辞書に無い新しい言葉を使っていたら、「◯◯って新しい言葉ですね、辞書に登録しますか？」と提案してください。
`;

  // 履歴をGeminiの形式に変換
  const contents = [];
  contents.push({ role: "user", parts: [{ text: systemContext }] });
  contents.push({ role: "model", parts: [{ text: "承知いたしました。ユーザーの外部脳として伴走します。" }] });

  for (const msg of history) {
    contents.push({
      role: msg.role === "model" ? "model" : "user",
      parts: [{ text: msg.content }]
    });
  }

  // 最新のユーザーメッセージを追加
  contents.push({
    role: "user",
    parts: [{ text: message }]
  });

  try {
    const response = await model.generateContent({ contents });
    return response.response.text();
  } catch (error) {
    console.error("Chat generation failed:", error);
    throw error;
  }
};
