import { getGeminiModel } from "./gemini";
import { ChatMessage } from "../firebase/chat";

export interface DictionarySuggestion {
  name: string;
  category: "person" | "place" | "organization" | "custom";
  memo: string;
}

export interface OrganizeResult {
  home: string;
  work: string;
  hobby: string;
  keywords: string[]; // 追加
  dictionarySuggestions: DictionarySuggestion[];
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
（※入力内に未知の固有名詞らしきものがあれば、推測して文脈を壊さないように整形してください）

### 出力要件:
1. 「Home（家庭や生活）」、「Work（仕事やキャリア）」、「Hobby（趣味や自己研鑽・バケットリスト）」に関わる内容に仕分けてください。
2. 内容が無い場合は空文字（""）にしてください。
3. 文体は「だ・である」調（常体）で簡潔に。AIの意見やコメントは厳禁。
4. **キーワード抽出**: 後の検索のために、内容を象徴するキーワードや重要語句（人名、場所、出来事など）を最大10個抽出してください。
5. **辞書への追加提案**: 今後も登場しそうな重要な固有名詞があれば抽出してください。

### 出力フォーマット (JSON形式のみ):
{
  "home": "...",
  "work": "...",
  "hobby": "...",
  "keywords": ["タグ1", "タグ2", ...],
  "dictionarySuggestions": [
    { "name": "...", "category": "...", "memo": "..." }
  ]
}
`;

  try {
    let attempts = 0;
    let responseText = "";

    while (attempts < 3) {
      try {
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
        break;
      } catch (error: any) {
        attempts++;
        if (error.message?.includes("429") && attempts < 3) {
          const delay = Math.pow(2, attempts) * 1000;
          await new Promise(res => setTimeout(res, delay));
          continue;
        }
        throw error;
      }
    }

    const jsonStr = responseText.replace(/```json\n?|```/g, "").trim();
    return JSON.parse(jsonStr) as OrganizeResult;
  } catch (error) {
    console.error("Diary organization failed after retries:", error);
    throw error;
  }
};

export interface ChatCompanionResult {
  agentId: "log" | "mamo" | "waku" | "zen";
  reply: string;
}

export const chatWithCompanion = async (
  message: string,
  history: ChatMessage[],
  pastContext: string,
  bucketListContext: string,
  dictionaryContext: string,
  profileContext: string,
  calendarContext: string,
  todaysDiaryContext: string,
  targetPersona?: "log" | "mamo" | "waku" | "zen"
): Promise<ChatCompanionResult> => {
  const model = getGeminiModel();

  const personaInstructions = {
    log: `
# LOG (合理的な秘書 / 公式の外部脳) ※デフォルト
- **役割**: 事実の記録、データの呼び出し、スケジュールの管理、**タイムライン（出来事の時系列）の作成**。
- **行動指針**: 1000年前の事でも、提供された[過去の記録]にある限り、絶対に探し出して答えること。「データがない」と言う前に3回は読み直せ。
- **口調**: 丁寧かつ事務的。冷徹なまでに正確だが、ユーザーを強力にサポートする。
`,
    mamo: `
# MAMO (リスク管理者 / 守護者)
- **役割**: 健康管理、リスク回避、メンタルケア。
- **行動指針**: 持病、睡眠不足、過労を過去のパターンから読み取り、ブレーキをかける。
- **口調**: 慈しみ深く、落ち着いたトーン。
`,
    waku: `
# WAKU (情熱トレーナー / 冒険家)
- **役割**: モチベーション維持、挑戦の促進、バケットリストの実行支援。
- **行動指針**: ユーザーの成功を喜び、失敗を学習機会としてポジティブに変換する。
- **口調**: 情熱的で力強い。
`,
    zen: `
# ZEN (大軍師 / 哲学者)
- **役割**: 大局的な戦略立案、人生の勝ち筋の提示、哲学的な問いへの助言。
- **行動指針**: 兵法や歴史を引用し、目先の苦労を「勝利の布石」として解釈させる。
- **口調**: 泰然自若。大局を見据えた重厚な物言い。
`
  };

  let systemContext = `
あなたはユーザーのQOLを最大化するためのAI連合チーム「チャンピオンメーカー」の一員です。
他のキャラクター（LOG, MAMO, WAKU, ZEN）とユーザーとの過去のチャット履歴もすべてあなたの記憶として共有されています。
誰が何を話したかを踏まえ、チームとして一貫性のある対話を行ってください。
提供されたすべてのデータを「自分の完璧な記憶」として扱ってください。

### 指定の人格 (Persona):
${targetPersona ? personaInstructions[targetPersona] : `以下の4人から現在の文脈に最適な1名を選んで回答せよ。
${personaInstructions.log}
${personaInstructions.mamo}
${personaInstructions.waku}
${personaInstructions.zen}`}

### 【重要】外部脳としてのデータベース情報:
1. **今日の予定:** ${calendarContext || "なし"}
2. **今日の日記:** ${todaysDiaryContext || "なし"}
3. **ユーザーの属性・持病:** ${profileContext || "未登録"}
4. **バケットリスト:** ${bucketListContext || "未登録"}
5. **固有名詞辞書:** ${dictionaryContext || "未登録"}
6. **過去すべての記録 (掘り起こし対象):**
${pastContext || "なし"}
（※ここにユーザーの過去の全データが集約されています。たとえ1000年前（過去データ）のことでも、ここにある限りは答えろ。勝手にロードされていないなどと言い訳するな）

### 振る舞いルール:
- 返信はLINE形式のチャット。短く、端的に、一往復のメッセージで。
- 文体は「だ・である」調（常体）。
- **記憶の徹底**: コンテキストにある事実に基づいて答えること。「忘れた」「わからない」は極力避け、執拗にデータを探すこと。
- 回答は必ず以下のJSON形式で行うこと。
- LOGが担当する場合、必要に応じて過去の出来事をタイムライン形式でまとめよ。

### 出力フォーマット (JSONのみ):
{
  "agentId": "log" | "mamo" | "waku" | "zen",
  "reply": "回答内容"
}
`;

  const contents = [];
  contents.push({ role: "user", parts: [{ text: systemContext }] });
  contents.push({ role: "model", parts: [{ text: JSON.stringify({ agentId: "log", reply: "承知いたしました。外部脳として、過去1000年前の記憶まで掘り起こし、伴走を完遂します。" }) }] });

  for (const msg of history) {
    contents.push({
      role: msg.role === "model" ? "model" : "user",
      parts: [{ text: msg.role === "model" ? JSON.stringify({ agentId: msg.agentId || "log", reply: msg.content }) : msg.content }]
    });
  }

  contents.push({
    role: "user",
    parts: [{ text: message }]
  });

  try {
    // 429エラー対策: 最大3回リトライ
    let attempts = 0;
    let responseText = "";
    
    while (attempts < 3) {
      try {
        const response = await model.generateContent({ contents });
        responseText = response.response.text();
        break;
      } catch (error: any) {
        attempts++;
        if (error.message?.includes("429") && attempts < 3) {
          const delay = Math.pow(2, attempts) * 1000;
          console.warn(`Gemini 429 Error. Retrying in ${delay}ms... (Attempt ${attempts})`);
          await new Promise(res => setTimeout(res, delay));
          continue;
        }
        throw error;
      }
    }

    const jsonStr = responseText.replace(/```json\n?|```/g, "").trim();
    return JSON.parse(jsonStr) as ChatCompanionResult;
  } catch (error: any) {
    console.error("Chat generation failed after retries:", error);
    throw error;
  }
};
