'use client';

import { useState, useEffect } from 'react';
import { SessionDashboard } from '@/components/dashboard/SessionDashboard';
import { NewSessionModal } from '@/components/dashboard/NewSessionModal';
import { OneShotReview } from '@/components/resume/OneShotReview';
import type { GeneratedResume, Gap, QualityScore, KeywordGap, ATSKeyword } from '@/types';

export default function Home() {
  // Dashboard state
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);

  // Resume editor state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [resume, setResume] = useState<GeneratedResume | null>(null);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [keywordGaps, setKeywordGaps] = useState<KeywordGap[]>([]);
  const [atsKeywords, setAtsKeywords] = useState<ATSKeyword[]>([]);
  const [qualityScore, setQualityScore] = useState<QualityScore | null>(null);
  const [targetTitle, setTargetTitle] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Check URL for session parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSessionId = params.get('session');
    if (urlSessionId) {
      loadSession(urlSessionId);
    }
  }, []);

  const loadSession = async (id: string) => {
    setIsSessionLoading(true);
    try {
      // Get session data
      const sessionResponse = await fetch(`/api/sessions/${id}`);
      const sessionData = await sessionResponse.json();

      if (!sessionData.session) {
        throw new Error('Session not found');
      }

      const session = sessionData.session;

      setSessionId(id);
      setSessionName(session.name || '');
      setTargetTitle(session.target_title || '');
      setTargetCompany(session.target_company || '');

      if (session.generated_resume) {
        // Transform legacy resume format (objects -> strings)
        const resume = session.generated_resume;

        // Transform career_highlights from objects to strings if needed
        if (Array.isArray(resume.career_highlights)) {
          resume.career_highlights = resume.career_highlights.map((ch: unknown) => {
            if (typeof ch === 'string') return ch;
            if (ch && typeof ch === 'object' && 'content' in ch) {
              return (ch as { content: string }).content;
            }
            return String(ch || '');
          });
        }

        // Transform position bullets from objects to strings if needed
        if (Array.isArray(resume.positions)) {
          resume.positions = resume.positions.map((pos: { bullets?: unknown[] }) => {
            if (pos.bullets && Array.isArray(pos.bullets)) {
              pos.bullets = pos.bullets.map((b: unknown) => {
                if (typeof b === 'string') return b;
                if (b && typeof b === 'object' && 'content' in b) {
                  return (b as { content: string }).content;
                }
                return String(b || '');
              });
            }
            return pos;
          });
        }

        setResume(resume);
        setGaps(session.gaps || []);
        setKeywordGaps(session.keyword_gaps || []);
        setQualityScore(session.quality_score);

        // Get ATS keywords from analysis
        const keywords = session.jd_analysis?.keywords || [];
        const formattedKeywords: ATSKeyword[] = keywords.map((k: { keyword: string; frequency?: number; priority: string; category?: string }) => ({
          keyword: k.keyword,
          frequency: k.frequency || 1,
          priority: k.priority as 'high' | 'medium' | 'low',
          category: k.category,
        }));
        setAtsKeywords(formattedKeywords);
      }

      // Update URL without reloading
      window.history.pushState({}, '', `?session=${id}`);
    } catch (error) {
      console.error('Failed to load session:', error);
      alert('Failed to load session');
    } finally {
      setIsSessionLoading(false);
    }
  };

  const handleNewSession = () => {
    setShowNewSessionModal(true);
  };

  const handleSessionCreated = async (newSessionId: string) => {
    setShowNewSessionModal(false);
    await loadSession(newSessionId);
  };

  const handleOpenSession = async (id: string) => {
    await loadSession(id);
  };

  const handleBackToDashboard = () => {
    setSessionId(null);
    setResume(null);
    setGaps([]);
    setKeywordGaps([]);
    setAtsKeywords([]);
    setQualityScore(null);
    setTargetTitle('');
    setTargetCompany('');
    setSessionName('');
    window.history.pushState({}, '', '/');
  };

  const handleRegenerate = async () => {
    if (!sessionId) return;

    setIsSessionLoading(true);
    try {
      const response = await fetch('/api/generate-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const data = await response.json();

      if (data.success) {
        setResume(data.resume);
        setGaps(data.gaps || []);
        setKeywordGaps(data.keyword_gaps || []);
        setQualityScore(data.quality_score);
      }
    } catch (error) {
      console.error('Regeneration failed:', error);
    } finally {
      setIsSessionLoading(false);
    }
  };

  const handleExport = async () => {
    if (!sessionId) return;

    setIsExporting(true);
    try {
      const response = await fetch('/api/export-docx', {
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
      a.download = `Resume_${targetCompany.replace(/\s+/g, '_')}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Show loading state while loading a session
  if (isSessionLoading && !resume) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Loading session...</p>
        </div>
      </div>
    );
  }

  // Show dashboard if no session is selected
  if (!sessionId || !resume) {
    return (
      <>
        <SessionDashboard
          onNewSession={handleNewSession}
          onOpenSession={handleOpenSession}
        />
        <NewSessionModal
          isOpen={showNewSessionModal}
          onClose={() => setShowNewSessionModal(false)}
          onSessionCreated={handleSessionCreated}
        />
      </>
    );
  }

  // Show resume editor
  return (
    <OneShotReview
      sessionId={sessionId}
      resume={resume}
      gaps={gaps}
      keywordGaps={keywordGaps}
      atsKeywords={atsKeywords}
      qualityScore={qualityScore!}
      targetTitle={targetTitle}
      targetCompany={targetCompany}
      onResumeUpdate={setResume}
      onGapsUpdate={setGaps}
      onRegenerate={handleRegenerate}
      onExport={handleExport}
      isExporting={isExporting}
      onBackToDashboard={handleBackToDashboard}
      sessionName={sessionName}
    />
  );
}
