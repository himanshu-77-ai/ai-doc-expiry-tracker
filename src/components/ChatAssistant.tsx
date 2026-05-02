import React from "react";
import { MessageSquare, X, ChevronRight, Loader2, Bot } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ChatAssistantProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  messages: { role: "user" | "ai"; text: string }[];
  input: string;
  setInput: (input: string) => void;
  onSend: () => void;
  isLoading?: boolean;
}

// Simple markdown renderer — handles bold, tables, bullets cleanly
function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table detection
    if (line.includes("|") && lines[i + 1]?.includes("---")) {
      const headers = line.split("|").map(h => h.trim()).filter(Boolean);
      const rows: string[][] = [];
      i += 2; // skip header + separator
      while (i < lines.length && lines[i].includes("|")) {
        rows.push(lines[i].split("|").map(c => c.trim()).filter(Boolean));
        i++;
      }
      elements.push(
        <div key={i} className="overflow-x-auto my-3 rounded-xl border border-gray-100">
          <table className="w-full text-xs">
            <thead className="bg-blue-50">
              <tr>{headers.map((h, j) => <th key={j} className="px-3 py-2 text-left font-bold text-blue-700">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  {row.map((cell, ci) => <td key={ci} className="px-3 py-2 text-gray-700">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Heading
    if (line.startsWith("### ")) {
      elements.push(<p key={i} className="font-black text-gray-900 mt-3 mb-1 text-sm">{line.slice(4)}</p>);
    } else if (line.startsWith("## ")) {
      elements.push(<p key={i} className="font-black text-gray-900 mt-3 mb-1">{line.slice(3)}</p>);
    }
    // Bullet
    else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={i} className="flex gap-2 my-0.5">
          <span className="text-blue-500 mt-0.5 shrink-0">•</span>
          <span className="text-gray-700 text-sm">{formatInline(line.slice(2))}</span>
        </div>
      );
    }
    // Empty line
    else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    }
    // Normal line
    else {
      elements.push(<p key={i} className="text-sm text-gray-700 leading-relaxed">{formatInline(line)}</p>);
    }
    i++;
  }
  return <>{elements}</>;
}

function formatInline(text: string): React.ReactNode {
  // Bold **text**
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-bold text-gray-900">{part}</strong> : part
  );
}

export const ChatAssistant: React.FC<ChatAssistantProps> = ({
  isOpen, setIsOpen, messages, input, setInput, onSend, isLoading
}) => {
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl shadow-2xl shadow-blue-500/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40"
      >
        <MessageSquare size={24} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile backdrop */}
            <div
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] lg:hidden"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ y: 80, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 80, opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 right-0 lg:bottom-6 lg:right-6 w-full lg:w-[420px] h-[85vh] lg:h-[600px] bg-white lg:rounded-3xl shadow-2xl flex flex-col z-[70] overflow-hidden border border-gray-100"
            >
              {/* Header */}
              <div className="px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                    <Bot size={18} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">AI Tracker Assistant</h3>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                      <p className="text-[10px] text-blue-100 font-semibold tracking-wide uppercase">Online</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors"
                >
                  <X size={16} className="text-white" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50/50">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                      <Bot size={32} className="text-blue-600" />
                    </div>
                    <p className="font-bold text-gray-900">Ask me about your documents</p>
                    <p className="text-sm text-gray-400">I can summarize expiry status, tell you what needs renewal, and more.</p>
                    <div className="flex flex-wrap gap-2 justify-center mt-2">
                      {["What's expiring soon?", "Summary of all docs", "Which docs expired?"].map(q => (
                        <button
                          key={q}
                          onClick={() => { setInput(q); }}
                          className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-all"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "ai" && (
                      <div className="w-7 h-7 bg-blue-100 rounded-xl flex items-center justify-center mr-2 shrink-0 mt-1">
                        <Bot size={14} className="text-blue-600" />
                      </div>
                    )}
                    <div className={`max-w-[85%] px-4 py-3 rounded-2xl shadow-sm ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-tr-sm"
                        : "bg-white border border-gray-100 rounded-tl-sm"
                    }`}>
                      {msg.role === "ai"
                        ? <SimpleMarkdown text={msg.text} />
                        : <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                      }
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="w-7 h-7 bg-blue-100 rounded-xl flex items-center justify-center mr-2 shrink-0">
                      <Bot size={14} className="text-blue-600" />
                    </div>
                    <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm">
                      <div className="flex gap-1 items-center">
                        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0 }} className="w-2 h-2 bg-blue-400 rounded-full" />
                        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} className="w-2 h-2 bg-blue-400 rounded-full" />
                        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }} className="w-2 h-2 bg-blue-400 rounded-full" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 bg-white border-t border-gray-100 shrink-0">
                <div className="flex gap-2 bg-gray-50 border border-gray-200 rounded-2xl p-1.5">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Ask about your documents..."
                    className="flex-1 px-3 py-2 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
                  />
                  <button
                    onClick={onSend}
                    disabled={!input.trim() || isLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 shrink-0"
                  >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={18} />}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
