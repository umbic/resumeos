'use client';

import { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  Zap,
  AlertCircle,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';

interface DiagnosticDecision {
  decision: string;
  reason: string;
  data?: unknown;
}

interface DiagnosticEvent {
  id: string;
  step: string;
  substep?: string | null;
  startedAt: string;
  completedAt?: string | null;
  durationMs?: number | null;
  promptSent?: string | null;
  responseReceived?: string | null;
  inputData?: unknown;
  outputData?: unknown;
  decisions?: DiagnosticDecision[] | null;
  tokensSent?: number | null;
  tokensReceived?: number | null;
  estimatedCost?: number | null;
  status: string;
  errorMessage?: string | null;
}

interface DiagnosticsData {
  sessionId: string;
  summary: {
    totalEvents: number;
    totalDurationMs: number;
    totalTokensSent: number;
    totalTokensReceived: number;
    estimatedTotalCost: number;
    hasErrors: boolean;
  };
  byStep: Record<string, DiagnosticEvent[]>;
  events: DiagnosticEvent[];
}

const STEP_LABELS: Record<string, string> = {
  jd_analysis: '1. JD Analysis',
  content_selection: '2. Content Selection',
  rewrite: '3. Rewrite (Claude)',
  build_resume: '4. Build Resume',
  quality_check: '5. Quality Check',
};

const STEP_ORDER = ['jd_analysis', 'content_selection', 'rewrite', 'build_resume', 'quality_check'];

export function DiagnosticsPanel({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['content_selection', 'rewrite'])
  );

  useEffect(() => {
    const fetchDiagnostics = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/diagnostics/${sessionId}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchDiagnostics();
  }, [sessionId]);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/diagnostics/${sessionId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const toggleEvent = (id: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedEvents(newExpanded);
  };

  const toggleSection = (step: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(step)) {
      newExpanded.delete(step);
    } else {
      newExpanded.add(step);
    }
    setExpandedSections(newExpanded);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Loading diagnostics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-700">
          <AlertCircle className="w-4 h-4" />
          <span>Error: {error}</span>
        </div>
      </div>
    );
  }

  if (!data || data.events.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-500 mb-2">No diagnostics available</p>
          <p className="text-sm text-gray-400">
            Diagnostics will appear after regenerating the resume.
          </p>
        </div>
      </div>
    );
  }

  // Sort steps by predefined order
  const sortedSteps = Object.entries(data.byStep).sort((a, b) => {
    const aIndex = STEP_ORDER.indexOf(a[0]);
    const bIndex = STEP_ORDER.indexOf(b[0]);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });

  return (
    <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
      {/* Summary Stats */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Generation Diagnostics</h2>
          <button
            onClick={handleRefresh}
            className="text-gray-400 hover:text-gray-600"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-xs text-gray-500">Duration</div>
              <div className="text-sm font-medium">
                {(data.summary.totalDurationMs / 1000).toFixed(2)}s
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-xs text-gray-500">Tokens</div>
              <div className="text-sm font-medium">
                {data.summary.totalTokensSent.toLocaleString()} in /{' '}
                {data.summary.totalTokensReceived.toLocaleString()} out
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-xs text-gray-500">Est. Cost</div>
              <div className="text-sm font-medium">
                ${data.summary.estimatedTotalCost.toFixed(4)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data.summary.hasErrors ? (
              <AlertCircle className="w-4 h-4 text-red-500" />
            ) : (
              <CheckCircle className="w-4 h-4 text-green-500" />
            )}
            <div>
              <div className="text-xs text-gray-500">Status</div>
              <div className="text-sm font-medium">
                {data.summary.hasErrors ? 'Has Errors' : 'Success'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Events by Step */}
      {sortedSteps.map(([step, events]) => (
        <div key={step} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => toggleSection(step)}
            className="w-full p-3 flex items-center justify-between hover:bg-gray-50 text-left"
          >
            <div className="flex items-center gap-2">
              {expandedSections.has(step) ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
              <span className="text-sm font-medium text-gray-900">
                {STEP_LABELS[step] || step}
              </span>
              <span className="text-xs text-gray-400">({events.length} events)</span>
            </div>
            <span className="text-xs text-gray-400">
              {events.reduce((sum, e) => sum + (e.durationMs || 0), 0)}ms
            </span>
          </button>

          {expandedSections.has(step) && (
            <div className="border-t border-gray-200 divide-y divide-gray-100">
              {events.map((event) => (
                <div key={event.id} className="p-3">
                  <button
                    onClick={() => toggleEvent(event.id)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2">
                      {expandedEvents.has(event.id) ? (
                        <ChevronDown className="w-3 h-3 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-gray-400" />
                      )}
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          event.status === 'success'
                            ? 'bg-green-100 text-green-700'
                            : event.status === 'error'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {event.status}
                      </span>
                      <span className="text-sm text-gray-700">
                        {event.substep || 'main'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">{event.durationMs}ms</span>
                  </button>

                  {expandedEvents.has(event.id) && (
                    <div className="mt-3 space-y-3 pl-5">
                      {/* Decisions */}
                      {event.decisions && event.decisions.length > 0 ? (
                        <div>
                          <h4 className="text-xs font-medium text-gray-700 mb-2">
                            Decisions ({event.decisions.length})
                          </h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {event.decisions.map((d, i) => (
                              <div
                                key={i}
                                className="bg-gray-50 p-2 rounded text-xs border border-gray-100"
                              >
                                <div className="font-medium text-gray-800">{d.decision}</div>
                                <div className="text-gray-600 mt-0.5">{d.reason}</div>
                                {d.data !== undefined && d.data !== null ? (
                                  <pre className="mt-1 text-[10px] bg-gray-100 p-1 rounded overflow-x-auto max-h-24">
                                    {JSON.stringify(d.data, null, 2)}
                                  </pre>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {/* Prompt */}
                      {event.promptSent ? (
                        <div>
                          <h4 className="text-xs font-medium text-gray-700 mb-2">
                            Prompt Sent ({event.tokensSent?.toLocaleString() || '?'} tokens)
                          </h4>
                          <pre className="bg-blue-50 p-2 rounded text-[10px] overflow-x-auto max-h-64 overflow-y-auto border border-blue-100">
                            {event.promptSent}
                          </pre>
                        </div>
                      ) : null}

                      {/* Response */}
                      {event.responseReceived ? (
                        <div>
                          <h4 className="text-xs font-medium text-gray-700 mb-2">
                            Response ({event.tokensReceived?.toLocaleString() || '?'} tokens)
                          </h4>
                          <pre className="bg-green-50 p-2 rounded text-[10px] overflow-x-auto max-h-64 overflow-y-auto border border-green-100">
                            {event.responseReceived}
                          </pre>
                        </div>
                      ) : null}

                      {/* Input Data */}
                      {event.inputData !== undefined && event.inputData !== null ? (
                        <div>
                          <h4 className="text-xs font-medium text-gray-700 mb-2">Input Data</h4>
                          <pre className="bg-gray-50 p-2 rounded text-[10px] overflow-x-auto max-h-48 overflow-y-auto border border-gray-100">
                            {JSON.stringify(event.inputData, null, 2)}
                          </pre>
                        </div>
                      ) : null}

                      {/* Output Data */}
                      {event.outputData !== undefined && event.outputData !== null ? (
                        <div>
                          <h4 className="text-xs font-medium text-gray-700 mb-2">Output Data</h4>
                          <pre className="bg-gray-50 p-2 rounded text-[10px] overflow-x-auto max-h-48 overflow-y-auto border border-gray-100">
                            {JSON.stringify(event.outputData, null, 2)}
                          </pre>
                        </div>
                      ) : null}

                      {/* Error */}
                      {event.errorMessage ? (
                        <div className="bg-red-50 p-2 rounded border border-red-100">
                          <h4 className="text-xs font-medium text-red-700 mb-1">Error</h4>
                          <div className="text-xs text-red-600">{event.errorMessage}</div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
