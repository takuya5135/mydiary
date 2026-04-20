import { getGeminiModel, MODELS } from "./gemini";
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
  keywords: string[];
  dictionarySuggestions: DictionarySuggestion[];
}

export const organizeDiary = async (
  rawText: string, 
  dictionaryContext: string,
  calendarContext: string = "なし",
): Promise<OrganizeResult> => {
  const model = getGeminiModel(MODELS.MAIN);

  const prompt = `
あなたは優秀な秘書エージェントです。
ユーザーから投げられた支離滅裂なメモや日記のダンプを、以下の3つのカテゴリ（Home, Work, Hobby）に整理・清書してください。

### ユーザーの入力 (raw text):
"""
${rawText}
"""

### 今日の予定・タスク (Google連携):
${calendarContext}

### 固有名詞辞書:
${dictionaryContext || "未登録"}

### 出力要件:
1. 「Home」、「Work」、「Hobby」に仕分けてください。
2. **Google連携情報の記録**: 「今日の予定・タスク」にある項目を、内容に応じて適切なカテゴリの末尾に「箇条書きでそのまま」転記してください。
3. 文体は「だ・である」調（常体）で簡潔に。AIの意見やコメントは厳禁。
4. **キーワード抽出**: 重要な固有名詞や出来事を最大10個。
5. **辞書への追加提案**: 新しい固有名詞があれば抽出。

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
// ... (中略、実装は変更なし)
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
  toolCall?: {
    name: string;
    args: any;
  };
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
  // 人格に応じてモデルを切り分け (ZENはPRO、その他はMAIN)
  const selectedModelId = targetPersona === "zen" ? MODELS.PRO : MODELS.MAIN;
  
  // ツール（関数呼び出し）の定義
  const tools = [
    {
      functionDeclarations: [
        {
          name: "search_past_diary",
          description: "ユーザーの過去の日記（全期間）からキーワードで検索し、該当する日付と内容を特定します。大昔の出来事を知りたい時に使用します。",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "検索するキーワードや文章"
              }
            },
            required: ["query"]
          }
        },
        {
          name: "jump_to_date",
          description: "特定の日付の日記画面へジャンプ（移動）します。検索で見つかった日付へ移動したい時に使用します。",
          parameters: {
            type: "object",
            properties: {
              date: {
                type: "string",
                description: "移動先の日付 (YYYY-MM-DD)"
              }
            },
            required: ["date"]
          }
        }
      ]
    }
  ];

  const model = getGeminiModel(selectedModelId);
  // @ts-ignore (最新SDKの型定義対応)
  model.tools = tools;

  const personaInstructions = {
    // ... (前回定義した指示を維持)
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
現在は5人（ユーザー＋4つのAIペルソナ）による「軍師会議」を行っています。

### 共通ルール:
1. **文体は必ず「丁寧な敬語（です・ます調）」**で統一してください。
2. 他のペルソナの発言が前にある場合は、それらを「同じ会議室での発言」として踏まえ、自分の専門性を発揮して回答してください。
3. すでに出た意見と重複しすぎるのを避け、別の切り口や補足を提供してください。
4. 回答は短く、端的に。
5. 提供されたすべてのデータは「自分の完璧な記憶」です。1000年前（過去データ）のことでも、ここにある限り、執拗に探し出して回答してください。

### 指定の人格 (Persona):
${targetPersona ? personaInstructions[targetPersona] : `各ペルソナの役割は以下の通りです。
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
  "agentId": "${targetPersona || "log"}",
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
        
        // ツール（関数呼び出し）のチェック
        const functionCalls = response.response.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
          return {
            agentId: targetPersona || "log",
            reply: "データを取得します...",
            toolCall: {
              name: functionCalls[0].name,
              args: functionCalls[0].args
            }
          };
        }

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

    try {
      const jsonStr = responseText.replace(/```json\n?|```/g, "").trim();
      return JSON.parse(jsonStr) as ChatCompanionResult;
    } catch (e) {
      // JSON形式でない場合、プレーンテキストをパースして返す
      return {
        agentId: targetPersona || "log",
        reply: responseText
      };
    }
  } catch (error: any) {
    console.error("Chat generation failed after retries:", error);
    throw error;
  }
};
