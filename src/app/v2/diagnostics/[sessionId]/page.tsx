'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
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
  AlertTriangle,
  Info,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface AgentDiagnostics {
  promptSent: string;
  rawResponse: string;
  parsedOutput: unknown;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  durationMs: number;
  timestamp?: string;
}

interface ValidationScore {
  honesty: number;
  honestyPassed: boolean;
  coverage: number;
  coveragePassed: boolean;
  quality: number;
  qualityPassed: boolean;
}

interface HonestyIssue {
  location: string;
  claim: string;
  issue: string;
  severity: string;
}

interface QualityIssue {
  type: string;
  location: string;
  detail: string;
  severity: string;
}

interface SuggestedFix {
  location: string;
  issue: string;
  suggestion: string;
  autoFixable: boolean;
}

interface DiagnosticsData {
  overview: {
    sessionId: string;
    state: string;
    createdAt: string;
    updatedAt: string;
    totalCost: number;
    totalDurationMs: number;
    jobDescriptionPreview: string;
    companyName?: string;
    targetTitle?: string;
    error?: {
      stage: string;
      message: string;
      timestamp: string;
    };
  };
  agents: {
    jdStrategist: AgentDiagnostics | null;
    gapAnalyzer: AgentDiagnostics | null;
    resumeWriter: AgentDiagnostics | null;
    validator: AgentDiagnostics | null;
  };
  contentSelection: {
    signals: {
      industries: string[];
      functions: string[];
      themes: string[];
    } | null;
    selectedItems: unknown[] | null;
    conflictsApplied: string[];
    durationMs: number;
    allScores: unknown[];
    selection: {
      summaryCount: number;
      careerHighlightsCount: number;
      position1BulletsCount: number;
      position2BulletsCount: number;
      positions3to6Count: number;
      details: unknown;
    } | null;
  };
  userIntervention: {
    adjustmentsMade: unknown;
    timeToApproveMs: number | null;
  } | null;
  finalOutput: {
    summary: string;
    summarySources: string[];
    careerHighlightsCount: number;
    careerHighlights: unknown[];
    positionsCount: number;
    positions: unknown[];
    metadata: unknown;
  } | null;
  validation: {
    passed: boolean;
    overallScore: number;
    scores: ValidationScore;
    honestyIssues: HonestyIssue[];
    metricsVerified: unknown[];
    requirementsAddressed: unknown[];
    positioningServed: boolean;
    qualityIssues: QualityIssue[];
    verbUsage: unknown[];
    suggestedFixes: SuggestedFix[];
  } | null;
  rawSession: unknown;
  rawDiagnostics: unknown;
}

// ─────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────

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

