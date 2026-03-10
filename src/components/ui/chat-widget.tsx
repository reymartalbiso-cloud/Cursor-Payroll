'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from 'ai/react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Minus, Bot, Loader2, Paperclip, FileSpreadsheet, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { ChatMessage } from './chat-message';
import { cn } from '@/lib/utils';

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ name: string; type: string; data: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { messages, input = '', setInput, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: '/api/chat',
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Hello! I am your Lifewood Payroll Assistant. How can I help you today?',
      },
    ],
    onFinish: () => {
      setSelectedFile(null);
    },
    onError: async (error) => {
      console.error('Chat Widget Error:', error);
      let errorMessage = 'Sorry, I encountered an error. Please try again or check your connection.';
      
      try {
        // In AI SDK v3.4+, the error message might be in the error object itself
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        }
      } catch (e) {
        console.error('Failed to parse error message:', e);
      }
      
      alert(errorMessage);
    }
  });

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, selectedFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      alert('Please upload an Excel or CSV file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setSelectedFile({
        name: file.name,
        type: file.type,
        data: base64
      });
    };
    reader.readAsDataURL(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="mb-4 w-[380px] sm:w-[420px] h-[550px] flex flex-col overflow-hidden rounded-2xl border bg-background/95 backdrop-blur-md shadow-2xl transition-all duration-300 dark:bg-zinc-900/95"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b bg-primary/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
                  <Bot size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Payroll Assistant</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Online</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg hover:bg-muted"
                  onClick={() => setIsOpen(false)}
                >
                  <Minus size={18} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                  onClick={() => setIsOpen(false)}
                >
                  <X size={18} />
                </Button>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4" viewportRef={scrollRef}>
              <div className="flex flex-col">
                {messages.map((m: any) => (
                  <ChatMessage key={m.id} role={m.role as 'user' | 'assistant'} content={m.content} />
                ))}
                {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse ml-11 mb-4">
                    <Loader2 size={12} className="animate-spin" />
                    Assistant is thinking...
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="border-t p-4 bg-background">
              {selectedFile && (
                <div className="mb-3 flex items-center justify-between p-2 rounded-lg bg-primary/5 border border-primary/10 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                      <FileSpreadsheet size={16} />
                    </div>
                    <span className="text-xs font-medium truncate max-w-[200px]">{selectedFile.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setSelectedFile(null)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              )}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!input?.trim() && !selectedFile) return;
                  
                  await append({
                    role: 'user',
                    content: input || (selectedFile ? `Analyzing file: ${selectedFile.name}` : ''),
                  }, {
                    body: {
                      file: selectedFile
                    }
                  });
                  
                  setInput('');
                }}
                className="relative flex items-center gap-2"
              >
                <div className="relative flex-1 flex items-center">
                  <Input
                    value={input}
                    onChange={handleInputChange}
                    placeholder={selectedFile ? "Ask about this file..." : "Ask me anything about payroll..."}
                    className="pl-10 pr-12 h-12 rounded-xl border-muted bg-muted/30 focus-visible:ring-primary/20"
                  />
                  <div className="absolute left-1.5">
                    <input
                      type="file"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".xlsx,.xls,.csv"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip size={18} />
                    </Button>
                  </div>
                  <Button
                    type="submit"
                    disabled={(!input?.trim() && !selectedFile) || isLoading}
                    size="icon"
                    className={cn(
                      "absolute right-1.5 h-9 w-9 rounded-lg transition-all duration-300",
                      (input?.trim() || selectedFile) ? "translate-x-0 opacity-100" : "translate-x-2 opacity-0 pointer-events-none"
                    )}
                  >
                    <Send size={18} />
                  </Button>
                </div>
              </form>
              <p className="mt-2 text-[10px] text-center text-muted-foreground">
                Powered by Lifewood AI • Results may vary
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-2xl shadow-xl transition-all duration-500",
          isOpen 
            ? "rotate-90 bg-destructive text-destructive-foreground" 
            : "bg-primary text-primary-foreground hover:shadow-primary/25"
        )}
      >
        {isOpen ? <X size={28} /> : <Bot size={28} />}
      </motion.button>
    </div>
  );
}
