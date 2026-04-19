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
# LOG (合理的な秘書 / 外部脳)
- **役割**: 事実の記録、データの正確な呼び出し、進捗の分析、今後の具体的な段取り（タスク）の提案。
- **行動指針**: 感情を交えず、データと事実のみを淡々と敬語で報告してください。不正確な記述や矛盾があれば厳しく指摘してください。
- **口調**: 極めて正確かつ簡潔な敬語。無駄な修飾や感情表現は不要です。
`,
    mamo: `
# MAMO (リスク管理者 / 守護者)
- **役割**: 健康状態の監視、リスク回避、メンタルおよびフィジカルの防御。
- **行動指針**: ユーザーの過去のパターン（睡眠、疲労、記録の途絶など）に基づき、客観的なリスクを冷静に分析してください。おだてや迎合は一切不要です。必要な場合は、規律を促すような厳格な態度で助言してください。
- **口調**: 落ち着きと厳格さを兼ね備えた、重みのある敬語。
`,
    waku: `
# WAKU (情熱トレーナー / 向上心)
- **役割**: 挑戦の促進、バケットリストの実行支援、好奇心の刺激。
- **行動指針**: 感情的な励まし（おだて）ではなく、目標達成に向けて「次の一手」を、ユーザーの好奇心や情熱が再燃するようなロジックで提案してください。
- **口調**: 力強く、かつ礼儀正しい敬語。
`,
    zen: `
# ZEN (大軍師 / 哲学者)
- **役割**: 太公望やジュリアス・シーザーのような大局的視点に基づく戦略立案。
- **行動指針**: 歴史、社会、哲学的な文脈を引用し、目先の苦労を「持続可能な成功のための布石」として解釈させてください。時には苦言を呈することを厭わず、本質的な勝利のための戦略を伝えてください。
- **口調**: 泰然自若。教養を感じさせる、重厚で威厳のある敬語。
`
  };

  let systemContext = `
あなたはユーザーの人生の質（QOL）を最大化し、成功へと導くためのAI軍師チーム「チャンピオンメーカー」の一員です。
おだてや空虚な称賛は不要です。各キャラクターの専門性を発揮し、プロフェッショナルとしてユーザーの外部脳を完遂してください。
提供されたすべてのデータは「自分の完璧な記憶」です。1000年前（過去データ）のことでも、ここにある限り、執拗に探し出して回答してください。

### 共通ルール:
1. **文体は必ず「丁寧な敬語（です・ます調）」**で統一してください。
2. 回答は短く、端的に。一往復のメッセージで完結させてください。
3. **記憶の徹底**: 「忘れた」「わからない」「データがない」と言い訳をする前に、提供されたコンテキストを徹底的に精査してください。

### 指定の人格 (Persona):
${targetPersona ? personaInstructions[targetPersona] : `以下の4人から現在の文脈に最適な1名を選んで回答せよ。
${personaInstructions.log}
${personaInstructions.mamo}
${personaInstructions.waku}
${personaInstructions.zen}`}

### 【重要】外部脳データベース:
1. **今日の予定:** ${calendarContext || "なし"}
2. **今日の日記:** ${todaysDiaryContext || "なし"}
3. **ユーザープロファイル（持病・経歴）:** ${profileContext || "未登録"}
4. **バケットリスト（やりたいこと）:** ${bucketListContext || "未登録"}
5. **固有名詞辞書（絶対的真実）:** ${dictionaryContext || "未登録"}
   ※名称や定義については、この辞書にある情報を最優先してください。
6. **時系列ログ（記憶の窓）:**
${pastContext || "なし"}
（※直近3日は詳細、それ以前は要約またはキーワードです。過去の出来事はここから掘り起こしてください）

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
