import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const getGeminiModel = (modelName: string = "gemini-3.1-pro-preview") => {
  return genAI.getGenerativeModel({ model: modelName });
};
