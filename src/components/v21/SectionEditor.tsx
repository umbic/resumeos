'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Sparkles, RotateCcw, Save, ChevronDown, ChevronUp } from 'lucide-react';
import type { SectionType, EditTarget } from './InteractiveResume';

// Word count constraints
const WORD_LIMITS: Record<SectionType, { min: number; max: number }> = {
  summary: { min: 140, max: 160 },
  'career-highlight': { min: 25, max: 40 },
  'position-overview': { min: 40, max: 60 },
  'position-bullet': { min: 25, max: 40 },
};

const SECTION_LABELS: Record<SectionType, string> = {
  summary: 'Summary',
  'career-highlight': 'Career Highlight',
  'position-overview': 'Position Overview',
  'position-bullet': 'Position Bullet',
};

interface ContentSource {
  id: string;
  content: string;
  category: string;
}

interface SectionEditorProps {
  isOpen: boolean;
  onClose: () => void;
  target: EditTarget | null;
  currentContent: string;
  sourceId?: string;
  availableSources?: ContentSource[];
  onSave: (newContent: string) => Promise<void>;
  onRefine: (feedback?: string) => Promise<string>;
  onSwapSource?: (newSourceId: string) => Promise<string>;
}

export function SectionEditor({
  isOpen,
  onClose,
  target,
  currentContent,
  sourceId,
  availableSources = [],
  onSave,
  onRefine,
  onSwapSource,
}: SectionEditorProps) {
  const [editedContent, setEditedContent] = useState(currentContent);
  const [feedback, setFeedback] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refinedPreview, setRefinedPreview] = useState<string | null>(null);

  // Reset state when content changes
  useEffect(() => {
    setEditedContent(currentContent);
    setFeedback('');
    setRefinedPreview(null);
    setError(null);
    setShowSources(false);
  }, [currentContent, isOpen]);

  const wordCount = editedContent.trim().split(/\s+/).filter(Boolean).length;
  const limits = target ? WORD_LIMITS[target.type] : { min: 0, max: 100 };
  const isValidWordCount = wordCount >= limits.min && wordCount <= limits.max;
  const hasChanges = editedContent !== currentContent;

  const handleRefine = useCallback(async () => {
    setIsRefining(true);
    setError(null);
    try {
      const refined = await onRefine(feedback || undefined);
      setRefinedPreview(refined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refinement failed');
    } finally {
      setIsRefining(false);
    }
  }, [feedback, onRefine]);

  const handleApplyRefinement = useCallback(() => {
    if (refinedPreview) {
      setEditedContent(refinedPreview);
      setRefinedPreview(null);
    }
  }, [refinedPreview]);

  const handleSave = useCallback(async () => {
    if (!hasChanges && !refinedPreview) {
      onClose();
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave(editedContent);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }, [editedContent, hasChanges, refinedPreview, onSave, onClose]);

  const handleSwapSource = useCallback(
    async (newSourceId: string) => {
      if (!onSwapSource) return;

      setIsRefining(true);
      setError(null);
      try {
        const newContent = await onSwapSource(newSourceId);
        setEditedContent(newContent);
        setShowSources(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Source swap failed');
      } finally {
        setIsRefining(false);
      }
    },
    [onSwapSource]
  );

  const handleReset = useCallback(() => {
    setEditedContent(currentContent);
    setRefinedPreview(null);
    setFeedback('');
  }, [currentContent]);

  if (!isOpen || !target) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute inset-y-0 right-0 w-full max-w-xl bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Edit {SECTION_LABELS[target.type]}
              {target.index !== undefined && ` #${target.index + 1}`}
            </h2>
            {sourceId && (
              <p className="text-sm text-gray-500">Source: {sourceId}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Text Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Content
              </label>
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium ${
                    isValidWordCount
                      ? 'text-green-600'
                      : wordCount < limits.min
                      ? 'text-amber-600'
                      : 'text-red-600'
                  }`}
                >
                  {wordCount} words
                </span>
                <span className="text-sm text-gray-400">
                  ({limits.min}-{limits.max} required)
                </span>
              </div>
            </div>
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full h-40 p-4 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter content..."
            />
            {hasChanges && (
              <button
                onClick={handleReset}
                className="mt-2 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset to original
              </button>
            )}
          </div>

          {/* AI Refinement */}
          <div className="border-t pt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              AI Refinement
            </h3>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="w-full h-20 p-3 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Optional: Add feedback for AI (e.g., 'make it more specific', 'emphasize leadership', 'focus on metrics')"
            />
            <button
              onClick={handleRefine}
              disabled={isRefining}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRefining ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Refining...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Refine with AI
                </>
              )}
            </button>
          </div>

          {/* Refined Preview */}
          {refinedPreview && (
            <div className="border rounded-lg p-4 bg-purple-50">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-purple-800">
                  AI Suggestion
                </h4>
                <span className="text-sm text-purple-600">
                  {refinedPreview.trim().split(/\s+/).filter(Boolean).length}{' '}
                  words
                </span>
              </div>
              <p className="text-sm text-gray-700 mb-3">{refinedPreview}</p>
              <div className="flex gap-2">
                <button
                  onClick={handleApplyRefinement}
                  className="flex-1 py-2 px-3 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700"
                >
                  Apply This Version
                </button>
                <button
                  onClick={() => setRefinedPreview(null)}
                  className="py-2 px-3 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          {/* Source Swapping */}
          {onSwapSource && availableSources.length > 0 && (
            <div className="border-t pt-6">
              <button
                onClick={() => setShowSources(!showSources)}
                className="w-full flex items-center justify-between text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <span>Available Sources ({availableSources.length})</span>
                {showSources ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showSources && (
                <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                  {availableSources.map((source) => (
                    <div
                      key={source.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        source.id === sourceId
                          ? 'border-blue-500 bg-blue-50'
                          : 'hover:border-gray-400 hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        if (source.id !== sourceId) {
                          handleSwapSource(source.id);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-500">
                          {source.id}
                        </span>
                        {source.id === sourceId && (
                          <span className="text-xs text-blue-600 font-medium">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-3">
                        {source.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="py-2.5 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || (!hasChanges && !refinedPreview)}
            className="flex items-center gap-2 py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
