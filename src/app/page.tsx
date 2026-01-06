'use client';

import { useState, useEffect, useCallback } from 'react';
import { GapReview } from '@/components/resume/v2/GapReview';
import type { WriterOutput, ValidationResult } from '@/types/v2';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type FlowState = 'list' | 'input' | 'analyzing' | 'gap-review' | 'generating' | 'complete' | 'failed';

interface SessionSummary {
  id: string;
  companyName: string;
  roleTitle: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  validationPassed: boolean | null;
  validationScore: number | null;
  totalCost: number | null;
  jdPreview: string;
  version?: 'v2' | 'v2.1';
}

interface GenerationResult {
  writerOutput: WriterOutput;
  validation: ValidationResult;
  status: string;
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export default function Home() {
  const [state, setState] = useState<FlowState>('list');
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  const [jobDescription, setJobDescription] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch sessions on mount
  const fetchSessions = useCallback(async () => {
    try {
      setLoadingSessions(true);
      const res = await fetch('/api/v2/sessions');
      const data = await res.json();
      if (data.success) {
        setSessions(data.sessions);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Resume an existing session
  async function handleResumeSession(session: SessionSummary) {
    setSessionId(session.id);
    setError(null);

    if (session.state === 'gap-review') {
      setState('gap-review');
    } else if (session.state === 'approved') {
      // Session was approved but not generated - go to generate
      setState('generating');
      await handleGenerate(session.id);
    } else if (session.state === 'complete') {
      // Fetch and show results
      await handleViewComplete(session.id);
    } else if (session.state === 'failed') {
      setState('failed');
      setError('This session failed. View diagnostics for details.');
    } else {
      // For other states, just view the session
      setState('gap-review');
    }
  }

  async function handleViewComplete(sid: string) {
    try {
      const res = await fetch(`/api/v2/diagnostics/${sid}`);
      const data = await res.json();
      if (data.success && data.diagnostics.finalOutput) {
        setResult({
          writerOutput: data.diagnostics.rawSession.writerOutput,
          validation: data.diagnostics.rawSession.validationResult,
          status: 'complete',
        });
        setSessionId(sid);
        setState('complete');
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  }

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
    await handleGenerate(sessionId);
  }

  async function handleGenerate(sid: string) {
    try {
      const generateRes = await fetch('/api/v2/pipeline/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      });

      const generateData = await generateRes.json();
      if (!generateData.success) {
        throw new Error(generateData.error || 'Generation failed');
      }

      setResult({
        writerOutput: generateData.writerOutput,
        validation: generateData.validation,
        status: generateData.state,
      });
      setState(generateData.state === 'complete' ? 'complete' : 'failed');

      // Refresh sessions list
      fetchSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setState('failed');
    }
  }

  function handleReset() {
    setState('list');
    setJobDescription('');
    setSessionId(null);
    setResult(null);
    setError(null);
    fetchSessions();
  }

  function handleNewSession() {
    setJobDescription('');
    setSessionId(null);
    setResult(null);
    setError(null);
    setState('input');
  }

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">ResumeOS</h1>
            <p className="text-gray-600 mt-1">
              AI-powered resume customization pipeline
            </p>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/v2.1"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Try V2.1 (New)
            </a>
            {state !== 'list' && state !== 'input' && (
              <button
                onClick={handleReset}
                className="text-gray-600 hover:text-gray-900"
              >
                Back to Dashboard
              </button>
            )}
          </div>
        </div>

        {/* State: Sessions List */}
        {state === 'list' && (
          <div className="space-y-6">
            {/* New Session Button */}
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Past Sessions</h2>
              <button
                onClick={handleNewSession}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
              >
                <span className="text-xl">+</span> Generate New Resume
              </button>
            </div>

            {/* Sessions List */}
            {loadingSessions ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
                <p className="mt-4 text-gray-600">Loading sessions...</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <div className="text-6xl mb-4">📄</div>
                <h3 className="text-xl font-bold mb-2">No sessions yet</h3>
                <p className="text-gray-600 mb-6">
                  Start by generating your first tailored resume
                </p>
                <button
                  onClick={handleNewSession}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg"
                >
                  Generate New Resume
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onResume={() => handleResumeSession(session)}
                    onView={() => handleViewComplete(session.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* State: Input */}
        {state === 'input' && (
          <div className="space-y-6">
            <button
              onClick={() => setState('list')}
              className="text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              ← Back to sessions
            </button>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Paste Job Description</h2>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-red-700 text-sm">
                  {error}
                </div>
              )}
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
                <span>Score: {result.validation.overallScore}/100</span>
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
                    <span
                      className="text-gray-700"
                      dangerouslySetInnerHTML={{ __html: ch.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                    />
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
                Back to Dashboard
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
                Back to Dashboard
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

function SessionCard({
  session,
  onResume,
  onView,
}: {
  session: SessionSummary;
  onResume: () => void;
  onView: () => void;
}) {
  const stateColors: Record<string, string> = {
    complete: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    'gap-review': 'bg-yellow-100 text-yellow-800',
    approved: 'bg-blue-100 text-blue-800',
    generating: 'bg-purple-100 text-purple-800',
    analyzing: 'bg-gray-100 text-gray-800',
  };

  const stateColor = stateColors[session.state] || 'bg-gray-100 text-gray-800';
  const isV21 = session.version === 'v2.1';

  const formattedDate = new Date(session.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Determine the correct diagnostics URL based on version
  const diagnosticsUrl = isV21
    ? `/v2.1/diagnostics/${session.id}`
    : `/v2/diagnostics/${session.id}`;

  return (
    <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="font-bold text-lg truncate">{session.companyName}</h3>
            {isV21 && (
              <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">
                V2.1
              </span>
            )}
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${stateColor}`}>
              {session.state}
            </span>
          </div>
          <p className="text-gray-600 text-sm mb-2">{session.roleTitle}</p>
          <p className="text-gray-400 text-xs">{formattedDate}</p>
        </div>

        <div className="flex items-center gap-4 ml-4">
          {session.validationScore !== null && (
            <div className="text-center">
              <div
                className={`text-2xl font-bold ${
                  session.validationPassed ? 'text-green-600' : 'text-yellow-600'
                }`}
              >
                {session.validationScore}
              </div>
              <div className="text-xs text-gray-500">score</div>
            </div>
          )}

          {session.totalCost !== null && (
            <div className="text-center">
              <div className="text-lg font-medium text-gray-700">
                ${session.totalCost.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500">cost</div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {session.state === 'complete' ? (
              isV21 ? (
                <a
                  href={`/v2.1/view/${session.id}`}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded transition-colors text-center"
                >
                  View & Edit
                </a>
              ) : (
                <button
                  onClick={onView}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded transition-colors"
                >
                  View Resume
                </button>
              )
            ) : session.state === 'gap-review' || session.state === 'approved' ? (
              <button
                onClick={onResume}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded transition-colors"
              >
                Resume
              </button>
            ) : null}
            <a
              href={diagnosticsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-700 text-xs text-center"
            >
              Diagnostics
            </a>
          </div>
        </div>
      </div>
    </div>
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
        {score}/100
      </div>
    </div>
  );
}
