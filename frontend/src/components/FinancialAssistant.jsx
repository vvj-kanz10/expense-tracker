import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { MessageSquare, Send, Sparkles, Loader2, Bot, User, X } from 'lucide-react';

const SUGGESTED_QUESTIONS = [
  "How much did I spend on food in September?",
  "What did I earn in August?",
  "Compare my groceries in August and July",
  "What were my 5 biggest expenses last month?",
  "Where does most of my money go?"
];

export default function FinancialAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      text: "Hi! I'm your ArivGo assistant. Ask me anything about your statements — like spending, income, comparisons, or top expenses.",
      rows: []
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages, loading]);

  const handleSend = async (questionText) => {
    const q = (questionText || input).trim();
    if (!q || loading) return;

    const userMessage = { sender: 'user', text: q, rows: [] };
    setMessages((prev) => [...prev, userMessage]);
    if (!questionText) setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        '/api/assistant/ask',
        { question: q },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = response.data;
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: data.answer,
          rows: data.rows || []
        }
      ]);
    } catch (err) {
      const errorMsg = err.response?.data || 'Could not reach the assistant right now. Please try again.';
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: typeof errorMsg === 'string' ? errorMsg : 'Something went wrong.',
          rows: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button in Corner with Hover Tooltip */}
      <div className="fixed bottom-6 right-6 z-50 group flex items-center">
        <div className="absolute right-16 px-3 py-1.5 bg-card border border-gray-200 dark:border-gray-700 text-text text-xs font-semibold rounded-xl shadow-md opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none">
          Ask Assistant
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-primary/30"
          aria-label="Open AI Assistant"
        >
          <Sparkles size={24} />
        </button>
      </div>

      {/* Floating Modal Dialog Box */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end sm:p-6 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-card border border-gray-200 dark:border-gray-700 w-full sm:w-[440px] h-[85vh] sm:h-[600px] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slideUp">
            
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-bg/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-text">ArivGo Assistant</h2>
                  <p className="text-xs text-gray-400">Grounded in your statement data</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-text hover:bg-bg transition"
                aria-label="Close assistant"
              >
                <X size={18} />
              </button>
            </div>

            {/* Message Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((m, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 ${m.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div className={`p-2 rounded-xl shrink-0 flex items-center justify-center ${
                    m.sender === 'user' ? 'bg-primary text-white' : 'bg-bg border border-gray-200 dark:border-gray-700 text-primary'
                  }`}>
                    {m.sender === 'user' ? <User size={15} /> : <Bot size={15} />}
                  </div>

                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-xs sm:text-sm space-y-2.5 shadow-2xs ${
                    m.sender === 'user'
                      ? 'bg-primary text-white rounded-tr-xs'
                      : 'bg-bg border border-gray-200/80 dark:border-gray-700/80 text-text rounded-tl-xs'
                  }`}>
                    <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>

                    {/* Structured Table Rows */}
                    {m.rows && m.rows.length > 0 && (
                      <div className="mt-2 rounded-xl bg-card border border-gray-200 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                        {m.rows.map((row, rIndex) => (
                          <div key={rIndex} className="flex items-center justify-between px-3 py-2 text-xs">
                            <span className="text-gray-400 font-medium truncate pr-2">{row.label}</span>
                            <span className="font-semibold text-text whitespace-nowrap">{row.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-bg border border-gray-200 dark:border-gray-700 text-primary shrink-0">
                    <Bot size={15} />
                  </div>
                  <div className="bg-bg border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-xs px-4 py-3 flex items-center gap-2 text-xs text-gray-400">
                    <Loader2 size={14} className="animate-spin text-primary" />
                    <span>Analyzing statement numbers...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggested Quick Question Chips */}
            <div className="px-4 py-2 bg-bg/30 border-t border-gray-100 dark:border-gray-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[10px] uppercase font-bold text-gray-400 whitespace-nowrap px-1">Try asking:</span>
              {SUGGESTED_QUESTIONS.map((question, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(question)}
                  disabled={loading}
                  className="text-[11px] bg-card border border-gray-200 dark:border-gray-700 text-text hover:border-primary px-3 py-1 rounded-full whitespace-nowrap transition shadow-2xs active:scale-95 disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>

            {/* Input Box */}
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="p-3 bg-card border-t border-gray-200 dark:border-gray-700 flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your statements..."
                disabled={loading}
                className="flex-1 bg-bg border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-primary text-white p-2.5 rounded-xl hover:opacity-90 active:scale-95 transition disabled:opacity-50 shadow-2xs flex items-center justify-center shrink-0"
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}