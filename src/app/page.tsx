'use client';

import { useState } from 'react';
import { OneShotInput } from '@/components/resume/OneShotInput';
import { OneShotReview } from '@/components/resume/OneShotReview';
import type { GeneratedResume, Gap, QualityScore, KeywordGap, ATSKeyword } from '@/types';

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [resume, setResume] = useState<GeneratedResume | null>(null);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [keywordGaps, setKeywordGaps] = useState<KeywordGap[]>([]);
  const [atsKeywords, setAtsKeywords] = useState<ATSKeyword[]>([]);
  const [qualityScore, setQualityScore] = useState<QualityScore | null>(null);
  const [targetTitle, setTargetTitle] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleGenerate = async (jobDescription: string, format: 'long' | 'short') => {
    setIsLoading(true);

    try {
      // Step 1: Create session and analyze JD
      const analyzeResponse = await fetch('/api/analyze-jd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription, format }),
      });

      const analyzeData = await analyzeResponse.json();

      if (!analyzeData.sessionId) {
        throw new Error(analyzeData.error || 'Failed to analyze job description');
      }

      setSessionId(analyzeData.sessionId);
      setTargetTitle(analyzeData.analysis?.targetTitle || analyzeData.analysis?.strategic?.targetTitle || 'Role');
      setTargetCompany(analyzeData.analysis?.targetCompany || analyzeData.analysis?.strategic?.targetCompany || 'Company');

      // Store ATS keywords from analysis (convert to ATSKeyword format if needed)
      const keywords = analyzeData.analysis?.keywords || [];
      const formattedKeywords: ATSKeyword[] = keywords.map((k: { keyword: string; frequency?: number; priority: string; category?: string }) => ({
        keyword: k.keyword,
        frequency: k.frequency || 1,
        priority: k.priority as 'high' | 'medium' | 'low',
        category: k.category,
      }));
      setAtsKeywords(formattedKeywords);

      // Step 2: Generate full resume
      const generateResponse = await fetch('/api/generate-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: analyzeData.sessionId }),
      });

      const generateData = await generateResponse.json();

      if (!generateData.success) {
        throw new Error(generateData.error || 'Failed to generate resume');
      }

      setResume(generateData.resume);
      setGaps(generateData.gaps || []);
      setKeywordGaps(generateData.keyword_gaps || []);
      setQualityScore(generateData.quality_score);

    } catch (error) {
      console.error('Generation failed:', error);
      alert('Failed to generate resume. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!sessionId) return;

    setIsLoading(true);
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
      setIsLoading(false);
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

  // Show input page if no resume generated yet
  if (!resume) {
    return <OneShotInput onGenerate={handleGenerate} isLoading={isLoading} />;
  }

  // Show review page
  return (
    <OneShotReview
      sessionId={sessionId!}
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
    />
  );
}
