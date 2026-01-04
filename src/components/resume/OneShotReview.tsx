'use client';

import { useState } from 'react';
import type { GeneratedResume, Gap, QualityScore, KeywordGap, ATSKeyword } from '@/types';
import { GapRecommendations } from './GapRecommendations';
import { QualityIndicator } from './QualityIndicator';
import { ResumePreview } from './ResumePreview';
import { ChatRefinement } from './ChatRefinement';
import { KeywordGaps } from './KeywordGaps';
import { Download, RefreshCw, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { SectionEditor } from '@/components/editor/SectionEditor';

interface OneShotReviewProps {
  sessionId: string;
  resume: GeneratedResume;
  gaps: Gap[];
  keywordGaps: KeywordGap[];
  atsKeywords: ATSKeyword[];
  qualityScore: QualityScore;
  targetTitle: string;
  targetCompany: string;
  onResumeUpdate: (resume: GeneratedResume) => void;
  onGapsUpdate: (gaps: Gap[]) => void;
  onRegenerate: () => void;
  onExport: () => void;
  isExporting: boolean;
  onBackToDashboard?: () => void;
  sessionName?: string;
}

export function OneShotReview({
  sessionId,
  resume,
  gaps,
  keywordGaps,
  atsKeywords,
  qualityScore,
  targetTitle,
  targetCompany,
  onResumeUpdate,
  onGapsUpdate,
  onRegenerate,
  onExport,
  isExporting,
  onBackToDashboard,
  sessionName,
}: OneShotReviewProps) {
  const [showQualityDetails, setShowQualityDetails] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<{
    key: string;
    content: string;
  } | null>(null);

  const openGaps = gaps.filter(g => g.status === 'open');

  const handleSectionClick = (sectionKey: string, content: string) => {
    setActiveSection(sectionKey);
    setEditingSection({ key: sectionKey, content });
  };

  const handleSectionSave = async (newContent: string) => {
    if (!editingSection) return;

    try {
      const response = await fetch(`/api/sessions/${sessionId}/section`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionKey: editingSection.key,
          content: newContent,
        }),
      });

      const data = await response.json();

      if (data.success && data.resume) {
        onResumeUpdate(data.resume);
      }

      setEditingSection(null);
      setActiveSection(null);
    } catch (error) {
      console.error('Failed to save section:', error);
      alert('Failed to save changes. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBackToDashboard && (
              <button
                onClick={onBackToDashboard}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </button>
            )}
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {sessionName || `Resume for ${targetTitle}`}
              </h1>
              <p className="text-sm text-gray-500">
                {targetTitle} at {targetCompany}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </button>

            <button
              onClick={onExport}
              disabled={isExporting}
              className="flex items-center gap-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {isExporting ? 'Exporting...' : 'Export DOCX'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column: Resume Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <ResumePreview
                resume={resume}
                onSectionClick={handleSectionClick}
                activeSection={activeSection}
              />
            </div>
          </div>

          {/* Right Column: Panels */}
          <div className="space-y-4">

            {/* Quality Score */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowQualityDetails(!showQualityDetails)}
              >
                <h3 className="font-medium text-gray-900">Quality Score</h3>
                {showQualityDetails ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </div>
              <div className="mt-3">
                <QualityIndicator
                  score={qualityScore}
                  showDetails={showQualityDetails}
                />
              </div>
            </div>

            {/* Keyword Gaps */}
            <KeywordGaps
              keywordGaps={keywordGaps}
              atsKeywords={atsKeywords}
            />

            {/* Gap Recommendations */}
            {openGaps.length > 0 && (
              <GapRecommendations
                gaps={gaps}
                sessionId={sessionId}
                onGapAddressed={onGapsUpdate}
                onResumeUpdated={onResumeUpdate}
              />
            )}

            {/* Chat Refinement */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900 mb-3">Refine via Chat</h3>
              <ChatRefinement
                sessionId={sessionId}
                activeSection={activeSection}
                onResumeUpdate={onResumeUpdate}
              />
            </div>

            {/* Theme Coverage */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900 mb-3">Theme Coverage</h3>
              <div className="space-y-2">
                {resume.themes_addressed?.map((theme, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-gray-700">{theme}</span>
                  </div>
                ))}
                {resume.themes_not_addressed?.map((theme, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 bg-red-400 rounded-full" />
                    <span className="text-gray-500">{theme}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Section Editor Modal */}
      {editingSection && (
        <SectionEditor
          sessionId={sessionId}
          sectionKey={editingSection.key}
          currentContent={editingSection.content}
          usedContentIds={resume.content_ids_used || []}
          onClose={() => {
            setEditingSection(null);
            setActiveSection(null);
          }}
          onSave={handleSectionSave}
        />
      )}
    </div>
  );
}
