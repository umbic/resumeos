'use client';

import { useState } from 'react';

type FlowState =
  | 'input'
  | 'analyzing'
  | 'gap-review'
  | 'generating'
  | 'complete'
  | 'failed';

interface GapAnalysis {
  overallCoverage: number | { score: number; assessment: string; summary: string };
  honestGaps?: { requirement: string; gap: string; impact: string }[];
  warnings?: { type: string; message: string }[];
}

interface AllocationSummary {
  careerHighlights: number;
  p1Bullets: number;
  p2Bullets: number;
}

interface ValidationResult {
  verdict: string;
  scores: {
    honesty: number;
    coverage: number;
    quality: number;
    format: number;
  };
  issues: {
    totalIssues: number;
    blockers: number;
    warnings: number;
  };
}

interface CostBreakdown {
  total: number;
  breakdown?: Record<string, { cost: number }>;
}

export default function V21GeneratePage() {
  const [state, setState] = useState<FlowState>('input');
  const [jobDescription, setJobDescription] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysis | null>(null);
  const [allocation, setAllocation] = useState<AllocationSummary | null>(null);
  const [resumeMarkdown, setResumeMarkdown] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [costs, setCosts] = useState<CostBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [additionalContext, setAdditionalContext] = useState('');

  // ─────────────────────────────────────────────────────────────
  // Step 1: Start Analysis
  // ─────────────────────────────────────────────────────────────
  async function handleStartAnalysis() {
    if (!jobDescription.trim() || jobDescription.length < 100) {
      setError('Job description must be at least 100 characters');
      return;
    }

    setError(null);
    setState('analyzing');

    try {
      const res = await fetch('/api/v2.1/pipeline/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription })
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }

      setSessionId(data.sessionId);
      setGapAnalysis(data.gapAnalysis);
      setAllocation(data.allocation);
      setState('gap-review');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setState('input');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Step 2: Approve and Generate
  // ─────────────────────────────────────────────────────────────
  async function handleApproveAndGenerate() {
    if (!sessionId) return;

    setState('generating');
    setError(null);

    try {
      // Approve
      const approveRes = await fetch('/api/v2/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          additionalContext: additionalContext.trim() || undefined
        })
      });

      const approveData = await approveRes.json();
      if (!approveData.success) {
        throw new Error(approveData.error || 'Approval failed');
      }

      // Generate
      const generateRes = await fetch('/api/v2.1/pipeline/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      const generateData = await generateRes.json();
      if (!generateData.success) {
        throw new Error(generateData.error || 'Generation failed');
      }

      setResumeMarkdown(generateData.resumeMarkdown);
      setValidation(generateData.validation);
      setCosts(generateData.costs);
      setState(generateData.status === 'complete' ? 'complete' : 'failed');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setState('failed');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Reset
  // ─────────────────────────────────────────────────────────────
  function handleReset() {
    setState('input');
    setJobDescription('');
    setSessionId(null);
    setGapAnalysis(null);
    setAllocation(null);
    setResumeMarkdown(null);
    setValidation(null);
    setCosts(null);
    setError(null);
    setAdditionalContext('');
  }

  // ─────────────────────────────────────────────────────────────
  // Download DOCX
  // ─────────────────────────────────────────────────────────────
  async function handleDownload() {
    if (!sessionId) return;

    try {
      const response = await fetch('/api/v2.1/export-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get the blob and trigger download
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
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto py-8 px-4">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">ResumeOS V2.1</h1>
              <p className="text-gray-600 mt-2">
                Two-phase writer with exclusive content allocation
              </p>
            </div>
            <a
              href="/"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Back to Home
            </a>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8 px-4">
          <Step
            number={1}
            label="Input JD"
            active={state === 'input'}
            complete={state !== 'input'}
          />
          <StepConnector active={state !== 'input'} />
          <Step
            number={2}
            label="Analyze"
            active={state === 'analyzing'}
            complete={['gap-review', 'generating', 'complete', 'failed'].includes(state)}
          />
          <StepConnector active={['gap-review', 'generating', 'complete', 'failed'].includes(state)} />
          <Step
            number={3}
            label="Review & Approve"
            active={state === 'gap-review'}
            complete={['generating', 'complete', 'failed'].includes(state)}
          />
          <StepConnector active={['generating', 'complete', 'failed'].includes(state)} />
          <Step
            number={4}
            label="Generate"
            active={state === 'generating'}
            complete={state === 'complete'}
            failed={state === 'failed'}
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────── */}
        {/* State: Input */}
        {/* ─────────────────────────────────────────────────────────── */}
        {state === 'input' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Paste Job Description</h2>
            <textarea
              className="w-full h-64 border rounded-lg p-4 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Paste the full job description here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
            <div className="flex justify-between items-center mt-4">
              <span className="text-sm text-gray-500">
                {jobDescription.length} characters
                {jobDescription.length < 100 && jobDescription.length > 0 && (
                  <span className="text-red-500 ml-2">(minimum 100)</span>
                )}
              </span>
              <button
                onClick={handleStartAnalysis}
                disabled={jobDescription.length < 100}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Analyze Job Description
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────── */}
        {/* State: Analyzing */}
        {/* ─────────────────────────────────────────────────────────── */}
        {state === 'analyzing' && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Analyzing Job Description</h2>
            <p className="text-gray-600">JD Strategist - Content Selection - Allocation - Gap Analysis</p>
            <p className="text-sm text-gray-400 mt-4">This takes 45-60 seconds...</p>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────── */}
        {/* State: Gap Review */}
        {/* ─────────────────────────────────────────────────────────── */}
        {state === 'gap-review' && gapAnalysis && (
          <div className="space-y-6">
            {/* Coverage Score */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Coverage Analysis</h2>
                  <p className="text-gray-600 mt-1">Review gaps before generating</p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-blue-600">
                    {typeof gapAnalysis.overallCoverage === 'object'
                      ? gapAnalysis.overallCoverage.score
                      : gapAnalysis.overallCoverage}/10
                  </div>
                  <div className="text-sm text-gray-500">Coverage Score</div>
                </div>
              </div>
            </div>

            {/* Allocation Summary */}
            {allocation && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-bold mb-3">Content Allocated</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-2xl font-bold">{allocation.careerHighlights}</div>
                    <div className="text-sm text-gray-500">Career Highlights</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-2xl font-bold">{allocation.p1Bullets}</div>
                    <div className="text-sm text-gray-500">P1 Bullets</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-2xl font-bold">{allocation.p2Bullets}</div>
                    <div className="text-sm text-gray-500">P2 Bullets</div>
                  </div>
                </div>
              </div>
            )}

            {/* Gaps */}
            {gapAnalysis.honestGaps && gapAnalysis.honestGaps.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h3 className="font-bold text-yellow-800 mb-3">
                  {gapAnalysis.honestGaps.length} Gap{gapAnalysis.honestGaps.length !== 1 ? 's' : ''} Identified
                </h3>
                <div className="space-y-3">
                  {gapAnalysis.honestGaps.map((gap, i) => (
                    <div key={i} className="bg-white rounded p-3 border border-yellow-100">
                      <p className="font-medium text-yellow-900">{gap.requirement}</p>
                      <p className="text-yellow-700 text-sm mt-1">{gap.gap}</p>
                      {gap.impact && (
                        <p className="text-yellow-600 text-xs mt-1 italic">Impact: {gap.impact}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {gapAnalysis.warnings && gapAnalysis.warnings.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                <h3 className="font-bold text-orange-800 mb-3">
                  {gapAnalysis.warnings.length} Warning{gapAnalysis.warnings.length !== 1 ? 's' : ''}
                </h3>
                <div className="space-y-2">
                  {gapAnalysis.warnings.map((warning, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-orange-500 mt-0.5">⚠</span>
                      <div>
                        <span className="font-medium text-orange-800">{warning.type}: </span>
                        <span className="text-orange-700">{warning.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Context Input */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold mb-2">Additional Context (Optional)</h3>
              <p className="text-gray-600 text-sm mb-3">
                Add any specific instructions or context for the resume writer.
              </p>
              <textarea
                className="w-full h-24 border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Emphasize my B2B SaaS experience, downplay the consulting work, focus on GTM achievements..."
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
              />
            </div>

            {/* Approve Button */}
            <div className="flex justify-end">
              <button
                onClick={handleApproveAndGenerate}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition-colors"
              >
                Approve & Generate Resume
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────── */}
        {/* State: Generating */}
        {/* ─────────────────────────────────────────────────────────── */}
        {state === 'generating' && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Generating Resume</h2>
            <p className="text-gray-600">Narrative Writer - Detail Writer - Validator - Assembler</p>
            <p className="text-sm text-gray-400 mt-4">This takes 60-90 seconds...</p>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────── */}
        {/* State: Complete */}
        {/* ─────────────────────────────────────────────────────────── */}
        {state === 'complete' && resumeMarkdown && (
          <div className="space-y-6">
            {/* Success Banner */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-bold text-green-800">Resume Generated</h2>
                  <p className="text-green-700 mt-1">
                    Validation: {validation?.verdict || 'passed'}
                  </p>
                </div>
                {validation?.scores && (
                  <div className="flex gap-2 flex-wrap">
                    <ScoreBadge label="Honesty" score={validation.scores.honesty} />
                    <ScoreBadge label="Coverage" score={validation.scores.coverage} />
                    <ScoreBadge label="Quality" score={validation.scores.quality} />
                    <ScoreBadge label="Format" score={validation.scores.format} />
                  </div>
                )}
              </div>
            </div>

            {/* Validation Issues */}
            {validation?.issues && validation.issues.totalIssues > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">
                  {validation.issues.blockers} blockers, {validation.issues.warnings} warnings
                </p>
              </div>
            )}

            {/* Resume Preview */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold mb-4">Resume Preview</h3>
              <div className="prose max-w-none">
                <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg overflow-auto max-h-[600px]">
                  {resumeMarkdown}
                </pre>
              </div>
            </div>

            {/* Costs */}
            {costs && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  Total Cost: <span className="font-bold">${costs.total?.toFixed(3)}</span>
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4 flex-wrap">
              {sessionId && (
                <button
                  onClick={() => handleDownload()}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Download DOCX
                </button>
              )}
              {sessionId && (
                <a
                  href={`/v2.1/diagnostics/${sessionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  View Diagnostics
                </a>
              )}
              <button
                onClick={handleReset}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Generate Another
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────── */}
        {/* State: Failed */}
        {/* ─────────────────────────────────────────────────────────── */}
        {state === 'failed' && (
          <div className="space-y-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-xl font-bold text-red-800 mb-2">Generation Failed</h2>
              <p className="text-red-700 mb-4">
                {error || 'Validation found blocking issues'}
              </p>
              {sessionId && (
                <a
                  href={`/v2/diagnostics/${sessionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  View Diagnostics to debug
                </a>
              )}
            </div>
            <button
              onClick={handleReset}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Start Over
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────

function Step({
  number,
  label,
  active,
  complete,
  failed = false
}: {
  number: number;
  label: string;
  active: boolean;
  complete: boolean;
  failed?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
        failed ? 'bg-red-600 text-white' :
        complete ? 'bg-green-600 text-white' :
        active ? 'bg-blue-600 text-white' :
        'bg-gray-200 text-gray-500'
      }`}>
        {complete && !failed ? '\u2713' : failed ? '\u2717' : number}
      </div>
      <span className={`text-sm mt-2 ${active ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
        {label}
      </span>
    </div>
  );
}

function StepConnector({ active }: { active: boolean }) {
  return (
    <div className={`flex-1 h-1 mx-2 transition-colors ${active ? 'bg-green-600' : 'bg-gray-200'}`} />
  );
}

function ScoreBadge({ label, score }: { label: string; score: number }) {
  const color = score >= 8 ? 'bg-green-100 text-green-800' :
                score >= 6 ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800';
  return (
    <div className={`px-3 py-1 rounded-full text-sm ${color}`}>
      {label}: {score}/10
    </div>
  );
}
