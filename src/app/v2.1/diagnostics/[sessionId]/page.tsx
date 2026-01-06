'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface DiagnosticsData {
  sessionId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  diagnostics: any;
}

export default function V21DiagnosticsPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v2.1/diagnostics/${sessionId}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || 'Failed to load diagnostics');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch diagnostics');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchDiagnostics();
  }, [fetchDiagnostics]);

  function handleExportJSON() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `v21-diagnostics-${sessionId.substring(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-lg">Loading diagnostics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/v2.1"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
          >
            &larr; Back to V2.1
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800">Error Loading Diagnostics</h2>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/v2.1"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
          >
            &larr; Back to V2.1
          </Link>
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No Diagnostics Available</h2>
            <p className="text-gray-500">No data found for this session.</p>
          </div>
        </div>
      </div>
    );
  }

  const session = data.session || {};
  const diagnostics = data.diagnostics || {};
  const validation = session.validation;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/v2.1"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                &larr; <span className="text-sm">Back</span>
              </Link>
              <div className="h-6 w-px bg-gray-200" />
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-lg font-semibold text-gray-900">V2.1 Pipeline Diagnostics</h1>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    data.status === 'complete' ? 'bg-green-100 text-green-700' :
                    data.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {data.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-mono">{sessionId.substring(0, 8)}...</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExportJSON}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-md hover:bg-blue-50"
              >
                Export JSON
              </button>
              <button
                onClick={fetchDiagnostics}
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-100"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        {/* Overview Card */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-xs text-gray-500">Total Cost</div>
              <div className="text-xl font-semibold">
                ${(diagnostics.totalCost || 0).toFixed(3)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Duration</div>
              <div className="text-xl font-semibold">
                {((diagnostics.totalDurationMs || 0) / 1000).toFixed(1)}s
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Status</div>
              <div className="text-xl font-semibold capitalize">{data.status}</div>
            </div>
            {validation && (
              <div>
                <div className="text-xs text-gray-500">Validation</div>
                <div className="text-xl font-semibold">
                  {validation.overallVerdict || 'N/A'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Validation Summary */}
        {validation && (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Validation Results</h2>
            <div className="space-y-4">
              {/* Scores */}
              <div className="grid grid-cols-4 gap-4">
                <ScoreCard label="Honesty" value={validation.honestyScore || 0} />
                <ScoreCard label="Coverage" value={validation.coverageScore || 0} />
                <ScoreCard label="Quality" value={validation.qualityScore || 0} />
                <ScoreCard label="Format" value={validation.formatScore || 0} />
              </div>

              {/* Issues Summary */}
              {validation.summary && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Issues Summary</h4>
                  <div className="flex gap-4">
                    <span className="text-red-600">
                      {validation.summary.blockers || 0} blockers
                    </span>
                    <span className="text-yellow-600">
                      {validation.summary.warnings || 0} warnings
                    </span>
                    <span className="text-blue-600">
                      {validation.summary.suggestions || 0} suggestions
                    </span>
                  </div>
                </div>
              )}

              {/* Full validation JSON */}
              <details className="bg-gray-50 rounded-lg">
                <summary className="p-3 cursor-pointer font-medium">View Full Validation JSON</summary>
                <pre className="p-4 text-xs overflow-auto max-h-96">
                  {JSON.stringify(validation, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        )}

        {/* Agent Diagnostics */}
        {diagnostics.agents && (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Agent Diagnostics</h2>
            <div className="space-y-4">
              {Object.entries(diagnostics.agents).map(([name, agent]: [string, unknown]) => {
                const a = agent as { inputTokens?: number; outputTokens?: number; cost?: number; durationMs?: number };
                return (
                  <div key={name} className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium capitalize mb-2">{name.replace(/([A-Z])/g, ' $1')}</h4>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Input:</span>{' '}
                        {(a.inputTokens || 0).toLocaleString()} tokens
                      </div>
                      <div>
                        <span className="text-gray-500">Output:</span>{' '}
                        {(a.outputTokens || 0).toLocaleString()} tokens
                      </div>
                      <div>
                        <span className="text-gray-500">Cost:</span>{' '}
                        ${(a.cost || 0).toFixed(4)}
                      </div>
                      <div>
                        <span className="text-gray-500">Duration:</span>{' '}
                        {((a.durationMs || 0) / 1000).toFixed(1)}s
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Narrative Writer Output */}
        {session.narrativeOutput && (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Narrative Writer Output (Phase 1)</h2>
            <details className="bg-gray-50 rounded-lg">
              <summary className="p-3 cursor-pointer font-medium">View JSON</summary>
              <pre className="p-4 text-xs overflow-auto max-h-96">
                {JSON.stringify(session.narrativeOutput, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* Detail Writer Output */}
        {session.detailOutput && (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Detail Writer Output (Phase 2)</h2>
            <details className="bg-gray-50 rounded-lg">
              <summary className="p-3 cursor-pointer font-medium">View JSON</summary>
              <pre className="p-4 text-xs overflow-auto max-h-96">
                {JSON.stringify(session.detailOutput, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* Raw Session Data */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Raw Session Data</h2>
          <details className="bg-gray-50 rounded-lg">
            <summary className="p-3 cursor-pointer font-medium">View JSON</summary>
            <pre className="p-4 text-xs overflow-auto max-h-96">
              {JSON.stringify(session, null, 2)}
            </pre>
          </details>
        </div>

        {/* Footer */}
        <div className="text-center py-6">
          <button
            onClick={handleExportJSON}
            className="bg-gray-800 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Download Full JSON
          </button>
          <p className="text-xs text-gray-400 mt-4">
            Session: {sessionId}
          </p>
        </div>
      </div>
    </div>
  );
}

// Helper Components

function ScoreCard({ label, value }: { label: string; value: number }) {
  const color = value >= 8 ? 'bg-green-50 text-green-700' :
                value >= 6 ? 'bg-yellow-50 text-yellow-700' :
                'bg-red-50 text-red-700';
  return (
    <div className={`p-4 rounded-lg ${color}`}>
      <div className="text-xs opacity-75">{label}</div>
      <div className="text-2xl font-bold">{value}/10</div>
    </div>
  );
}
