'use client';

import { useState } from 'react';
import type { ResumeV3 } from '@/lib/v3/types';
import type { CoverageReport } from '@/lib/v3/coverage-report';

type FlowState = 'input' | 'generating' | 'complete' | 'failed';

interface GenerateResult {
  success: boolean;
  resume?: ResumeV3;
  coverageReport?: CoverageReport;
  diagnostics?: {
    sessionId: string;
    totalCost: number;
    totalDurationMs: number;
    steps: Array<{
      step: string;
      status: string;
      durationMs: number;
      retryCount: number;
    }>;
  };
  error?: string;
}

export default function V3Page() {
  const [state, setState] = useState<FlowState>('input');
  const [jobDescription, setJobDescription] = useState('');
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  async function handleGenerate() {
    if (!jobDescription.trim() || jobDescription.length < 100) {
      setError('Job description must be at least 100 characters');
      return;
    }

    setError(null);
    setState('generating');

    try {
      const res = await fetch('/api/v3/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription }),
      });

      const data: GenerateResult = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Generation failed');
      }

      setResult(data);
      setState('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setState('failed');
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch('/api/v3/generate/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription }),
      });

      if (!res.ok) {
        throw new Error('Download failed');
      }

      const blob = await res.blob();
      const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'resume.docx';

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  }

  function handleReset() {
    setState('input');
    setJobDescription('');
    setResult(null);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">ResumeOS V3</h1>
            <p className="text-gray-600 mt-1">
              Opus 4.5 powered resume generation with phrase-level JD mapping
            </p>
          </div>
          <a
            href="/"
            className="text-gray-600 hover:text-gray-900"
          >
            Back to Dashboard
          </a>
        </div>

        {/* State: Input */}
        {state === 'input' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Paste Job Description</h2>
              <p className="text-gray-600 mb-4">
                V3 uses Claude Opus 4.5 to analyze the JD at phrase-level and generate a tailored resume in a single pass.
              </p>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-red-700 text-sm">
                  {error}
                </div>
              )}
              <textarea
                className="w-full h-64 border rounded-lg p-4 font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="Paste the full job description here..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
              <div className="flex justify-between items-center mt-4">
                <span
                  className={`text-sm ${jobDescription.length < 100 ? 'text-red-500' : 'text-gray-500'}`}
                >
                  {jobDescription.length} characters
                  {jobDescription.length < 100 && ' (minimum 100)'}
                </span>
                <button
                  onClick={handleGenerate}
                  disabled={jobDescription.length < 100}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Generate with V3
                </button>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="font-bold text-purple-800 mb-2">V3 Features</h3>
              <ul className="text-purple-700 text-sm space-y-1">
                <li>Phrase-level JD analysis (not abstract tags)</li>
                <li>Explicit JD mapping for every section</li>
                <li>Coverage report with A-F grading</li>
                <li>Pattern proof in P2 bullets</li>
                <li>Powered by Claude Opus 4.5</li>
              </ul>
            </div>
          </div>
        )}

        {/* State: Generating */}
        {state === 'generating' && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Generating Resume with V3</h2>
            <p className="text-gray-600">Running 6-step Opus pipeline...</p>
            <p className="text-sm text-gray-400 mt-4">
              JD Analysis → Summary → Career Highlights → P1 → P2 → P3-P6
            </p>
            <p className="text-xs text-gray-400 mt-2">This takes 2-4 minutes with Opus...</p>
          </div>
        )}

        {/* State: Complete */}
        {state === 'complete' && result?.resume && (
          <div className="space-y-6">
            {/* Success Header */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-green-800 mb-2">
                    Resume Generated Successfully
                  </h2>
                  <div className="flex items-center gap-4 text-green-700 text-sm">
                    <span>Coverage: {result.coverageReport?.overall.grade}</span>
                    <span>|</span>
                    <span>Score: {result.coverageReport?.overall.score}/100</span>
                    <span>|</span>
                    <span>Cost: ${result.diagnostics?.totalCost.toFixed(2)}</span>
                    <span>|</span>
                    <span>Time: {((result.diagnostics?.totalDurationMs || 0) / 1000).toFixed(1)}s</span>
                  </div>
                </div>
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {downloading ? 'Downloading...' : 'Download DOCX'}
                </button>
              </div>
            </div>

            {/* Coverage Report */}
            {result.coverageReport && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">JD Coverage Report</h3>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-3xl font-bold text-purple-600">
                      {result.coverageReport.overall.grade}
                    </div>
                    <div className="text-sm text-gray-500">Grade</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold">
                      {result.coverageReport.phrases.highUsed}/{result.coverageReport.phrases.highTotal}
                    </div>
                    <div className="text-sm text-gray-500">HIGH Phrases Used</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold">
                      {result.coverageReport.sections.filter(s => s.coverage === 'Strong').length}
                    </div>
                    <div className="text-sm text-gray-500">Strong Sections</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-500">
                      {result.coverageReport.gaps.length}
                    </div>
                    <div className="text-sm text-gray-500">Gaps</div>
                  </div>
                </div>
                {result.coverageReport.recommendations.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Recommendations:</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {result.coverageReport.recommendations.map((rec, i) => (
                        <li key={i}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold mb-4">Summary</h3>
              <p className="text-gray-700 whitespace-pre-wrap">
                {result.resume.summary}
              </p>
            </div>

            {/* Career Highlights */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold mb-4">Career Highlights</h3>
              <ul className="space-y-3">
                {result.resume.careerHighlights.map((ch, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-purple-600 font-bold">{i + 1}.</span>
                    <div>
                      <span className="font-bold">{ch.headline}:</span>{' '}
                      <span className="text-gray-700">{ch.content.replace(/\*\*[^*]+\*\*:\s*/, '')}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Positions */}
            {result.resume.positions.map((pos) => (
              <div key={pos.number} className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-1">
                  {pos.title} at {pos.company}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {pos.location} | {pos.startDate} - {pos.endDate}
                </p>
                <p className="text-gray-700 mb-4">{pos.overview}</p>
                {pos.bullets && pos.bullets.length > 0 && (
                  <ul className="space-y-2 ml-4">
                    {pos.bullets.map((bullet, i) => (
                      <li key={i} className="text-gray-700 list-disc">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {/* Pipeline Steps */}
            {result.diagnostics && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">Pipeline Diagnostics</h3>
                <div className="space-y-2">
                  {result.diagnostics.steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-4 text-sm">
                      <span className={`w-20 font-medium ${step.status === 'success' ? 'text-green-600' : step.status === 'retry' ? 'text-yellow-600' : 'text-red-600'}`}>
                        {step.status}
                      </span>
                      <span className="w-24 font-mono">{step.step}</span>
                      <span className="text-gray-500">{(step.durationMs / 1000).toFixed(1)}s</span>
                      {step.retryCount > 0 && (
                        <span className="text-yellow-600 text-xs">({step.retryCount} retries)</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg disabled:opacity-50 transition-colors"
              >
                {downloading ? 'Downloading...' : 'Download DOCX'}
              </button>
              <button
                onClick={handleReset}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Generate Another
              </button>
            </div>
          </div>
        )}

        {/* State: Failed */}
        {state === 'failed' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-800 mb-2">Generation Failed</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <button onClick={handleReset} className="text-blue-600 hover:underline">
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
