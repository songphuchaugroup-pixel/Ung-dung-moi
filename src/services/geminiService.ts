import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

export const getGeminiModel = () => {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined. Please set it in your environment variables.");
  }
  const genAI = new GoogleGenAI({ apiKey });
  return genAI.models.getGenerativeModel({ model: "gemini-2.0-flash" });
};

export const suggestDutyTasks = async (className: string, shift: string) => {
  try {
    const model = getGeminiModel();
    const prompt = `Bạn là một trợ lý quản lý nề nếp trường học. Hãy gợi ý 3 nhiệm vụ chính cụ thể cho lớp ${className} trực vào buổi ${shift}. Trả về danh sách ngắn gọn, ngăn cách bằng dấu phẩy.`;
    
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return "Trực cổng trường, Kiểm tra vệ sinh, Nhắc nhở đồng phục";
  }
};
