// AI calls are proxied through /api/ai/chat to avoid CORS issues.
// The server forwards requests to Groq using the server-side GEMINI_API_KEY.
import { auth } from "./firebase";

const callAI = async (body: object): Promise<any> => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not authenticated. Please sign in.");

  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || err?.error || `AI API error: ${response.status}`);
  }

  return response.json();
};

export const extractDocumentInfo = async (base64Image: string, mimeType: string) => {
  console.log("Starting OCR extraction via server proxy...", { mimeType, base64Length: base64Image.length });

  try {
    const data = await callAI({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this document image carefully and extract the following fields.
              CRITICAL: Read ALL digits in dates very carefully. If a year shows "2036" return 2036 NOT 2026. Read each digit precisely.
              Return ONLY a valid JSON object with no extra text, no markdown:
              {
                "title": "short document name",
                "expiryDate": "YYYY-MM-DD or null",
                "issueDate": "YYYY-MM-DD or null",
                "documentNumber": "document number or null",
                "category": "one of: Identity, License, Insurance, Invoice, Other",
                "summary": "one sentence summary"
              }
              Double-check every year digit before returning.`
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
    });

    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("Empty response from AI.");

    const clean = text.replace(/```json|```/g, "").trim();
    const info = JSON.parse(clean);

    const currentYear = new Date().getFullYear();
    const fixDate = (dateStr: string | null): string | null => {
      if (!dateStr) return null;
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return dateStr;
      const year = parseInt(match[1]);
      const month = match[2];
      const day = match[3];
      if (year < currentYear - 5) console.warn(`[OCR] Suspicious past expiry year: ${year}. Verify manually.`);
      if (year > currentYear + 50) console.warn(`[OCR] Suspicious future expiry year: ${year}. Verify manually.`);
      return `${year}-${month}-${day}`;
    };

    if (info.expiryDate) info.expiryDate = fixDate(info.expiryDate);
    if (info.issueDate) info.issueDate = fixDate(info.issueDate);

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

    const data = await callAI({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        ...chatHistory,
        { role: "user", content: message }
      ],
      max_tokens: 1000,
      temperature: 0.7
    });

    return data.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a helpful response.";

  } catch (error: any) {
    console.error("Chat API Error:", error);
    throw new Error(error.message || "Failed to communicate with AI.");
  }
};
