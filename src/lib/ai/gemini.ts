import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// 利用可能なモデル識別子の定義
export const MODELS = {
  MAIN: "gemini-3-flash-preview",       // 通常・高速
  STABLE: "gemini-2.5-flash",          // 安定版・フォールバック
  PRO: "gemini-3.1-pro-preview"        // 高知能・ZEN用
} as const;

export const getGeminiModel = (modelName: string = MODELS.MAIN) => {
  return genAI.getGenerativeModel({ model: modelName });
};

/**
 * テキストをベクトル化（Embedding生成）
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  try {
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error("generateEmbedding failed:", error);
    return [];
  }
};
