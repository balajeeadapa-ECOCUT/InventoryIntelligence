import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageCircle, 
  X, 
  Send, 
  Mic, 
  MicOff, 
  Sparkles,
  Loader2,
  Bot,
  User,
  Trash2,
  Minimize2,
  Maximize2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  provider?: string;
}

export function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const chatMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const response = await apiRequest("POST", "/api/ai/chat", {
        sessionId,
        message: userMessage
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (!sessionId) {
        setSessionId(data.sessionId);
      }
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.message.content,
        timestamp: new Date(),
        provider: data.message.provider
      }]);
    }
  });

  const voiceQueryMutation = useMutation({
    mutationFn: async (transcription: string) => {
      const response = await apiRequest("POST", "/api/ai/voice-query", { transcription });
      return response.json();
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        provider: data.provider
      }]);
    }
  });

  const handleSend = () => {
    if (!message.trim() || chatMutation.isPending) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: message,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    chatMutation.mutate(message);
    setMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceInput = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("Voice recognition is not supported in your browser");
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-IN";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcription = event.results[0][0].transcript;
      setMessage(transcription);
      
      // Add user message and process voice query
      const userMessage: ChatMessage = {
        role: "user",
        content: `🎤 ${transcription}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      voiceQueryMutation.mutate(transcription);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const clearChat = () => {
    setMessages([]);
    setSessionId(null);
  };

  const quickPrompts = [
    "What's my inventory status?",
    "Show low stock items",
    "Best selling products",
    "Reorder suggestions"
  ];

  return (
    <>
      <AnimatePresence>
        {isOpen && !isMinimized && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 w-96 h-[500px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden z-50"
            data-testid="ai-chat-window"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">StockFlow AI</h3>
                  <p className="text-xs text-white/70">Powered by GPT-4o & Gemini</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={clearChat}
                  data-testid="clear-chat-btn"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={() => setIsMinimized(true)}
                  data-testid="minimize-chat-btn"
                >
                  <Minimize2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={() => setIsOpen(false)}
                  data-testid="close-chat-btn"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center mb-4">
                    <Bot className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                    How can I help you?
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Ask me anything about your inventory
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {quickPrompts.map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setMessage(prompt);
                          inputRef.current?.focus();
                        }}
                        className="text-xs px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        data-testid={`quick-prompt-${i}`}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.role === "user" 
                          ? "bg-blue-600" 
                          : "bg-gradient-to-r from-purple-500 to-indigo-500"
                      }`}>
                        {msg.role === "user" ? (
                          <User className="w-4 h-4 text-white" />
                        ) : (
                          <Bot className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        {msg.provider && msg.role === "assistant" && (
                          <p className="text-xs mt-1 opacity-50">via {msg.provider}</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {(chatMutation.isPending || voiceQueryMutation.isPending) && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2.5">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Button
                  variant={isListening ? "destructive" : "outline"}
                  size="icon"
                  onClick={handleVoiceInput}
                  disabled={chatMutation.isPending || voiceQueryMutation.isPending}
                  className="flex-shrink-0"
                  data-testid="voice-input-btn"
                >
                  {isListening ? (
                    <MicOff className="w-4 h-4 animate-pulse" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </Button>
                <Input
                  ref={inputRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about inventory..."
                  className="flex-1"
                  disabled={chatMutation.isPending || voiceQueryMutation.isPending}
                  data-testid="chat-input"
                />
                <Button
                  onClick={handleSend}
                  disabled={!message.trim() || chatMutation.isPending || voiceQueryMutation.isPending}
                  className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  data-testid="send-message-btn"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimized state */}
      <AnimatePresence>
        {isOpen && isMinimized && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed bottom-24 right-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full px-4 py-2 shadow-lg flex items-center gap-3 cursor-pointer z-50"
            onClick={() => setIsMinimized(false)}
            data-testid="minimized-chat"
          >
            <Bot className="w-5 h-5 text-white" />
            <span className="text-white text-sm font-medium">StockFlow AI</span>
            <Maximize2 className="w-4 h-4 text-white" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-50 transition-all ${
          isOpen 
            ? "bg-gray-600 hover:bg-gray-700" 
            : "bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700"
        }`}
        data-testid="ai-chat-toggle"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
            >
              <X className="w-6 h-6 text-white" />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              className="relative"
            >
              <MessageCircle className="w-6 h-6 text-white" />
              <Sparkles className="w-3 h-3 text-yellow-300 absolute -top-1 -right-1" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );
}
