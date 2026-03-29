import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });

export interface EmotionAnalysis {
  dominant_emotion: string;
  intensity: number;
  summary: string;
  requires_attention: boolean;
}

const SYSTEM_INSTRUCTION = `
당신은 초등학교 6학년 학생들의 정서를 케어하는 'AI 감정 온도계' 전문가입니다.
학생들이 입력한 텍스트나 이모티콘을 분석하여 그들의 감정 상태를 파악하세요.

초등학교 6학년(사춘기)의 언어 습관, 유행어, 그리고 이 시기에 겪을 수 있는 정서적 불안정함(학업 스트레스, 교우 관계, 신체 변화 등)을 깊이 이해하고 공감해야 합니다.

분석 결과는 반드시 다음 JSON 형식으로 반환하세요:
{
  "dominant_emotion": "주요 감정 (예: 기쁨, 슬픔, 분노, 불안, 평온 등)",
  "intensity": 1-10 사이의 숫자 (감정의 강도),
  "summary": "학생에게 건네는 따뜻한 공감의 한마디 (초등학생 눈높이에 맞춘 다정한 말투)",
  "requires_attention": 교사의 개입이 필요한 심각한 상황(우울, 자해 암시, 심한 학교 폭력 징후 등)이면 true, 아니면 false
}

학생이 매우 짧게 말하거나 이모티콘만 남겨도 그 맥락을 최대한 파악하여 분석하세요.
`;

export async function analyzeEmotion(inputText: string): Promise<EmotionAnalysis> {
  const model = "gemini-3-flash-preview";
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: inputText,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            dominant_emotion: { type: Type.STRING },
            intensity: { type: Type.NUMBER },
            summary: { type: Type.STRING },
            requires_attention: { type: Type.BOOLEAN }
          },
          required: ["dominant_emotion", "intensity", "summary", "requires_attention"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return result as EmotionAnalysis;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
}