function Stat({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function StatusBadge({ state }: { state: string }) {
  const colors: Record<string, string> = {
    complete: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    'gap-review': 'bg-yellow-100 text-yellow-700',
    generating: 'bg-blue-100 text-blue-700',
    validating: 'bg-purple-100 text-purple-700',
    analyzing: 'bg-blue-100 text-blue-700',
    selecting: 'bg-blue-100 text-blue-700',
    approved: 'bg-green-100 text-green-700',
  };

  return (
    <span
      className={`px-2 py-1 rounded text-xs font-medium ${colors[state] || 'bg-gray-100 text-gray-700'}`}
    >
      {state}
    </span>
  );
}

function CollapsibleSection({
  title,
  expanded,
  onToggle,
  children,
  badge,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      <button
        onClick={onToggle}
        className="w-full p-4 flex justify-between items-center text-left hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {badge}
        </div>
      </button>
      {expanded && <div className="p-4 pt-0 border-t border-gray-200">{children}</div>}
    </div>
  );
}

function AgentSection({
  title,
  agent,
  expanded,
  onToggle,
}: {
  title: string;
  agent: AgentDiagnostics;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [view, setView] = useState<'prompt' | 'response' | 'parsed'>('parsed');

  const badge = (
    <div className="flex items-center gap-4 text-xs text-gray-500">
      <span>{agent.inputTokens.toLocaleString()} in</span>
      <span>{agent.outputTokens.toLocaleString()} out</span>
      <span>${agent.cost.toFixed(4)}</span>
      <span>{(agent.durationMs / 1000).toFixed(1)}s</span>
    </div>
  );

  return (
    <CollapsibleSection
      title={title}
      expanded={expanded}
      onToggle={onToggle}
      badge={badge}
    >
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg">
          <Stat label="Input Tokens" value={agent.inputTokens.toLocaleString()} />
          <Stat label="Output Tokens" value={agent.outputTokens.toLocaleString()} />
          <Stat label="Cost" value={`$${agent.cost.toFixed(4)}`} />
          <Stat label="Duration" value={`${(agent.durationMs / 1000).toFixed(1)}s`} />
        </div>

        {/* View Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setView('prompt')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              view === 'prompt'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Prompt Sent
          </button>
          <button
            onClick={() => setView('response')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              view === 'response'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Raw Response
          </button>
          <button
            onClick={() => setView('parsed')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              view === 'parsed'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Parsed Output
          </button>
        </div>

        {/* Content */}
        <div className="relative">
          <div className="absolute top-2 right-2 z-10">
            <CopyButton
              text={
                view === 'parsed'
                  ? JSON.stringify(agent.parsedOutput, null, 2)
                  : view === 'prompt'
                    ? agent.promptSent
                    : agent.rawResponse
              }
            />
          </div>
          <pre
            className={`p-4 rounded-lg text-xs overflow-auto max-h-[500px] whitespace-pre-wrap border ${
              view === 'prompt'
                ? 'bg-blue-50 border-blue-200'
                : view === 'response'
                  ? 'bg-green-50 border-green-200'
                  : 'bg-gray-50 border-gray-200'
            }`}
          >
            {view === 'prompt' && agent.promptSent}
            {view === 'response' && agent.rawResponse}
            {view === 'parsed' && JSON.stringify(agent.parsedOutput, null, 2)}
          </pre>
        </div>
      </div>
    </CollapsibleSection>
  );
}

function IssueCard({
  severity,
  location,
  issue,
}: {
  severity: string;
  location: string;
  issue: string;
}) {
  const colors: Record<string, { bg: string; icon: React.ReactNode }> = {
    blocker: {
      bg: 'bg-red-50 border-red-200',
      icon: <AlertCircle className="w-4 h-4 text-red-500" />,
    },
    warning: {
      bg: 'bg-yellow-50 border-yellow-200',
      icon: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
    },
    suggestion: {
      bg: 'bg-blue-50 border-blue-200',
      icon: <Info className="w-4 h-4 text-blue-500" />,
    },
  };

  const style = colors[severity] || colors.suggestion;

  return (
    <div className={`p-3 rounded-lg border ${style.bg} flex items-start gap-2`}>
      {style.icon}
      <div>
        <div className="text-sm font-medium text-gray-900">{location}</div>
        <div className="text-sm text-gray-600">{issue}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export default function V2DiagnosticsPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['overview'])
  );

  const fetchDiagnostics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v2/diagnostics/${sessionId}`);
      const json = await res.json();
      if (json.success) {
        setData(json.diagnostics);
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

  function toggleSection(section: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }

  function expandAll() {
    setExpandedSections(
      new Set([
        'overview',
        'jdStrategist',
        'contentSelection',
        'gapAnalyzer',
        'userIntervention',
        'resumeWriter',
        'validator',
        'validation',
      ])
    );
  }

  function collapseAll() {
    setExpandedSections(new Set());
  }

  function handleExportJSON() {
    if (!data) return;

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `v2-diagnostics-${sessionId.substring(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
          <Link
            href="/"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Resume Builder
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <div>
              <h2 className="text-lg font-semibold text-red-800">
                Error Loading Diagnostics
              </h2>
              <p className="text-red-600">{error}</p>
            </div>
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
            href="/"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Resume Builder
          </Link>
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              No Diagnostics Available
            </h2>
            <p className="text-gray-500">
              V2 diagnostics will appear after running the v2 pipeline.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">Back</span>
              </Link>
              <div className="h-6 w-px bg-gray-200" />
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-lg font-semibold text-gray-900">
                    V2 Pipeline Diagnostics
                  </h1>
                  <StatusBadge state={data.overview.state} />
                </div>
                <p className="text-xs text-gray-500 font-mono">
                  {sessionId.substring(0, 8)}...
                </p>
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
                onClick={fetchDiagnostics}
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-100"
              >
                <RefreshCw className="w-4 h-4" />
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500">Duration</div>
                <div className="text-xl font-semibold">
                  {(data.overview.totalDurationMs / 1000).toFixed(1)}s
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500">Total Cost</div>
                <div className="text-xl font-semibold">
                  ${data.overview.totalCost.toFixed(4)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Zap className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500">Agents Run</div>
                <div className="text-xl font-semibold">
                  {
                    [
                      data.agents.jdStrategist,
                      data.agents.gapAnalyzer,
                      data.agents.resumeWriter,
                      data.agents.validator,
                    ].filter(Boolean).length
                  }
                  /4
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  data.validation?.passed
                    ? 'bg-green-50'
                    : data.validation
                      ? 'bg-red-50'
                      : 'bg-gray-50'
                }`}
              >
                {data.validation?.passed ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : data.validation ? (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                ) : (
                  <Clock className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <div>
                <div className="text-xs text-gray-500">Validation</div>
                <div className="text-xl font-semibold">
                  {data.validation?.passed
                    ? 'Passed'
                    : data.validation
                      ? 'Failed'
                      : 'Pending'}
                </div>
              </div>
            </div>
            {data.overview.companyName && (
              <div>
                <div className="text-xs text-gray-500">Company</div>
                <div className="font-semibold truncate">
                  {data.overview.companyName}
                </div>
              </div>
            )}
          </div>

          {/* Error display */}
          {data.overview.error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-800 font-medium">
                <AlertCircle className="w-4 h-4" />
                Error at stage: {data.overview.error.stage}
              </div>
              <p className="text-sm text-red-600 mt-1">
                {data.overview.error.message}
              </p>
            </div>
          )}
        </div>

        {/* Agent 1: JD Strategist */}
        {data.agents.jdStrategist && (
          <AgentSection
            title="Agent 1: JD Strategist"
            agent={data.agents.jdStrategist}
            expanded={expandedSections.has('jdStrategist')}
            onToggle={() => toggleSection('jdStrategist')}
          />
        )}

        {/* Content Selection */}
        {data.contentSelection?.selection && (
          <CollapsibleSection
            title="Content Selection"
            expanded={expandedSections.has('contentSelection')}
            onToggle={() => toggleSection('contentSelection')}
            badge={
              <span className="text-xs text-gray-500">
                {data.contentSelection.durationMs}ms
              </span>
            }
          >
            <div className="space-y-4">
              {/* Counts */}
              <div className="grid grid-cols-5 gap-4 bg-gray-50 p-4 rounded-lg">
                <Stat
                  label="Summaries"
                  value={data.contentSelection.selection.summaryCount}
                />
                <Stat
                  label="Career Highlights"
                  value={data.contentSelection.selection.careerHighlightsCount}
                />
                <Stat
                  label="P1 Bullets"
                  value={data.contentSelection.selection.position1BulletsCount}
                />
                <Stat
                  label="P2 Bullets"
                  value={data.contentSelection.selection.position2BulletsCount}
                />
                <Stat
                  label="P3-6 Overviews"
                  value={data.contentSelection.selection.positions3to6Count}
                />
              </div>

              {/* Signals */}
              {data.contentSelection.signals && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    JD Scoring Signals
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-gray-500">Industries:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {data.contentSelection.signals.industries.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Functions:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {data.contentSelection.signals.functions.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Themes:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {data.contentSelection.signals.themes.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Conflicts */}
              {data.contentSelection.conflictsApplied.length > 0 && (
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    Conflicts Applied
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {data.contentSelection.conflictsApplied.map((conflict) => (
                      <span
                        key={conflict}
                        className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded"
                      >
                        {conflict}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Full details */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-medium text-gray-900">
                    Full Selection Details
                  </h4>
                  <CopyButton
                    text={JSON.stringify(
                      data.contentSelection.selection.details,
                      null,
                      2
                    )}
                  />
                </div>
                <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-auto max-h-96 border border-gray-200">
                  {JSON.stringify(data.contentSelection.selection.details, null, 2)}
                </pre>
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Agent 2: Gap Analyzer */}
        {data.agents.gapAnalyzer && (
          <AgentSection
            title="Agent 2: Gap Analyzer"
            agent={data.agents.gapAnalyzer}
            expanded={expandedSections.has('gapAnalyzer')}
            onToggle={() => toggleSection('gapAnalyzer')}
          />
        )}

        {/* User Intervention */}
        {data.userIntervention && (
          <CollapsibleSection
            title="User Intervention"
            expanded={expandedSections.has('userIntervention')}
            onToggle={() => toggleSection('userIntervention')}
            badge={
              data.userIntervention.timeToApproveMs ? (
                <span className="text-xs text-gray-500">
                  {(data.userIntervention.timeToApproveMs / 1000).toFixed(1)}s to
                  approve
                </span>
              ) : undefined
            }
          >
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute top-2 right-2">
                  <CopyButton
                    text={JSON.stringify(
                      data.userIntervention.adjustmentsMade,
                      null,
                      2
                    )}
                  />
                </div>
                <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-auto max-h-96 border border-gray-200">
                  {JSON.stringify(data.userIntervention.adjustmentsMade, null, 2)}
                </pre>
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Agent 3: Resume Writer */}
        {data.agents.resumeWriter && (
          <AgentSection
            title="Agent 3: Resume Writer"
            agent={data.agents.resumeWriter}
            expanded={expandedSections.has('resumeWriter')}
            onToggle={() => toggleSection('resumeWriter')}
          />
        )}

        {/* Agent 4: Validator */}
        {data.agents.validator && (
          <AgentSection
            title="Agent 4: Validator"
            agent={data.agents.validator}
            expanded={expandedSections.has('validator')}
            onToggle={() => toggleSection('validator')}
          />
        )}

        {/* Validation Summary */}
        {data.validation && (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Validation Summary
            </h2>

            {/* Scores */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div
                className={`p-4 rounded-lg ${data.validation.passed ? 'bg-green-50' : 'bg-red-50'}`}
              >
                <div className="text-xs text-gray-500">Overall</div>
                <div
                  className={`text-2xl font-bold ${data.validation.passed ? 'text-green-600' : 'text-red-600'}`}
                >
                  {data.validation.passed ? 'PASS' : 'FAIL'}
                </div>
                <div className="text-sm text-gray-600">
                  Score: {data.validation.overallScore}/10
                </div>
              </div>
              <div
                className={`p-4 rounded-lg ${data.validation.scores.honestyPassed ? 'bg-green-50' : 'bg-red-50'}`}
              >
                <div className="text-xs text-gray-500">Honesty</div>
                <div className="text-2xl font-bold">
                  {data.validation.scores.honesty}/10
                </div>
                <div className="text-sm text-gray-600">
                  {data.validation.scores.honestyPassed ? 'Passed' : 'Failed'}
                </div>
              </div>
              <div
                className={`p-4 rounded-lg ${data.validation.scores.coveragePassed ? 'bg-green-50' : 'bg-yellow-50'}`}
              >
                <div className="text-xs text-gray-500">Coverage</div>
                <div className="text-2xl font-bold">
                  {data.validation.scores.coverage}/10
                </div>
                <div className="text-sm text-gray-600">
                  {data.validation.scores.coveragePassed ? 'Passed' : 'Needs work'}
                </div>
              </div>
              <div
                className={`p-4 rounded-lg ${data.validation.scores.qualityPassed ? 'bg-green-50' : 'bg-yellow-50'}`}
              >
                <div className="text-xs text-gray-500">Quality</div>
                <div className="text-2xl font-bold">
                  {data.validation.scores.quality}/10
                </div>
                <div className="text-sm text-gray-600">
                  {data.validation.scores.qualityPassed ? 'Passed' : 'Needs work'}
                </div>
              </div>
            </div>

            {/* Issues */}
            {(data.validation.honestyIssues.length > 0 ||
              data.validation.qualityIssues.length > 0) && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900">Issues Found</h3>
                <div className="space-y-2">
                  {data.validation.honestyIssues.map((issue, i) => (
                    <IssueCard
                      key={`h-${i}`}
                      severity={issue.severity}
                      location={issue.location}
                      issue={`${issue.issue}: ${issue.claim}`}
                    />
                  ))}
                  {data.validation.qualityIssues.map((issue, i) => (
                    <IssueCard
                      key={`q-${i}`}
                      severity={issue.severity}
                      location={issue.location}
                      issue={`${issue.type}: ${issue.detail}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Fixes */}
            {data.validation.suggestedFixes.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  Suggested Fixes ({data.validation.suggestedFixes.length})
                </h3>
                <div className="space-y-2">
                  {data.validation.suggestedFixes.map((fix, i) => (
                    <div
                      key={i}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="text-sm font-medium text-gray-900">
                        {fix.location}
                      </div>
                      <div className="text-sm text-gray-600">{fix.issue}</div>
                      <div className="text-sm text-blue-600 mt-1">
                        Suggestion: {fix.suggestion}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-6">
          <button
            onClick={handleExportJSON}
            className="bg-gray-800 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download Full JSON
          </button>
          <p className="text-xs text-gray-400 mt-4">
            Session: {sessionId} | Last updated: {data.overview.updatedAt}
          </p>
        </div>
      </div>
    </div>
  );
}
