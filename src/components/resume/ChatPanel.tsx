'use client';

import { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useResumeStore, Message, ContentOption } from '@/lib/store';

interface ChatPanelProps {
  onSendMessage: (message: string) => void;
  onSelectOption?: (optionId: string) => void;
  onApprove?: () => void;
}

export function ChatPanel({ onSendMessage, onSelectOption, onApprove }: ChatPanelProps) {
  const { messages, isLoading, currentStep } = useResumeStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = inputRef.current;
    if (input && input.value.trim()) {
      onSendMessage(input.value.trim());
      input.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onSelectOption={onSelectOption}
            />
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-zinc-400">
              <div className="animate-pulse">●</div>
              <div className="animate-pulse delay-100">●</div>
              <div className="animate-pulse delay-200">●</div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-zinc-800 p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            ref={inputRef}
            placeholder={getPlaceholder(currentStep)}
            className="flex-1 min-h-[60px] max-h-[200px] bg-zinc-900 border-zinc-700 text-white resize-none"
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Send
            </Button>
            {onApprove && currentStep > 0 && (
              <Button
                type="button"
                onClick={onApprove}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                Approve
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onSelectOption,
}: {
  message: Message;
  onSelectOption?: (optionId: string) => void;
}) {
  const isAssistant = message.role === 'assistant';

  return (
    <div
      className={cn(
        'flex',
        isAssistant ? 'justify-start' : 'justify-end'
      )}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-lg p-3',
          isAssistant
            ? 'bg-zinc-800 text-zinc-100'
            : 'bg-blue-600 text-white'
        )}
      >
        {/* Text content */}
        <div className="whitespace-pre-wrap">{message.content}</div>

        {/* Content options */}
        {message.options && message.options.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.options.map((option) => (
              <ContentOptionCard
                key={option.id}
                option={option}
                onSelect={() => onSelectOption?.(option.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ContentOptionCard({
  option,
  onSelect,
}: {
  option: ContentOption;
  onSelect: () => void;
}) {
  return (
    <Card
      className={cn(
        'p-3 cursor-pointer transition-colors',
        option.selected
          ? 'bg-green-900/50 border-green-600'
          : 'bg-zinc-900 border-zinc-700 hover:border-zinc-500'
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-zinc-200">{option.content}</p>
        <Badge
          variant="outline"
          className={cn(
            'shrink-0',
            option.similarity > 0.8
              ? 'border-green-500 text-green-400'
              : option.similarity > 0.6
              ? 'border-yellow-500 text-yellow-400'
              : 'border-zinc-500 text-zinc-400'
          )}
        >
          {Math.round(option.similarity * 100)}%
        </Badge>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          {option.id}
        </Badge>
        {option.selected && (
          <Badge className="bg-green-600 text-xs">Selected</Badge>
        )}
      </div>
    </Card>
  );
}

function getPlaceholder(step: number): string {
  switch (step) {
    case 0:
      return 'Type "long" or "short" to select format...';
    case 1:
      return 'Paste the job description here...';
    case 2:
      return 'Confirm or adjust the header...';
    case 3:
      return 'Review the summary or request changes...';
    case 4:
      return 'Select or swap career highlights...';
    case 5:
    case 6:
      return 'Review position content or request changes...';
    case 7:
      return 'Review remaining positions...';
    case 8:
      return 'Ready to export!';
    default:
      return 'Type your message...';
  }
}
