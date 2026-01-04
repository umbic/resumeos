'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Pencil, MessageSquare, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContentBank } from './ContentBank';
import { RefineChat } from './RefineChat';
import type { RefinementMessage } from '@/types';

interface SectionEditorProps {
  sessionId: string;
  sectionKey: string;
  currentContent: string;
  usedContentIds?: string[]; // Content IDs already used in the resume
  onClose: () => void;
  onSave: (newContent: string) => void;
}

type EditorTab = 'edit' | 'refine' | 'bank';

// Content bank query params
interface BankQueryParams {
  type: 'summary' | 'career_highlight' | 'bullet' | 'overview';
  position?: number;
}

// Parse section key to get bank query params
function getBankQueryParams(sectionKey: string): BankQueryParams {
  if (sectionKey === 'summary') {
    return { type: 'summary' };
  }

  if (sectionKey.startsWith('highlight_')) {
    return { type: 'career_highlight' };
  }

  if (sectionKey.startsWith('position_')) {
    const parts = sectionKey.split('_');
    const posNum = parseInt(parts[1]);
    const field = parts[2];

    if (field === 'overview') {
      return { type: 'overview', position: posNum };
    }

    if (field === 'bullet') {
      return { type: 'bullet', position: posNum };
    }
  }

  // Default fallback
  return { type: 'summary' };
}

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

export function SectionEditor({
  sessionId,
  sectionKey,
  currentContent,
  usedContentIds = [],
  onClose,
  onSave,
}: SectionEditorProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>('edit');
  const [content, setContent] = useState(currentContent);
  const [isSaving, setIsSaving] = useState(false);

  // Bank state
  const [bankItems, setBankItems] = useState<ContentBankItem[]>([]);
  const [loadingBank, setLoadingBank] = useState(false);
  const [bankFetched, setBankFetched] = useState(false);

  // Chat refinement state
  const [chatHistory, setChatHistory] = useState<RefinementMessage[]>([]);
  const [chatHistoryFetched, setChatHistoryFetched] = useState(false);

  const wordCount = countWords(content);
  const displayName = getSectionDisplayName(sectionKey);

  // Fetch chat history when component mounts or Refine tab is selected
  const fetchChatHistory = useCallback(async () => {
    if (chatHistoryFetched) return;

    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      const data = await response.json();

      if (data.session?.refinement_history) {
        const sectionHistory = data.session.refinement_history.filter(
          (m: RefinementMessage) => m.section === sectionKey
        );
        setChatHistory(sectionHistory);
      }
      setChatHistoryFetched(true);
    } catch (error) {
      console.error('Failed to fetch chat history:', error);
      setChatHistoryFetched(true);
    }
  }, [sessionId, sectionKey, chatHistoryFetched]);

  // Fetch chat history when Refine tab is activated
  useEffect(() => {
    if (activeTab === 'refine' && !chatHistoryFetched) {
      fetchChatHistory();
    }
  }, [activeTab, chatHistoryFetched, fetchChatHistory]);

  // Fetch bank items when Bank tab is selected
  const fetchBankItems = useCallback(async () => {
    if (bankFetched) return; // Don't refetch if already loaded

    setLoadingBank(true);
    try {
      const params = getBankQueryParams(sectionKey);

      const queryParams = new URLSearchParams({
        type: params.type,
      });

      if (params.position !== undefined) {
        queryParams.set('position', params.position.toString());
      }

      if (usedContentIds.length > 0) {
        queryParams.set('exclude', usedContentIds.join(','));
      }

      const response = await fetch(`/api/content-bank?${queryParams.toString()}`);
      const data = await response.json();

      if (data.items) {
        setBankItems(data.items);
      }
      setBankFetched(true);
    } catch (error) {
      console.error('Failed to fetch content bank:', error);
    } finally {
      setLoadingBank(false);
    }
  }, [sectionKey, usedContentIds, bankFetched]);

  // Fetch when Bank tab is activated
  useEffect(() => {
    if (activeTab === 'bank' && !bankFetched) {
      fetchBankItems();
    }
  }, [activeTab, bankFetched, fetchBankItems]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(content);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBankSelect = (selectedContent: string) => {
    setContent(selectedContent);
    setActiveTab('edit'); // Switch to edit mode so user can refine if needed
  };

  const handleRefined = (newContent: string, updatedHistory: RefinementMessage[]) => {
    setContent(newContent);
    setChatHistory(updatedHistory);
    setActiveTab('edit'); // Switch to edit mode to review/save
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
            <RefineChat
              sessionId={sessionId}
              sectionKey={sectionKey}
              currentContent={content}
              chatHistory={chatHistory}
              onRefined={handleRefined}
            />
          )}

          {activeTab === 'bank' && (
            <ContentBank
              sectionKey={sectionKey}
              items={bankItems}
              loading={loadingBank}
              onSelect={handleBankSelect}
            />
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
