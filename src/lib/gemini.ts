import { GoogleGenAI, Type } from "@google/genai";

// ✅ FIX: Create fresh client on every call instead of once at startup
const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const extractDocumentInfo = async (base64Image: string, mimeType: string) => {
  console.log("Starting OCR extraction via @google/genai...", { mimeType, base64Length: base64Image.length });
  
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("AI API Key is missing. Please check your configuration.");
    
    console.log("API Key loaded, starts with:", key.substring(0, 8));

    const ai = getAI(); // ✅ Fresh client every time
    const fetchPromise = ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          parts: [
            { text: `Analyze the provided image and extract information for the following fields: 
            title (short doc name), expiryDate (YYYY-MM-DD), issueDate (YYYY-MM-DD), documentNumber, category [Identity, License, Insurance, Invoice, Other], summary (one sentence).
            Return ONLY a valid JSON object.` },
            {
              inlineData: {
                data: base64Image,
                mimeType
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            expiryDate: { type: Type.STRING },
            issueDate: { type: Type.STRING },
            documentNumber: { type: Type.STRING },
            category: { type: Type.STRING },
            summary: { type: Type.STRING }
          },
          required: ["title", "expiryDate"]
        }
      }
    });

    // 40 second timeout for AI extraction
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("AI scanning timed out (40s). Please try a smaller image or enter details manually.")), 40000)
    );

    const response = await Promise.race([fetchPromise, timeoutPromise]) as any;
    if (!response || !response.text) throw new Error("Empty response from AI.");
    
    const info = JSON.parse(response.text || "{}");
    console.log("AI Extraction success:", info);
    return info;
  } catch (error: any) {
    console.error("OCR Extraction Error:", error);
    throw new Error(error.message || "AI scanning encountered an issue.");
  }
};

export const chatWithAssistant = async (history: { role: 'user' | 'ai', text: string }[], message: string, documentsContext?: string) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "AI Assistant is currently unavailable (Missing API Key).";

  const systemInstruction = `You are AI Tracker Assistant, a high-end personal document management expert. 
  Your goal is to help users manage their documents, track expiries, and provide clear summaries of their document health.

  BEHAVIOR:
  - When the user asks for a status update, provide a concise table or structured list using markdown.
  - Categorize documents by urgency: CRITICAL (Expired), WARNING (Expiring Soon), and SECURE (Safe).
  - Proactively advise the user on which documents need immediate attention.
  - Use markdown headers (###) and bold text to make the information scanable.
  - If a list is very long, summarize the key highlights.

  UI & STYLE:
  - Be professional and encouraging.
  - Always acknowledge the current context clearly.
  - Don't just list data; interpret it (e.g., "You have 3 critical items that need renewal").

  ${documentsContext ? `CONTEXT - USER'S CURRENT DOCUMENTS:\n${documentsContext}` : "No documents currently in the tracker."}
  
  Provide accurate, well-structured advice based on this context.`;

  try {
    const chatHistory = history.slice(0, -1).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    const ai = getAI(); // ✅ Fresh client every time
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        ...chatHistory,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction
      }
    });

    return response.text || "I'm sorry, I couldn't generate a helpful response.";
  } catch (error: any) {
    console.error("Chat API Error:", error);
    throw new Error(error.message || "Failed to communicate with AI.");
  }
};
