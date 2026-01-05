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
  Download,
  ArrowLeft,
  Copy,
  Check,
} from 'lucide-react';
import Link from 'next/link';

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

const STEP_DESCRIPTIONS: Record<string, string> = {
  jd_analysis: 'Analyzes the job description to extract requirements, keywords, and positioning themes',
  content_selection: 'Scores and selects the best content items (summary, CHs, bullets, overviews) based on JD match',
  rewrite: 'Sends selected content to Claude for rewriting with JD-specific customization',
  build_resume: 'Assembles the final resume structure from rewritten content',
  quality_check: 'Validates the generated resume meets quality standards',
};

const STEP_ORDER = ['jd_analysis', 'content_selection', 'rewrite', 'build_resume', 'quality_check'];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-gray-200 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-3 h-3 text-green-600" />
      ) : (
        <Copy className="w-3 h-3 text-gray-500" />
      )}
    </button>
  );
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  badge,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`border border-gray-200 rounded-lg overflow-hidden ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
          <span className="font-medium text-gray-900">{title}</span>
          {badge}
        </div>
      </button>
      {isOpen && <div className="p-4 border-t border-gray-200">{children}</div>}
    </div>
  );
}

export default function DiagnosticsPage({ params }: { params: { sessionId: string } }) {
  const { sessionId } = params;
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(STEP_ORDER) // All sections expanded by default
  );

  useEffect(() => {
    const fetchDiagnostics = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/diagnostics/${sessionId}`);
        if (!res.ok) throw new Error('Failed to fetch diagnostics');
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
      if (!res.ok) throw new Error('Failed to fetch diagnostics');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportJSON = () => {
    if (!data) return;

    const exportData = {
      _exportInfo: {
        exportedAt: new Date().toISOString(),
        sessionId: data.sessionId,
        description: 'ResumeOS Generation Diagnostics Export',
      },
      summary: {
        totalEvents: data.summary.totalEvents,
        totalDurationMs: data.summary.totalDurationMs,
        totalDurationSeconds: (data.summary.totalDurationMs / 1000).toFixed(2),
        tokens: {
          sent: data.summary.totalTokensSent,
          received: data.summary.totalTokensReceived,
          total: data.summary.totalTokensSent + data.summary.totalTokensReceived,
        },
        estimatedCostUSD: data.summary.estimatedTotalCost.toFixed(6),
        hasErrors: data.summary.hasErrors,
      },
      steps: Object.entries(data.byStep).map(([stepName, events]) => ({
        stepName,
        stepLabel: STEP_LABELS[stepName] || stepName,
        eventCount: (events as DiagnosticEvent[]).length,
        totalDurationMs: (events as DiagnosticEvent[]).reduce((sum, e) => sum + (e.durationMs || 0), 0),
        events: (events as DiagnosticEvent[]).map((event) => ({
          eventId: event.id,
          step: event.step,
          substep: event.substep || 'main',
          status: event.status,
          timing: {
            startedAt: event.startedAt,
            completedAt: event.completedAt,
            durationMs: event.durationMs,
          },
          tokens: event.tokensSent || event.tokensReceived ? {
            sent: event.tokensSent,
            received: event.tokensReceived,
            estimatedCostUSD: event.estimatedCost ? (event.estimatedCost / 1_000_000).toFixed(6) : null,
          } : null,
          decisions: event.decisions && event.decisions.length > 0 ? event.decisions : null,
          llmCall: event.promptSent ? {
            promptSent: event.promptSent,
            promptTokens: event.tokensSent,
            responseReceived: event.responseReceived,
            responseTokens: event.tokensReceived,
          } : null,
          inputData: event.inputData || null,
          outputData: event.outputData || null,
          error: event.errorMessage || null,
        })),
      })),
      rawEvents: data.events,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostics_${sessionId}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

  const expandAll = () => {
    setExpandedSections(new Set(STEP_ORDER));
    if (data) {
      setExpandedEvents(new Set(data.events.map(e => e.id)));
    }
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
    setExpandedEvents(new Set());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-lg">Loading diagnostics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to Resume Builder
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <div>
              <h2 className="text-lg font-semibold text-red-800">Error Loading Diagnostics</h2>
              <p className="text-red-600">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.events.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to Resume Builder
          </Link>
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No Diagnostics Available</h2>
            <p className="text-gray-500">
              Diagnostics will appear after generating a resume for this session.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const sortedSteps = Object.entries(data.byStep).sort((a, b) => {
    const aIndex = STEP_ORDER.indexOf(a[0]);
    const bIndex = STEP_ORDER.indexOf(b[0]);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">Back</span>
              </Link>
              <div className="h-6 w-px bg-gray-200" />
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Generation Diagnostics</h1>
                <p className="text-xs text-gray-500 font-mono">{sessionId}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={collapseAll}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
              >
                Collapse All
              </button>
              <button
                onClick={expandAll}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
              >
                Expand All
              </button>
              <button
                onClick={handleExportJSON}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-md hover:bg-blue-50"
              >
                <Download className="w-4 h-4" />
                Export JSON
              </button>
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-100"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Summary Stats */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Total Duration</div>
                <div className="text-xl font-semibold text-gray-900">
                  {(data.summary.totalDurationMs / 1000).toFixed(2)}s
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Zap className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Tokens Used</div>
                <div className="text-xl font-semibold text-gray-900">
                  {(data.summary.totalTokensSent + data.summary.totalTokensReceived).toLocaleString()}
                </div>
                <div className="text-xs text-gray-400">
                  {data.summary.totalTokensSent.toLocaleString()} in / {data.summary.totalTokensReceived.toLocaleString()} out
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Estimated Cost</div>
                <div className="text-xl font-semibold text-gray-900">
                  ${data.summary.estimatedTotalCost.toFixed(4)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${data.summary.hasErrors ? 'bg-red-50' : 'bg-green-50'}`}>
                {data.summary.hasErrors ? (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                )}
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Status</div>
                <div className={`text-xl font-semibold ${data.summary.hasErrors ? 'text-red-600' : 'text-green-600'}`}>
                  {data.summary.hasErrors ? 'Has Errors' : 'Success'}
                </div>
                <div className="text-xs text-gray-400">
                  {data.summary.totalEvents} events
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
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 text-left"
            >
              <div className="flex items-center gap-3">
                {expandedSections.has(step) ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
                <div>
                  <span className="text-base font-semibold text-gray-900">
                    {STEP_LABELS[step] || step}
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {STEP_DESCRIPTIONS[step] || ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                  {events.length} event{events.length !== 1 ? 's' : ''}
                </span>
                <span className="text-sm text-gray-500">
                  {events.reduce((sum, e) => sum + (e.durationMs || 0), 0)}ms
                </span>
              </div>
            </button>

            {expandedSections.has(step) && (
              <div className="border-t border-gray-200">
                {events.map((event, eventIndex) => (
                  <div key={event.id} className={eventIndex > 0 ? 'border-t border-gray-100' : ''}>
                    <button
                      onClick={() => toggleEvent(event.id)}
                      className="w-full p-4 flex items-center justify-between hover:bg-gray-50 text-left"
                    >
                      <div className="flex items-center gap-3">
                        {expandedEvents.has(event.id) ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            event.status === 'success'
                              ? 'bg-green-100 text-green-700'
                              : event.status === 'error'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {event.status}
                        </span>
                        <span className="text-sm font-medium text-gray-700">
                          {event.substep || 'main'}
                        </span>
                        {event.decisions && event.decisions.length > 0 && (
                          <span className="text-xs text-gray-400">
                            ({event.decisions.length} decisions)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        {(event.tokensSent || event.tokensReceived) && (
                          <span className="text-xs text-gray-400">
                            {event.tokensSent?.toLocaleString() || 0} / {event.tokensReceived?.toLocaleString() || 0} tokens
                          </span>
                        )}
                        <span className="text-xs text-gray-500">{event.durationMs}ms</span>
                      </div>
                    </button>

                    {expandedEvents.has(event.id) && (
                      <div className="px-4 pb-4 space-y-4 bg-gray-50">
                        {/* Decisions */}
                        {event.decisions && event.decisions.length > 0 && (
                          <CollapsibleSection
                            title={`Decisions (${event.decisions.length})`}
                            defaultOpen={true}
                            className="bg-white"
                          >
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {event.decisions.map((d, i) => (
                                <div
                                  key={i}
                                  className="bg-gray-50 p-3 rounded-lg border border-gray-100"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="font-medium text-gray-900 text-sm">{d.decision}</div>
                                    {d.data !== undefined && d.data !== null && <CopyButton text={JSON.stringify(d.data, null, 2)} />}
                                  </div>
                                  <div className="text-gray-600 text-sm mt-1">{d.reason}</div>
                                  {d.data !== undefined && d.data !== null && (
                                    <pre className="mt-2 text-xs bg-white p-2 rounded border border-gray-200 overflow-x-auto max-h-32 overflow-y-auto">
                                      {JSON.stringify(d.data, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              ))}
                            </div>
                          </CollapsibleSection>
                        )}

                        {/* Prompt Sent */}
                        {event.promptSent && (
                          <CollapsibleSection
                            title="Prompt Sent"
                            badge={
                              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                {event.tokensSent?.toLocaleString() || '?'} tokens
                              </span>
                            }
                            defaultOpen={true}
                            className="bg-white"
                          >
                            <div className="relative">
                              <div className="absolute top-2 right-2">
                                <CopyButton text={event.promptSent} />
                              </div>
                              <pre className="bg-blue-50 p-4 rounded-lg text-xs overflow-x-auto max-h-[500px] overflow-y-auto border border-blue-100 whitespace-pre-wrap">
                                {event.promptSent}
                              </pre>
                            </div>
                          </CollapsibleSection>
                        )}

                        {/* Response Received */}
                        {event.responseReceived && (
                          <CollapsibleSection
                            title="Response Received"
                            badge={
                              <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                                {event.tokensReceived?.toLocaleString() || '?'} tokens
                              </span>
                            }
                            defaultOpen={true}
                            className="bg-white"
                          >
                            <div className="relative">
                              <div className="absolute top-2 right-2">
                                <CopyButton text={event.responseReceived} />
                              </div>
                              <pre className="bg-green-50 p-4 rounded-lg text-xs overflow-x-auto max-h-[500px] overflow-y-auto border border-green-100 whitespace-pre-wrap">
                                {event.responseReceived}
                              </pre>
                            </div>
                          </CollapsibleSection>
                        )}

                        {/* Input Data */}
                        {event.inputData !== undefined && event.inputData !== null && (
                          <CollapsibleSection
                            title="Input Data"
                            defaultOpen={false}
                            className="bg-white"
                          >
                            <div className="relative">
                              <div className="absolute top-2 right-2">
                                <CopyButton text={JSON.stringify(event.inputData, null, 2)} />
                              </div>
                              <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-x-auto max-h-96 overflow-y-auto border border-gray-200">
                                {JSON.stringify(event.inputData, null, 2)}
                              </pre>
                            </div>
                          </CollapsibleSection>
                        )}

                        {/* Output Data */}
                        {event.outputData !== undefined && event.outputData !== null && (
                          <CollapsibleSection
                            title="Output Data"
                            defaultOpen={false}
                            className="bg-white"
                          >
                            <div className="relative">
                              <div className="absolute top-2 right-2">
                                <CopyButton text={JSON.stringify(event.outputData, null, 2)} />
                              </div>
                              <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-x-auto max-h-96 overflow-y-auto border border-gray-200">
                                {JSON.stringify(event.outputData, null, 2)}
                              </pre>
                            </div>
                          </CollapsibleSection>
                        )}

                        {/* Error */}
                        {event.errorMessage && (
                          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                            <h4 className="text-sm font-medium text-red-800 mb-2">Error</h4>
                            <pre className="text-sm text-red-600 whitespace-pre-wrap">{event.errorMessage}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 py-4">
          Session ID: {sessionId} | Generated at: {new Date().toLocaleString()}
        </div>
      </div>
    </div>
  );
}
