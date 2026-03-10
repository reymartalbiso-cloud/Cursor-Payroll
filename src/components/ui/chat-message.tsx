'use client';

import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { User, Bot } from 'lucide-react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div
      className={cn(
        'flex w-full mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'flex max-w-[85%] items-start gap-3',
          isUser ? 'flex-row-reverse' : 'flex-row'
        )}
      >
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg border shadow-sm',
            isUser
              ? 'bg-primary text-primary-foreground border-primary/20'
              : 'bg-muted border-border'
          )}
        >
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>
        <div
          className={cn(
            'rounded-2xl px-4 py-2 text-sm shadow-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-none'
              : 'bg-card text-card-foreground border rounded-tl-none'
          )}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
