import { getGeminiModel } from "./gemini";

export interface HuddleResult {
  segments: {
    home: string;
    work: string;
    hobby: string;
  };
  responses: {
    c1: string;
    c2: string;
    c3: string;
    c4: string;
  };
}

export const runAIHuddle = async (
  rawText: string, 
  pastContext: string,
  bucketListContext: string,
  dictionaryContext: string
): Promise<HuddleResult> => {
  const model = getGeminiModel();

  const prompt = `
あなたは、ユーザーの人生の質（QOL）を最大化するための4人のAIエージェントによる「チャンピオンメーカー・チーム」です。
ユーザーが「したたかに世渡りし、情熱的に遊び、家庭を慈しみ、仕事を勝ち取る」ための「外部脳」として機能してください。

### ユーザーの入力 (raw text):
"""
${rawText}
"""

### コンテキスト情報:
1. **バケットリスト (人生の全領域における達成目標):**
${bucketListContext || "未登録"}

2. **固有名詞辞書 (ユーザー独自の用語・人物・場所):**
${dictionaryContext || "未登録"}

3. **過去の記録 (教訓・履歴・リスクデータ):**
${pastContext || "なし"}

### 4人のエージェントの役割とトーン:
- **C1 (LOG - 合理的で完璧な個人秘書)**: 入力内容を整理し、**進捗を合理的に管理してください。次に取るべき実現可能な具体的段取りを、事務的かつ的確にアドバイス**してください。
- **C2 (MAMO - リスク管理者)**: 過去の失敗パターン（過去の記録を参照）から、今回の行動に伴うリスクを執拗に検証してください。「同じ轍を踏んでいないか」を監視し、守りの警告を生成してください。
- **C3 (WAKU - 好奇心の塊・トレーナー)**: **好奇心にあふれ、リスクを恐れず前進あるのみ**というトーンで語ってください。今日の些細な出来事がバケットリストの目標にどう繋がるかを情熱的に示し、ユーザーをチャンピオンにするために強力に推進してください。
- **C4 (ZEN - 大軍師)**: C1, C2, C3の全視点を統合し、大局的な「勝ち筋」を戦略的にアドバイスしてください。**常に歴史や世界との繋がりを忘れず**、歴史の知恵や兵法を引用して、深みのある洞察を提供してください。

### 出力フォーマット (JSON形式):
以下の構造で、純粋なJSONのみを返してください。
{
  "segments": {
    "home": "Home/Familyカテゴリの具体的整理と次の一手",
    "work": "Work/Businessカテゴリの具体的整理と次の一手",
    "hobby": "Hobby/Self-growthカテゴリの具体的整理と次の一手"
  },
  "responses": {
    "c1": "LOGによる事務的・合理的な段取りアドバイス",
    "c2": "MAMOによる過去の失敗を踏まえたリスク警告",
    "c3": "WAKUによる好奇心全開の鼓舞と推進",
    "c4": "ZENによる大局的な戦略・洞察"
  }
}
`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    // JSONのパース（Markdownのコードブロックを除去）
    const jsonStr = responseText.replace(/```json\n?|```/g, "").trim();
    return JSON.parse(jsonStr) as HuddleResult;
  } catch (error) {
    console.error("AI Huddle failed:", error);
    throw error;
  }
};
