import { GoogleGenerativeAI } from '@google/generative-ai';

export const extractDrawingIdWithGemini = async (imageBase64, apiKey, activeCats) => {
  if (!apiKey) throw new Error("Gemini API Key is missing");
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const catStr = activeCats.join(', ');
  const prompt = `You are an expert OCR and data extraction assistant for architectural and engineering blueprints.
Your task is to find the exact "Drawing ID" (or "รหัสแบบ") in the provided image crop.
The Drawing ID typically starts with one of these prefixes: ${catStr}.
Examples of valid formats: AR-01, IN-02_01, EE-10, AR-10_01A.

Rules:
1. Look for a string matching the pattern of [Prefix]-[Numbers] or [Prefix]-[Numbers]_[Numbers].
2. Return ONLY the exact Drawing ID string. Do not include any other words, punctuation, or explanation.
3. If you absolutely cannot find a matching Drawing ID in the image, return the exact string "NOT_FOUND".`;

  // Strip the base64 prefix (e.g., "data:image/png;base64,")
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  const imagePart = {
    inlineData: {
      data: base64Data,
      mimeType: "image/png"
    }
  };

  try {
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text().trim();
    
    if (text === "NOT_FOUND" || text.includes("NOT_FOUND")) {
      return null;
    }
    
    // Clean up any extra whitespaces or weird characters that might have been generated
    const cleanText = text.replace(/[^A-Za-z0-9\-_]/g, '');
    
    // Validate if it has at least one of the active categories as prefix
    const isValidPrefix = activeCats.some(cat => cleanText.startsWith(cat));
    if (!isValidPrefix) {
      return null;
    }
    
    return cleanText;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
