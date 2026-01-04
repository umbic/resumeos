'use client';

import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import type { GeneratedResume } from '@/types';

interface ChatRefinementProps {
  sessionId: string;
  activeSection: string | null;
  onResumeUpdate: (resume: GeneratedResume) => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatRefinement({
  sessionId,
  activeSection,
  onResumeUpdate
}: ChatRefinementProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          section: activeSection || 'summary',
          instruction: userMessage,
          conversationHistory: messages,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Updated ${activeSection || 'content'}. ${data.refined_content.slice(0, 100)}...`
        }]);
        onResumeUpdate(data.resume);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Error: ${data.error}`
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Failed to refine. Please try again.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {activeSection ? (
        <p className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
          Refining: {activeSection.replace(/_/g, ' ')}
        </p>
      ) : (
        <p className="text-xs text-gray-500">
          Click a section in the preview to select it for refinement
        </p>
      )}

      {/* Message History */}
      {messages.length > 0 && (
        <div className="max-h-40 overflow-y-auto space-y-2 text-sm">
          {messages.slice(-4).map((msg, i) => (
            <div
              key={i}
              className={`p-2 rounded ${
                msg.role === 'user'
                  ? 'bg-blue-50 text-blue-800'
                  : 'bg-gray-50 text-gray-800'
              }`}
            >
              {msg.content}
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="e.g., Make it more concise..."
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
