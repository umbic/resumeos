'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, Info } from 'lucide-react';
import type { KeywordGap, ATSKeyword } from '@/types';

interface KeywordGapsProps {
  keywordGaps: KeywordGap[];
  atsKeywords: ATSKeyword[];
}

export function KeywordGaps({ keywordGaps, atsKeywords }: KeywordGapsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Missing high-priority keywords (from keywordGaps)
  const missingKeywords = keywordGaps.filter(g => !g.found_in_resume);

  // Medium-priority keywords for reference (frequency = 1)
  const mediumPriorityKeywords = atsKeywords.filter(k => k.priority === 'medium');

  if (missingKeywords.length === 0 && mediumPriorityKeywords.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-gray-900">Keyword Coverage</h3>
          {missingKeywords.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
              {missingKeywords.length} missing
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-4">
          {/* Missing High-Priority Keywords */}
          {missingKeywords.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-sm font-medium text-red-600 mb-2">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Missing Keywords</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {missingKeywords.map((gap, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-50 text-red-700 rounded border border-red-200"
                  >
                    {gap.keyword}
                    <span className="text-red-400">({gap.frequency_in_jd}x)</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Medium-Priority Keywords (Reference) */}
          {mediumPriorityKeywords.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-sm font-medium text-gray-500 mb-2">
                <Info className="h-3.5 w-3.5" />
                <span>Other Keywords</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {mediumPriorityKeywords.map((kw, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                  >
                    {kw.keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
