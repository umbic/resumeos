'use client';

import { useState } from 'react';
import { GapReview } from '@/components/resume/v2/GapReview';
import type { WriterOutput, ValidationResult } from '@/types/v2';

type FlowState = 'input' | 'analyzing' | 'gap-review' | 'generating' | 'complete' | 'failed';

interface GenerationResult {
  writerOutput: WriterOutput;
  validation: ValidationResult;
  status: string;
}

export default function V2GeneratePage() {
  const [state, setState] = useState<FlowState>('input');
  const [jobDescription, setJobDescription] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleStartAnalysis() {
    if (!jobDescription.trim() || jobDescription.length < 100) {
      setError('Job description must be at least 100 characters');
      return;
    }

    setError(null);
    setState('analyzing');

    try {
      const res = await fetch('/api/v2/pipeline/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }

      setSessionId(data.sessionId);
      setState('gap-review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setState('input');
    }
  }

  async function handleApproveAndGenerate() {
    if (!sessionId) return;

    setState('generating');

    try {
      // Generate (approve is handled by GapReview component)
      const generateRes = await fetch('/api/v2/pipeline/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const generateData = await generateRes.json();
      if (!generateData.success) {
        throw new Error(generateData.error || 'Generation failed');
      }

      setResult({
        writerOutput: generateData.writerOutput,
        validation: generateData.validation,
        status: generateData.status,
      });
      setState(generateData.status === 'complete' ? 'complete' : 'failed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setState('failed');
    }
  }

  function handleReset() {
    setState('input');
    setJobDescription('');
    setSessionId(null);
    setResult(null);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">ResumeOS V2</h1>
              <p className="text-gray-600 mt-2">
                4-agent pipeline with gap analysis and validation
              </p>
            </div>
            <a
              href="/"
              className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
            >
              Back to V1
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
          <StepConnector
            complete={['gap-review', 'generating', 'complete', 'failed'].includes(state)}
          />
          <Step
            number={2}
            label="Analyze"
            active={state === 'analyzing'}
            complete={['gap-review', 'generating', 'complete'].includes(state)}
          />
          <StepConnector
            complete={['generating', 'complete', 'failed'].includes(state)}
          />
          <Step
            number={3}
            label="Review Gaps"
            active={state === 'gap-review'}
            complete={['generating', 'complete'].includes(state)}
          />
          <StepConnector complete={state === 'complete'} />
          <Step
            number={4}
            label="Generate"
            active={state === 'generating'}
            complete={state === 'complete'}
          />
        </div>

        {/* Error Display */}
        {error && state !== 'failed' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* State: Input */}
        {state === 'input' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Paste Job Description</h2>
            <textarea
              className="w-full h-64 border rounded-lg p-4 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                onClick={handleStartAnalysis}
                disabled={jobDescription.length < 100}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Analyze Job Description
              </button>
            </div>
          </div>
        )}

        {/* State: Analyzing */}
        {state === 'analyzing' && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Analyzing Job Description</h2>
            <p className="text-gray-600">
              Running JD Strategist → Content Selection → Gap Analysis
            </p>
            <p className="text-sm text-gray-400 mt-4">This takes 30-60 seconds...</p>
          </div>
        )}

        {/* State: Gap Review */}
        {state === 'gap-review' && sessionId && (
          <GapReview sessionId={sessionId} onApprove={handleApproveAndGenerate} />
        )}

        {/* State: Generating */}
        {state === 'generating' && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Generating Resume</h2>
            <p className="text-gray-600">Running Resume Writer → Validator</p>
            <p className="text-sm text-gray-400 mt-4">This takes 60-90 seconds...</p>
          </div>
        )}

        {/* State: Complete */}
        {state === 'complete' && result && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h2 className="text-xl font-bold text-green-800 mb-2">
                Resume Generated Successfully
              </h2>
              <div className="flex items-center gap-4 text-green-700">
                <span>
                  Validation: {result.validation.passed ? 'Passed' : 'Needs Review'}
                </span>
                <span>|</span>
                <span>Score: {result.validation.overallScore}/10</span>
              </div>
            </div>

            {/* Validation Scores */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold mb-4">Validation Scores</h3>
              <div className="grid grid-cols-3 gap-4">
                <ScoreCard
                  label="Honesty"
                  score={result.validation.honesty.score}
                  passed={result.validation.honesty.passed}
                />
                <ScoreCard
                  label="Coverage"
                  score={result.validation.coverage.score}
                  passed={result.validation.coverage.passed}
                />
                <ScoreCard
                  label="Quality"
                  score={result.validation.quality.score}
                  passed={result.validation.quality.passed}
                />
              </div>
            </div>

            {/* Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold mb-4">Summary</h3>
              <p className="text-gray-700 whitespace-pre-wrap">
                {result.writerOutput.summary.content}
              </p>
            </div>

            {/* Career Highlights */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold mb-4">Career Highlights</h3>
              <ul className="space-y-3">
                {result.writerOutput.careerHighlights.map((ch, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-blue-600 font-bold">{i + 1}.</span>
                    <span className="text-gray-700">{ch.content}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Positions */}
            {result.writerOutput.positions.map((pos) => (
              <div key={pos.position} className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-1">
                  {pos.title} at {pos.company}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {pos.location} | {pos.dates}
                </p>
                <p className="text-gray-700 mb-4">{pos.overview.content}</p>
                {pos.bullets && pos.bullets.length > 0 && (
                  <ul className="space-y-2 ml-4">
                    {pos.bullets.map((bullet, i) => (
                      <li key={i} className="text-gray-700 list-disc">
                        {bullet.content}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {/* Actions */}
            <div className="flex gap-4 justify-center">
              <a
                href={`/v2/diagnostics/${sessionId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-lg transition-colors"
              >
                View Diagnostics
              </a>
              <button
                onClick={handleReset}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
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
            <p className="text-red-700 mb-4">
              {error || 'Validation found blocking issues'}
            </p>
            <div className="flex gap-4">
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
              <button onClick={handleReset} className="text-blue-600 hover:underline">
                Try Again
              </button>
            </div>
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
}: {
  number: number;
  label: string;
  active: boolean;
  complete: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
          complete
            ? 'bg-green-600 text-white'
            : active
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-500'
        }`}
      >
        {complete ? '✓' : number}
      </div>
      <span
        className={`text-sm mt-2 ${active ? 'text-blue-600 font-medium' : 'text-gray-500'}`}
      >
        {label}
      </span>
    </div>
  );
}

function StepConnector({ complete }: { complete: boolean }) {
  return (
    <div
      className={`flex-1 h-1 mx-2 transition-colors ${complete ? 'bg-green-600' : 'bg-gray-200'}`}
    />
  );
}

function ScoreCard({
  label,
  score,
  passed,
}: {
  label: string;
  score: number;
  passed: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-lg ${passed ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}
    >
      <div className="text-sm text-gray-600">{label}</div>
      <div className={`text-2xl font-bold ${passed ? 'text-green-600' : 'text-yellow-600'}`}>
        {score}/10
      </div>
    </div>
  );
}
