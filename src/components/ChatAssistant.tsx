import React from "react";
import { 
  MessageSquare, 
  X, 
  ChevronRight,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import ReactMarkdown from "react-markdown";

interface ChatAssistantProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  messages: { role: 'user' | 'ai', text: string }[];
  input: string;
  setInput: (input: string) => void;
  onSend: () => void;
  isLoading?: boolean;
}

export const ChatAssistant: React.FC<ChatAssistantProps> = ({
  isOpen,
  setIsOpen,
  messages,
  input,
  setInput,
  onSend,
  isLoading
}) => {
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl shadow-blue-500/40 flex items-center justify-center hover:scale-110 transition-all z-40"
      >
        <MessageSquare size={28} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] lg:hidden" onClick={() => setIsOpen(false)} />
          <motion.div 
            initial={{ y: 100, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 100, opacity: 0, scale: 0.9 }}
            className="fixed bottom-0 right-0 lg:bottom-8 lg:right-8 w-full lg:w-[450px] h-[650px] bg-white lg:rounded-3xl shadow-2xl flex flex-col z-[70] overflow-hidden"
          >
            <div className="p-6 bg-blue-600 text-white flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 className="font-bold">AI Tracker Assistant</h3>
                  <p className="text-[10px] text-blue-100 uppercase font-bold tracking-wider">Your Personal Assistant</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-gray-50/50">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-4 rounded-2xl max-w-[90%] text-sm shadow-sm ${
                    msg.role === 'ai' 
                      ? "bg-white text-gray-800 rounded-tl-none border border-gray-100 prose prose-sm prose-blue" 
                      : "bg-blue-600 text-white rounded-tr-none"
                  }`}>
                    {msg.role === 'ai' ? (
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-100 flex items-center gap-2 shadow-sm">
                    <div className="flex gap-1">
                      <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                      <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                      <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-4 bg-white border-t border-gray-100">
              <div className="flex gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-200">
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Ask about your documents..." 
                  className="flex-1 px-4 py-2 bg-transparent outline-none text-sm"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onSend()}
                />
                <button 
                  onClick={onSend} 
                  disabled={!input.trim() || isLoading}
                  className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:grayscale"
                >
                  <ChevronRight size={20} />
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
