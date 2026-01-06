'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Search, ChevronDown, ChevronUp, Check } from 'lucide-react';

interface ContentItem {
  id: string;
  title: string;
  category: string;
  content: string;
  variants?: { id: string; label: string; content: string }[];
  tags?: {
    industry?: string[];
    function?: string[];
    theme?: string[];
  };
}

interface ContentBankSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  usedContentIds: string[];
  onSelectContent: (contentId: string) => void;
  filter?: {
    category?: 'summary' | 'career-highlight' | 'bullet' | 'overview';
    positionNumber?: number;
  };
}

type CategoryFilter = 'all' | 'summary' | 'career-highlight' | 'bullet' | 'overview';

export function ContentBankSidebar({
  isOpen,
  onClose,
  usedContentIds,
  onSelectContent,
  filter,
}: ContentBankSidebarProps) {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(
    filter?.category || 'all'
  );
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [hideUsed, setHideUsed] = useState(false);

  // Fetch content bank data
  useEffect(() => {
    async function fetchContent() {
      try {
        const res = await fetch('/api/v2.1/content-bank');
        const data = await res.json();
        if (data.success) {
          setContent(data.content);
        }
      } catch (err) {
        console.error('Failed to fetch content bank:', err);
      } finally {
        setLoading(false);
      }
    }

    if (isOpen) {
      fetchContent();
    }
  }, [isOpen]);

  // Filter and search content
  const filteredContent = useMemo(() => {
    let items = content;

    // Filter by category
    if (categoryFilter !== 'all') {
      items = items.filter((item) => {
        switch (categoryFilter) {
          case 'summary':
            return item.category.toLowerCase().includes('summary');
          case 'career-highlight':
            return item.category.toLowerCase().includes('career') ||
                   item.category.toLowerCase().includes('highlight') ||
                   item.id.startsWith('CH-');
          case 'bullet':
            return item.category.toLowerCase().includes('bullet') ||
                   item.id.match(/^P[1-2]-B/);
          case 'overview':
            return item.category.toLowerCase().includes('overview') ||
                   item.id.match(/^OV-/);
          default:
            return true;
        }
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.id.toLowerCase().includes(query) ||
          item.title.toLowerCase().includes(query) ||
          item.content.toLowerCase().includes(query) ||
          item.variants?.some(
            (v) =>
              v.id.toLowerCase().includes(query) ||
              v.label.toLowerCase().includes(query) ||
              v.content.toLowerCase().includes(query)
          )
      );
    }

    // Hide used items
    if (hideUsed) {
      items = items.filter((item) => {
        // Check if base item is used
        const baseId = item.id.split('-').slice(0, 2).join('-');
        const isBaseUsed = usedContentIds.some((used) =>
          used.startsWith(baseId)
        );
        return !isBaseUsed;
      });
    }

    return items;
  }, [content, categoryFilter, searchQuery, hideUsed, usedContentIds]);

  // Toggle expanded state for an item
  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  // Check if content ID is used
  const isUsed = (id: string) => {
    const baseId = id.split('-').slice(0, 2).join('-');
    return usedContentIds.some((used) => used.startsWith(baseId));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 transition-opacity"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="absolute inset-y-0 left-0 w-full max-w-lg bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">Content Bank</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search and Filters */}
        <div className="px-6 py-4 border-b space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search content..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            {(
              ['all', 'summary', 'career-highlight', 'bullet', 'overview'] as const
            ).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  categoryFilter === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat === 'all'
                  ? 'All'
                  : cat.charAt(0).toUpperCase() + cat.slice(1).replace('-', ' ')}
              </button>
            ))}
          </div>

          {/* Hide used toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={hideUsed}
              onChange={(e) => setHideUsed(e.target.checked)}
              className="rounded border-gray-300"
            />
            Hide already used content
          </label>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredContent.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No content found matching your filters
            </div>
          ) : (
            <div className="space-y-3">
              {filteredContent.map((item) => {
                const itemIsUsed = isUsed(item.id);
                const isExpanded = expandedItems.has(item.id);

                return (
                  <div
                    key={item.id}
                    className={`border rounded-lg overflow-hidden ${
                      itemIsUsed ? 'opacity-60' : ''
                    }`}
                  >
                    {/* Item Header */}
                    <div
                      className={`flex items-start gap-3 p-3 cursor-pointer transition-colors ${
                        itemIsUsed ? 'bg-gray-50' : 'hover:bg-gray-50'
                      }`}
                      onClick={() =>
                        item.variants && item.variants.length > 0
                          ? toggleExpanded(item.id)
                          : onSelectContent(item.id)
                      }
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {item.id}
                          </span>
                          <span className="text-xs text-gray-400">
                            {item.category}
                          </span>
                          {itemIsUsed && (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <Check className="w-3 h-3" />
                              Used
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          {item.title}
                        </p>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {item.content}
                        </p>
                      </div>

                      {item.variants && item.variants.length > 0 && (
                        <button className="p-1 text-gray-400">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Variants */}
                    {isExpanded && item.variants && (
                      <div className="border-t bg-gray-50">
                        {item.variants.map((variant) => {
                          const variantIsUsed = usedContentIds.includes(variant.id);

                          return (
                            <div
                              key={variant.id}
                              className={`p-3 border-b last:border-b-0 cursor-pointer transition-colors ${
                                variantIsUsed
                                  ? 'opacity-60 bg-gray-100'
                                  : 'hover:bg-gray-100'
                              }`}
                              onClick={() => onSelectContent(variant.id)}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                                  {variant.id}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {variant.label}
                                </span>
                                {variantIsUsed && (
                                  <span className="flex items-center gap-1 text-xs text-green-600">
                                    <Check className="w-3 h-3" />
                                    Used
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 line-clamp-2">
                                {variant.content}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 text-center text-sm text-gray-500">
          {filteredContent.length} items available
          {usedContentIds.length > 0 &&
            ` | ${usedContentIds.length} already used`}
        </div>
      </div>
    </div>
  );
}
