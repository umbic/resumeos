'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, FileText, Library, Loader2 } from 'lucide-react';
import { InteractiveResume, type EditTarget } from '@/components/v21/InteractiveResume';
import { SectionEditor } from '@/components/v21/SectionEditor';
import { ContentBankSidebar } from '@/components/v21/ContentBankSidebar';
import type {
  AssembledResume,
  NarrativeWriterOutput,
  DetailWriterOutput,
  ContentAllocation,
  JDStrategy,
} from '@/types/v2.1';

interface V21Session {
  jdStrategy: JDStrategy;
  contentAllocation: ContentAllocation;
  narrativeOutput: NarrativeWriterOutput;
  detailOutput: DetailWriterOutput;
  assembledResume: AssembledResume;
}

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function V21ViewPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.sessionId;

  const [session, setSession] = useState<V21Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<EditTarget | null>(null);
  const [showContentBank, setShowContentBank] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Fetch session data
  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(`/api/v2.1/session/${sessionId}`);
        const data = await res.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch session');
        }

        setSession(data.session);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session');
      } finally {
        setLoading(false);
      }
    }

    fetchSession();
  }, [sessionId]);

  // Get current content for the editing section
  const getCurrentContent = useCallback((): string => {
    if (!session || !editingTarget) return '';

    switch (editingTarget.type) {
      case 'summary':
        return session.assembledResume.summary;

      case 'career-highlight':
        if (editingTarget.index !== undefined) {
          return session.assembledResume.careerHighlights[editingTarget.index] || '';
        }
        return '';

      case 'position-overview':
        if (editingTarget.positionIndex !== undefined) {
          return (
            session.assembledResume.positions[editingTarget.positionIndex]?.overview || ''
          );
        }
        return '';

      case 'position-bullet':
        if (
          editingTarget.positionIndex !== undefined &&
          editingTarget.bulletIndex !== undefined
        ) {
          return (
            session.assembledResume.positions[editingTarget.positionIndex]?.bullets?.[
              editingTarget.bulletIndex
            ] || ''
          );
        }
        return '';

      default:
        return '';
    }
  }, [session, editingTarget]);

  // Get source ID for the editing section
  const getSourceId = useCallback((): string | undefined => {
    if (!session || !editingTarget) return undefined;

    switch (editingTarget.type) {
      case 'summary':
        return session.narrativeOutput.summary.sourcesUsed.join(', ');

      case 'career-highlight':
        if (editingTarget.index !== undefined) {
          return session.narrativeOutput.careerHighlights[editingTarget.index]?.sourceId;
        }
        return undefined;

      case 'position-overview':
        if (editingTarget.positionIndex !== undefined) {
          const posKey = editingTarget.positionIndex === 0 ? 'position1' : 'position2';
          return session.detailOutput[posKey]?.overview?.sourceId;
        }
        return undefined;

      case 'position-bullet':
        if (
          editingTarget.positionIndex !== undefined &&
          editingTarget.bulletIndex !== undefined
        ) {
          const posKey = editingTarget.positionIndex === 0 ? 'position1' : 'position2';
          return session.detailOutput[posKey]?.bullets?.[editingTarget.bulletIndex]?.sourceId;
        }
        return undefined;

      default:
        return undefined;
    }
  }, [session, editingTarget]);

  // Save manual edits
  const handleSave = useCallback(
    async (newContent: string) => {
      if (!session || !editingTarget) return;

      // Build the update path based on section type
      const updates: Partial<V21Session> = {};

      switch (editingTarget.type) {
        case 'summary':
          updates.assembledResume = {
            ...session.assembledResume,
            summary: newContent,
          };
          updates.narrativeOutput = {
            ...session.narrativeOutput,
            summary: {
              ...session.narrativeOutput.summary,
              content: newContent,
              wordCount: newContent.trim().split(/\s+/).filter(Boolean).length,
            },
          };
          break;

        case 'career-highlight':
          if (editingTarget.index !== undefined) {
            const newHighlights = [...session.assembledResume.careerHighlights];
            newHighlights[editingTarget.index] = newContent;
            updates.assembledResume = {
              ...session.assembledResume,
              careerHighlights: newHighlights,
            };

            // Update narrative output too
            const newNarrativeHighlights = [...session.narrativeOutput.careerHighlights];
            if (newNarrativeHighlights[editingTarget.index]) {
              // Parse headline and description from the content
              const parts = newContent.split(':');
              const headline = parts[0]?.replace(/\*\*/g, '').trim() || '';
              const description = parts.slice(1).join(':').trim() || newContent;
              newNarrativeHighlights[editingTarget.index] = {
                ...newNarrativeHighlights[editingTarget.index],
                headline,
                content: description,
              };
            }
            updates.narrativeOutput = {
              ...session.narrativeOutput,
              careerHighlights: newNarrativeHighlights,
            };
          }
          break;

        case 'position-overview':
          if (editingTarget.positionIndex !== undefined) {
            const newPositions = [...session.assembledResume.positions];
            newPositions[editingTarget.positionIndex] = {
              ...newPositions[editingTarget.positionIndex],
              overview: newContent,
            };
            updates.assembledResume = {
              ...session.assembledResume,
              positions: newPositions,
            };

            // Update detail output too
            if (editingTarget.positionIndex < 2) {
              const posKey = editingTarget.positionIndex === 0 ? 'position1' : 'position2';
              updates.detailOutput = {
                ...session.detailOutput,
                [posKey]: {
                  ...session.detailOutput[posKey],
                  overview: {
                    ...session.detailOutput[posKey].overview,
                    content: newContent,
                    wordCount: newContent.trim().split(/\s+/).filter(Boolean).length,
                  },
                },
              };
            }
          }
          break;

        case 'position-bullet':
          if (
            editingTarget.positionIndex !== undefined &&
            editingTarget.bulletIndex !== undefined
          ) {
            const newPositions = [...session.assembledResume.positions];
            const newBullets = [...(newPositions[editingTarget.positionIndex].bullets || [])];
            newBullets[editingTarget.bulletIndex] = newContent;
            newPositions[editingTarget.positionIndex] = {
              ...newPositions[editingTarget.positionIndex],
              bullets: newBullets,
            };
            updates.assembledResume = {
              ...session.assembledResume,
              positions: newPositions,
            };

            // Update detail output too
            if (editingTarget.positionIndex < 2) {
              const posKey = editingTarget.positionIndex === 0 ? 'position1' : 'position2';
              const newDetailBullets = [...session.detailOutput[posKey].bullets];
              if (newDetailBullets[editingTarget.bulletIndex]) {
                newDetailBullets[editingTarget.bulletIndex] = {
                  ...newDetailBullets[editingTarget.bulletIndex],
                  content: newContent,
                  wordCount: newContent.trim().split(/\s+/).filter(Boolean).length,
                };
              }
              updates.detailOutput = {
                ...session.detailOutput,
                [posKey]: {
                  ...session.detailOutput[posKey],
                  bullets: newDetailBullets,
                },
              };
            }
          }
          break;
      }

      // Send update to API
      const res = await fetch(`/api/v2.1/session/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save changes');
      }

      // Update local state
      setSession(data.session);
    },
    [session, editingTarget, sessionId]
  );

  // AI refinement
  const handleRefine = useCallback(
    async (feedback?: string): Promise<string> => {
      if (!editingTarget) throw new Error('No section selected');

      const res = await fetch('/api/v2.1/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          sectionType: editingTarget.type,
          index: editingTarget.index,
          positionIndex: editingTarget.positionIndex,
          bulletIndex: editingTarget.bulletIndex,
          feedback,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Refinement failed');
      }

      return data.newContent;
    },
    [sessionId, editingTarget]
  );

  // Download DOCX
  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const response = await fetch('/api/v2.1/export-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Umberto_Castaldo_Resume_${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  }, [sessionId]);

  // Get used content IDs for the content bank
  const getUsedContentIds = useCallback((): string[] => {
    if (!session) return [];

    const ids: string[] = [];

    // Add summary sources
    ids.push(...session.narrativeOutput.summary.sourcesUsed);

    // Add career highlight sources
    session.narrativeOutput.careerHighlights.forEach((ch) => {
      ids.push(ch.sourceId);
    });

    // Add P1 sources
    if (session.detailOutput.position1) {
      ids.push(session.detailOutput.position1.overview.sourceId);
      session.detailOutput.position1.bullets.forEach((b) => {
        ids.push(b.sourceId);
      });
    }

    // Add P2 sources
    if (session.detailOutput.position2) {
      ids.push(session.detailOutput.position2.overview.sourceId);
      session.detailOutput.position2.bullets.forEach((b) => {
        ids.push(b.sourceId);
      });
    }

    return ids;
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Loading session...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Session not found'}</p>
          <Link
            href="/"
            className="text-blue-600 hover:underline flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sessions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>
              <div className="h-6 w-px bg-gray-200" />
              <div>
                <h1 className="text-lg font-bold text-gray-900">Resume Editor</h1>
                <p className="text-sm text-gray-500">
                  {session.jdStrategy?.company?.name || 'Unknown Company'} -{' '}
                  {session.jdStrategy?.role?.title || 'Unknown Role'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowContentBank(true)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Library className="w-4 h-4" />
                Content Bank
              </button>

              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download DOCX
              </button>

              <Link
                href={`/v2.1/diagnostics/${sessionId}`}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Diagnostics
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto py-8 px-6">
        <div className="mb-4 text-sm text-gray-500 text-center">
          Click any section to edit it. Word counts are shown on hover.
        </div>

        <InteractiveResume
          assembledResume={session.assembledResume}
          narrativeOutput={session.narrativeOutput}
          detailOutput={session.detailOutput}
          allocation={session.contentAllocation}
          onEditSection={(target) => setEditingTarget(target)}
        />
      </main>

      {/* Section Editor Modal */}
      <SectionEditor
        isOpen={!!editingTarget}
        onClose={() => setEditingTarget(null)}
        target={editingTarget}
        currentContent={getCurrentContent()}
        sourceId={getSourceId()}
        onSave={handleSave}
        onRefine={handleRefine}
      />

      {/* Content Bank Sidebar */}
      <ContentBankSidebar
        isOpen={showContentBank}
        onClose={() => setShowContentBank(false)}
        usedContentIds={getUsedContentIds()}
        onSelectContent={(contentId) => {
          console.log('Selected content:', contentId);
          // This could be used to start a source swap flow
        }}
      />
    </div>
  );
}
