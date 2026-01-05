'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Content item from the API
interface ContentItem {
  id: string;
  type: string;
  position: number | null;
  contentShort: string | null;
  contentMedium: string | null;
  contentLong: string | null;
  contentGeneric: string | null;
  brandTags: string[] | null;
  baseId: string | null;
  variantLabel: string | null;
  themeTags: string[] | null;
}

// Grouped base item for display
interface BaseItemGroup {
  baseId: string;
  brandName: string;
  preview: string;
  variantCount: number;
  variants: ContentItem[];
}

interface ContentPickerProps {
  type: 'career_highlight' | 'bullet';
  position?: number;
  usedContentIds: string[];
  onSelect: (content: string, contentId: string) => void;
  onClose: () => void;
}

export function ContentPicker({
  type,
  position,
  usedContentIds,
  onSelect,
  onClose,
}: ContentPickerProps) {
  const [loading, setLoading] = useState(true);
  const [baseGroups, setBaseGroups] = useState<BaseItemGroup[]>([]);
  const [selectedBase, setSelectedBase] = useState<BaseItemGroup | null>(null);

  // Fetch all available base items and their variants
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({ type });
      if (position !== undefined) {
        queryParams.set('position', position.toString());
      }

      const response = await fetch(`/api/content-bank?${queryParams.toString()}`);
      const data = await response.json();

      if (data.items) {
        // Group items by base
        const groups = groupItemsByBase(data.items, usedContentIds);
        setBaseGroups(groups);
      }
    } catch (error) {
      console.error('Failed to fetch content:', error);
    } finally {
      setLoading(false);
    }
  }, [type, position, usedContentIds]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Group items by their base ID
  function groupItemsByBase(items: ContentItem[], usedIds: string[]): BaseItemGroup[] {
    const baseMap = new Map<string, BaseItemGroup>();

    // First pass: identify all base items
    for (const item of items) {
      if (!item.baseId) {
        // This is a base item
        // Use brand tag if available, otherwise use the ID
        const brandTag = item.brandTags?.[0] || '';
        const shortDesc = item.contentShort || '';

        // Create a display name: "Brand - Short Description" or just short description
        // This ensures each CH item has a unique, descriptive name
        let brandName: string;
        if (brandTag && shortDesc) {
          // Extract key achievement from short description (first ~50 chars)
          const achievement = shortDesc.length > 60 ? shortDesc.substring(0, 57) + '...' : shortDesc;
          brandName = `${brandTag}: ${achievement}`;
        } else if (shortDesc) {
          brandName = shortDesc.length > 70 ? shortDesc.substring(0, 67) + '...' : shortDesc;
        } else {
          brandName = brandTag || item.id;
        }

        const preview = item.contentShort || item.contentMedium || item.contentLong || '';

        baseMap.set(item.id, {
          baseId: item.id,
          brandName,
          preview: preview.substring(0, 100) + (preview.length > 100 ? '...' : ''),
          variantCount: 0,
          variants: [item], // Include base item as first "variant"
        });
      }
    }

    // Second pass: add variants to their base groups
    for (const item of items) {
      if (item.baseId) {
        const group = baseMap.get(item.baseId);
        if (group) {
          group.variants.push(item);
          group.variantCount++;
        }
      }
    }

    // Filter out groups where ALL items (base + variants) are already used
    const availableGroups: BaseItemGroup[] = [];
    for (const group of Array.from(baseMap.values())) {
      const hasAvailable = group.variants.some((v: ContentItem) => !usedIds.includes(v.id));
      if (hasAvailable) {
        // Filter out used variants from the group
        group.variants = group.variants.filter((v: ContentItem) => !usedIds.includes(v.id));
        availableGroups.push(group);
      }
    }

    return availableGroups.sort((a, b) => a.brandName.localeCompare(b.brandName));
  }

  // Get content from an item
  function getContent(item: ContentItem): string {
    return item.contentLong || item.contentMedium || item.contentShort || '';
  }

  // Handle selecting a variant
  function handleSelectVariant(item: ContentItem) {
    const content = getContent(item);
    onSelect(content, item.id);
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Loading content...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          {selectedBase ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedBase(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedBase.brandName}
                </h2>
                <p className="text-sm text-gray-500">
                  Choose a variant
                </p>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Add {type === 'career_highlight' ? 'Career Highlight' : `Position ${position} Bullet`}
              </h2>
              <p className="text-sm text-gray-500">
                Select an achievement
              </p>
            </div>
          )}
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {selectedBase ? (
            // Step 2: Show variants of selected base
            <div className="space-y-3">
              {selectedBase.variants.map((variant) => (
                <div
                  key={variant.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 cursor-pointer transition-colors"
                  onClick={() => handleSelectVariant(variant)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      {/* Use brand name from selected base, show theme focus for variants */}
                      {variant.baseId
                        ? (variant.themeTags?.[0] || 'Alternative Version')
                        : 'Base Version'
                      }
                    </span>
                    {variant.baseId && (
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        Variant
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {getContent(variant)}
                  </p>
                  {/* Show remaining theme tags (skip first one if it's shown in header) */}
                  {variant.themeTags && variant.themeTags.length > 1 && variant.baseId && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {variant.themeTags.slice(1, 5).map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 text-xs bg-purple-50 text-purple-600 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* For base items, show all theme tags */}
                  {variant.themeTags && variant.themeTags.length > 0 && !variant.baseId && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {variant.themeTags.slice(0, 4).map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 text-xs bg-purple-50 text-purple-600 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            // Step 1: Show base items grouped by brand
            <div className="space-y-2">
              {baseGroups.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No available content</p>
                  <p className="text-sm text-gray-400 mt-1">
                    All items may already be in use
                  </p>
                </div>
              ) : (
                baseGroups.map((group) => (
                  <div
                    key={group.baseId}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 cursor-pointer transition-colors"
                    onClick={() => setSelectedBase(group)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold text-gray-900">
                          {group.brandName}
                        </span>
                        {group.variantCount > 0 && (
                          <span className="ml-2 text-xs text-gray-500">
                            {group.variantCount} variant{group.variantCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <ChevronLeft className="h-4 w-4 text-gray-400 rotate-180" />
                    </div>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {group.preview}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t bg-gray-50">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
