'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, User, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RefinementMessage } from '@/types';

interface RefineChatProps {
  sessionId: string;
  sectionKey: string;
  currentContent: string;
  chatHistory: RefinementMessage[];
  onRefined: (newContent: string, updatedHistory: RefinementMessage[]) => void;
}

export function RefineChat({
  sessionId,
  sectionKey,
  currentContent,
  chatHistory,
  onRefined,
}: RefineChatProps) {
  const [message, setMessage] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when chat history updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim() || isRefining) return;

    setIsRefining(true);
    setError(null);

    try {
      const response = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          sectionKey,
          currentContent,
          userMessage: message.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to refine content');
      }

      // Clear input and notify parent
      setMessage('');
      onRefined(data.refinedContent, data.chatHistory);

    } catch (err) {
      console.error('Refinement error:', err);
      setError(err instanceof Error ? err.message : 'Failed to refine content');
    } finally {
      setIsRefining(false);
    }
  };

  const suggestions = [
    'Make it shorter',
    'Make it more concise',
    'Emphasize leadership',
    'Add more impact metrics',
    'Simplify the language',
  ];

  return (
    <div className="flex flex-col h-full min-h-[400px]">
      {/* Current Content Display */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Current Content
        </label>
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 leading-relaxed">
          {currentContent}
        </div>
      </div>

      {/* Chat History */}
      {chatHistory.length > 0 && (
        <div className="flex-1 mb-4 overflow-y-auto max-h-[200px]">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Refinement History
          </label>
          <div className="space-y-3">
            {chatHistory.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-gray-600" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Suggestions (only show if no history yet) */}
      {chatHistory.length === 0 && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Quick Suggestions
          </label>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setMessage(suggestion)}
                className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="mt-auto">
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          How would you like to refine this?
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g., 'Make it shorter', 'Add more about GTM'..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isRefining}
          />
          <Button
            type="submit"
            disabled={!message.trim() || isRefining}
            className="px-4"
          >
            {isRefining ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Claude has full context of the job description and your entire resume.
        </p>
      </form>
    </div>
  );
}
