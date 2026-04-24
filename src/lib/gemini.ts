// Using Groq API - Free tier, no billing required
// Get your free API key at: https://console.groq.com

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const getGroqHeaders = () => ({
  "Content-Type": "application/json",
  "Authorization": `Bearer ${process.env.GEMINI_API_KEY}` // reusing same env var name so no Render changes needed
});

export const extractDocumentInfo = async (base64Image: string, mimeType: string) => {
  console.log("Starting OCR extraction via Groq...", { mimeType, base64Length: base64Image.length });

  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("API Key is missing. Please check your configuration.");
    console.log("API Key loaded, starts with:", key.substring(0, 8));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 40000);

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: getGroqHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this document image and extract the following fields. Return ONLY a valid JSON object with no extra text:
                {
                  "title": "short document name",
                  "expiryDate": "YYYY-MM-DD or null",
                  "issueDate": "YYYY-MM-DD or null",
                  "documentNumber": "document number or null",
                  "category": "one of: Identity, License, Insurance, Invoice, Other",
                  "summary": "one sentence summary"
                }`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      })
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err?.error?.message || "Groq API error");
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("Empty response from AI.");

    // Clean and parse JSON
    const clean = text.replace(/```json|```/g, "").trim();
    const info = JSON.parse(clean);
    console.log("AI Extraction success:", info);
    return info;

  } catch (error: any) {
    console.error("OCR Extraction Error:", error);
    throw new Error(error.message || "AI scanning encountered an issue.");
  }
};

export const chatWithAssistant = async (
  history: { role: 'user' | 'ai', text: string }[],
  message: string,
  documentsContext?: string
) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "AI Assistant is currently unavailable (Missing API Key).";

  const systemPrompt = `You are AI Tracker Assistant, a high-end personal document management expert.
Your goal is to help users manage their documents, track expiries, and provide clear summaries of their document health.

BEHAVIOR:
- When the user asks for a status update, provide a concise table or structured list using markdown.
- Categorize documents by urgency: CRITICAL (Expired), WARNING (Expiring Soon), and SECURE (Safe).
- Proactively advise the user on which documents need immediate attention.
- Use markdown headers (###) and bold text to make the information scanable.

${documentsContext ? `CONTEXT - USER'S CURRENT DOCUMENTS:\n${documentsContext}` : "No documents currently in the tracker."}`;

  try {
    const chatHistory = history.slice(0, -1).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: getGroqHeaders(),
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          ...chatHistory,
          { role: "user", content: message }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err?.error?.message || "Groq API error");
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a helpful response.";

  } catch (error: any) {
    console.error("Chat API Error:", error);
    throw new Error(error.message || "Failed to communicate with AI.");
  }
};
