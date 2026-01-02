'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Check, Circle, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useResumeStore } from '@/lib/store';
import type { JDKeyword, KeywordCategory } from '@/types';
import { cn } from '@/lib/utils';

interface KeywordsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<KeywordCategory, string> = {
  hard_skill: 'Hard Skills',
  soft_skill: 'Soft Skills',
  industry_term: 'Industry Terms',
  seniority_signal: 'Seniority Signals',
};

const CATEGORY_ORDER: KeywordCategory[] = [
  'hard_skill',
  'industry_term',
  'soft_skill',
  'seniority_signal',
];

function StatusIcon({ status }: { status: JDKeyword['status'] }) {
  switch (status) {
    case 'addressed':
      return <Check className="h-3.5 w-3.5 text-green-500" />;
    case 'unaddressed':
      return <Circle className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500/20" />;
    case 'skipped':
      return <Circle className="h-3.5 w-3.5 text-zinc-400" />;
    case 'dismissed':
      return <X className="h-3.5 w-3.5 text-zinc-400" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-zinc-400" />;
  }
}

function KeywordItem({ keyword }: { keyword: JDKeyword }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="py-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-1 rounded text-left text-sm hover:bg-zinc-700/50 transition-colors',
          keyword.status === 'dismissed' && 'opacity-50'
        )}
      >
        <StatusIcon status={keyword.status} />
        <span className="flex-1 truncate">{keyword.keyword}</span>
        {keyword.priority === 'high' && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 border-yellow-500/50 text-yellow-500">
            High
          </Badge>
        )}
      </button>

      {expanded && (
        <div className="ml-6 mt-1 px-2 py-2 bg-zinc-800/50 rounded text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-zinc-400">Priority:</span>
            <span className="text-zinc-300 capitalize">{keyword.priority}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Placement:</span>
            <span className="text-zinc-300">{keyword.placement}</span>
          </div>
          {keyword.sectionAddressed && (
            <div className="flex justify-between">
              <span className="text-zinc-400">Added in:</span>
              <span className="text-green-400 capitalize">
                {keyword.sectionAddressed.replace('_', ' ')}
              </span>
            </div>
          )}
          {keyword.dismissReason && (
            <div className="flex justify-between">
              <span className="text-zinc-400">Dismissed:</span>
              <span className="text-zinc-500">{keyword.dismissReason}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KeywordCategory({
  category,
  keywords,
}: {
  category: KeywordCategory;
  keywords: JDKeyword[];
}) {
  const [expanded, setExpanded] = useState(true);
  const addressedCount = keywords.filter((k) => k.status === 'addressed').length;

  if (keywords.length === 0) return null;

  return (
    <div className="mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2 py-1 text-xs font-medium text-zinc-400 uppercase tracking-wide hover:text-zinc-300"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <span className="flex-1 text-left">{CATEGORY_LABELS[category]}</span>
        <span className="text-zinc-500">
          {addressedCount}/{keywords.length}
        </span>
      </button>

      {expanded && (
        <div className="mt-1">
          {keywords.map((keyword) => (
            <KeywordItem key={keyword.id} keyword={keyword} />
          ))}
        </div>
      )}
    </div>
  );
}

export function KeywordsPanel({ isOpen, onClose }: KeywordsPanelProps) {
  const { jdAnalysis } = useResumeStore();
  const [showDismissed, setShowDismissed] = useState(false);

  if (!isOpen || !jdAnalysis) return null;

  const activeKeywords = jdAnalysis.keywords.filter((k: JDKeyword) => k.status !== 'dismissed');
  const dismissedKeywords = jdAnalysis.keywords.filter((k: JDKeyword) => k.status === 'dismissed');

  const keywordsByCategory = CATEGORY_ORDER.reduce(
    (acc, category) => {
      acc[category] = activeKeywords.filter((k: JDKeyword) => k.category === category);
      return acc;
    },
    {} as Record<KeywordCategory, JDKeyword[]>
  );

  const totalAddressed = jdAnalysis.keywords.filter((k: JDKeyword) => k.status === 'addressed').length;
  const totalActive = activeKeywords.length;

  return (
    <div className="absolute top-0 right-0 bottom-0 w-72 bg-zinc-900 border-l border-zinc-700 shadow-xl z-10 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-700 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-zinc-100 text-sm">JD Keywords</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            {totalAddressed}/{totalActive} addressed
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-zinc-700 rounded transition-colors"
          aria-label="Close panel"
        >
          <X className="h-4 w-4 text-zinc-400" />
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 px-2 py-3">
        {CATEGORY_ORDER.map((category) => (
          <KeywordCategory
            key={category}
            category={category}
            keywords={keywordsByCategory[category]}
          />
        ))}

        {/* Dismissed section */}
        {dismissedKeywords.length > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-700">
            <button
              onClick={() => setShowDismissed(!showDismissed)}
              className="w-full flex items-center gap-2 px-2 py-1 text-xs text-zinc-500 hover:text-zinc-400"
            >
              {showDismissed ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <span>Dismissed ({dismissedKeywords.length})</span>
            </button>

            {showDismissed && (
              <div className="mt-1 opacity-60">
                {dismissedKeywords.map((keyword: JDKeyword) => (
                  <KeywordItem key={keyword.id} keyword={keyword} />
                ))}
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-zinc-700 text-[10px] text-zinc-500 flex items-center gap-3">
        <span className="flex items-center gap-1">
          <Check className="h-3 w-3 text-green-500" /> Addressed
        </span>
        <span className="flex items-center gap-1">
          <Circle className="h-3 w-3 text-yellow-500 fill-yellow-500/20" /> Pending
        </span>
        <span className="flex items-center gap-1">
          <X className="h-3 w-3 text-zinc-400" /> Dismissed
        </span>
      </div>
    </div>
  );
}
