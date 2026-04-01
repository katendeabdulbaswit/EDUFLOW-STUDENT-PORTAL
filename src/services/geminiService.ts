import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const geminiService = {
  async summarizeLecture(content: string) {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Summarize the following lecture notes into key takeaways and action items for a university student: \n\n${content}`,
    });
    return response.text;
  },

  async generateStudyPlan(courseName: string, topics: string[]) {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Create a 4-week study plan for the course "${courseName}" covering these topics: ${topics.join(", ")}. Format as a structured plan.`,
    });
    return response.text;
  }
};
