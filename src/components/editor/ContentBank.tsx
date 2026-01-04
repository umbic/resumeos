'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Content item from the API
interface ContentBankItem {
  id: string;
  type: string;
  position: number | null;
  contentShort: string | null;
  contentMedium: string | null;
  contentLong: string | null;
  contentGeneric: string | null;
  categoryTags: string[] | null;
  outcomeTags: string[] | null;
  functionTags: string[] | null;
  brandTags: string[] | null;
}

// Display item (may be transformed for overviews)
interface DisplayItem {
  id: string;
  label?: string;  // For overviews: "Short Version", "Medium Version", etc.
  content: string;
  categoryTags: string[];
  outcomeTags: string[];
}

interface ContentBankProps {
  sectionKey: string;
  items: ContentBankItem[];
  loading: boolean;
  onSelect: (content: string) => void;
}

// Transform items for display
function transformItemsForDisplay(items: ContentBankItem[], sectionKey: string): DisplayItem[] {
  const displayItems: DisplayItem[] = [];

  for (const item of items) {
    // For overviews, show each version as a separate card
    if (sectionKey.includes('overview')) {
      if (item.contentShort) {
        displayItems.push({
          id: `${item.id}-short`,
          label: 'Short Version',
          content: item.contentShort,
          categoryTags: item.categoryTags || [],
          outcomeTags: item.outcomeTags || [],
        });
      }
      if (item.contentMedium) {
        displayItems.push({
          id: `${item.id}-medium`,
          label: 'Medium Version',
          content: item.contentMedium,
          categoryTags: item.categoryTags || [],
          outcomeTags: item.outcomeTags || [],
        });
      }
      if (item.contentLong) {
        displayItems.push({
          id: `${item.id}-long`,
          label: 'Long Version',
          content: item.contentLong,
          categoryTags: item.categoryTags || [],
          outcomeTags: item.outcomeTags || [],
        });
      }
    } else {
      // For other types, show content_long (most complete)
      const content = item.contentLong || item.contentMedium || item.contentShort || '';
      if (content) {
        displayItems.push({
          id: item.id,
          content,
          categoryTags: item.categoryTags || [],
          outcomeTags: item.outcomeTags || [],
        });
      }
    }
  }

  return displayItems;
}

// Get display name for content ID
function getContentDisplayName(id: string): string {
  if (id.startsWith('SUM-')) return 'Summary';
  if (id.startsWith('CH-')) {
    // Try to extract a short label from the ID
    const num = id.replace('CH-', '');
    return `Career Highlight ${num}`;
  }
  if (id.startsWith('P')) {
    const match = id.match(/P(\d+)-B?(\d+)?/);
    if (match) {
      const pos = match[1];
      const bullet = match[2];
      if (bullet) {
        return `Position ${pos} Bullet ${bullet}`;
      }
      return `Position ${pos}`;
    }
  }
  return id;
}

export function ContentBank({
  sectionKey,
  items,
  loading,
  onSelect,
}: ContentBankProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading alternatives...</span>
      </div>
    );
  }

  const displayItems = transformItemsForDisplay(items, sectionKey);

  if (displayItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        <div className="text-center">
          <p className="text-sm">No alternative content available</p>
          <p className="text-xs text-gray-400 mt-1">
            All content may already be in use
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 mb-4">
        {displayItems.length} alternative{displayItems.length !== 1 ? 's' : ''} available
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
        {displayItems.map((item) => (
          <div
            key={item.id}
            className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="text-sm font-medium text-gray-700">
                  {item.label || getContentDisplayName(item.id)}
                </span>
                {item.label && (
                  <span className="ml-2 text-xs text-gray-400">
                    ({item.id.split('-')[0]})
                  </span>
                )}
              </div>
            </div>

            {/* Content preview */}
            <p className="text-sm text-gray-600 leading-relaxed mb-3">
              {item.content}
            </p>

            {/* Tags */}
            {(item.categoryTags.length > 0 || item.outcomeTags.length > 0) && (
              <div className="flex flex-wrap gap-1 mb-3">
                {item.categoryTags.map((tag, i) => (
                  <span
                    key={`cat-${i}`}
                    className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded"
                  >
                    {tag}
                  </span>
                ))}
                {item.outcomeTags.map((tag, i) => (
                  <span
                    key={`out-${i}`}
                    className="px-2 py-0.5 text-xs bg-green-50 text-green-600 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Use button */}
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSelect(item.content)}
              >
                Use This
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
