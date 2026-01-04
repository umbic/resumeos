'use client';

import { useState } from 'react';
import { X, Pencil, MessageSquare, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SectionEditorProps {
  sessionId: string;
  sectionKey: string;
  currentContent: string;
  onClose: () => void;
  onSave: (newContent: string) => void;
}

type EditorTab = 'edit' | 'refine' | 'bank';

function getSectionDisplayName(sectionKey: string): string {
  if (sectionKey === 'summary') return 'Summary';

  if (sectionKey.startsWith('highlight_')) {
    const num = sectionKey.split('_')[1];
    return `Career Highlight ${num}`;
  }

  if (sectionKey.startsWith('position_')) {
    const parts = sectionKey.split('_');
    const posNum = parts[1];
    const field = parts[2];

    if (field === 'overview') {
      return `Position ${posNum} Overview`;
    }
    if (field === 'bullet') {
      return `Position ${posNum} Bullet ${parts[3]}`;
    }
  }

  return sectionKey;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

export function SectionEditor({
  sectionKey,
  currentContent,
  onClose,
  onSave,
}: SectionEditorProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>('edit');
  const [content, setContent] = useState(currentContent);
  const [isSaving, setIsSaving] = useState(false);

  const wordCount = countWords(content);
  const displayName = getSectionDisplayName(sectionKey);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(content);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = content !== currentContent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Edit: {displayName}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6">
          <button
            onClick={() => setActiveTab('edit')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'edit'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          <button
            onClick={() => setActiveTab('refine')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'refine'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Refine
          </button>
          <button
            onClick={() => setActiveTab('bank')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'bank'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Database className="h-4 w-4" />
            Bank
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'edit' && (
            <div className="space-y-4">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-48 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm leading-relaxed"
                placeholder="Enter content..."
              />
              <div className="flex items-center justify-between text-sm">
                <span className={`${
                  wordCount > 55 ? 'text-orange-600' :
                  wordCount < 30 ? 'text-gray-400' :
                  'text-green-600'
                }`}>
                  Word count: {wordCount}
                  {sectionKey.includes('bullet') && (
                    <span className="text-gray-400 ml-2">(target: 30-40)</span>
                  )}
                  {sectionKey.includes('highlight') && (
                    <span className="text-gray-400 ml-2">(target: 40-55)</span>
                  )}
                  {sectionKey === 'summary' && (
                    <span className="text-gray-400 ml-2">(target: 50-75)</span>
                  )}
                  {sectionKey.includes('overview') && (
                    <span className="text-gray-400 ml-2">(target: 35-50)</span>
                  )}
                </span>
                {hasChanges && (
                  <span className="text-blue-600">Unsaved changes</span>
                )}
              </div>
            </div>
          )}

          {activeTab === 'refine' && (
            <div className="flex items-center justify-center h-48 text-gray-500">
              <div className="text-center">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>Refine with AI coming in next session</p>
              </div>
            </div>
          )}

          {activeTab === 'bank' && (
            <div className="flex items-center justify-center h-48 text-gray-500">
              <div className="text-center">
                <Database className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>Content Bank coming in next session</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
