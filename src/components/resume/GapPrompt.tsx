'use client';

import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { JDKeyword } from '@/types';

interface GapPromptProps {
  keyword: JDKeyword;
  onAdd: (userContext: string) => void;
  onSkip: () => void;
  onDismiss: () => void;
  isLoading?: boolean;
}

export function GapPrompt({
  keyword,
  onAdd,
  onSkip,
  onDismiss,
  isLoading = false,
}: GapPromptProps) {
  const [userContext, setUserContext] = useState('');
  const [showInput, setShowInput] = useState(false);

  const handleAdd = () => {
    if (userContext.trim()) {
      onAdd(userContext.trim());
    }
  };

  const categoryLabel = {
    hard_skill: 'skill',
    soft_skill: 'soft skill',
    industry_term: 'industry term',
    seniority_signal: 'seniority signal',
  }[keyword.category];

  return (
    <div className="bg-zinc-800/80 border border-zinc-700 rounded-lg p-4 mb-4">
      {/* Header */}
      <div className="flex items-start gap-2 mb-3">
        <Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="font-medium text-zinc-100 text-sm">Keyword Check</h4>
          <p className="text-zinc-400 text-sm mt-1">
            The JD mentions{' '}
            <span className="text-yellow-400 font-medium">&ldquo;{keyword.keyword}&rdquo;</span>{' '}
            <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1 border-zinc-600">
              {categoryLabel}
            </Badge>
          </p>
          <p className="text-zinc-400 text-sm mt-1">
            Is there an opportunity to include it in this section?
          </p>
        </div>
      </div>

      {/* Input area (shown when user clicks Add) */}
      {showInput && (
        <div className="mb-3">
          <Textarea
            placeholder="Tell me how this applies to you..."
            value={userContext}
            onChange={(e) => setUserContext(e.target.value)}
            className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 min-h-[80px] text-sm"
            disabled={isLoading}
          />
          <p className="text-xs text-zinc-500 mt-1">
            Example: &ldquo;I regularly present to C-suite and board members at Fortune 500 clients&rdquo;
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {showInput ? (
          <>
            <Button
              variant="default"
              size="sm"
              onClick={handleAdd}
              disabled={!userContext.trim() || isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isLoading ? 'Adding...' : 'Incorporate Keyword'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInput(false)}
              disabled={isLoading}
              className="text-zinc-400 hover:text-zinc-300"
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInput(true)}
              disabled={isLoading}
              className="border-blue-600 text-blue-400 hover:bg-blue-600/20"
            >
              Add to this section
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              disabled={isLoading}
              className="text-zinc-400 hover:text-zinc-300"
            >
              Not relevant here
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              disabled={isLoading}
              className="text-zinc-500 hover:text-zinc-400"
            >
              I don&apos;t have this
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
