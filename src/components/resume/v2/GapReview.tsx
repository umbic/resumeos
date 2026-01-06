'use client';

// ============================================
// ResumeOS V2: Gap Review UI Component
// ============================================
//
// Displays gap analysis and allows users to:
// - Review coverage assessment
// - See honest gaps and warnings
// - Swap content sources for alternatives
// - Add writer guidance
// - Approve before generation begins

import { useState, useEffect, useCallback } from 'react';
import type {
  GapAnalysis,
  ContentSelectionResult,
  JDStrategy,
  SlotSelection,
} from '@/types/v2';

interface GapReviewProps {
  sessionId: string;
  onApprove: () => void;
}

interface ReviewData {
  strategy: JDStrategy;
  selection: ContentSelectionResult;
  gapAnalysis: GapAnalysis;
}

export function GapReview({ sessionId, onApprove }: GapReviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReviewData | null>(null);
  const [globalInstructions, setGlobalInstructions] = useState('');
  const [acknowledgedGaps, setAcknowledgedGaps] = useState<string[]>([]);
  const [acknowledgedBlockers, setAcknowledgedBlockers] = useState<string[]>([]);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);

  const fetchReviewData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/v2/review-gaps?sessionId=${sessionId}`);
      const json = await res.json();
      if (json.success) {
        setData({
          strategy: json.strategy,
          selection: json.selection,
          gapAnalysis: json.gapAnalysis,
        });
      } else {
        setError(json.error || 'Failed to fetch review data');
      }
    } catch (err) {
      console.error('Failed to fetch review data:', err);
      setError('Failed to fetch review data');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchReviewData();
  }, [fetchReviewData]);

  async function handleSwap(slot: string, fromId: string, toId: string) {
    setSwapError(null);
    try {
      const res = await fetch('/api/v2/swap-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          slot,
          fromSourceId: fromId,
          toSourceId: toId,
        }),
      });
      const json = await res.json();
      if (json.success) {
        // Refresh data to show updated state
        fetchReviewData();
      } else {
        setSwapError(json.error || 'Failed to swap content');
      }
    } catch (err) {
      console.error('Swap failed:', err);
      setSwapError(err instanceof Error ? err.message : 'Swap failed');
    }
  }

  async function handleApprove() {
    setApproving(true);
    setApproveError(null);
    try {
      const res = await fetch('/api/v2/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          globalInstructions: globalInstructions || undefined,
          acknowledgedGaps: acknowledgedGaps.length > 0 ? acknowledgedGaps : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        onApprove();
      } else {
        setApproveError(json.error || 'Failed to approve');
        setApproving(false);
      }
    } catch (err) {
      console.error('Approve failed:', err);
      setApproveError(err instanceof Error ? err.message : 'Approval failed');
      setApproving(false);
    }
    // Note: don't setApproving(false) on success - parent will navigate away
  }

  function toggleGapAcknowledged(gap: string) {
    setAcknowledgedGaps((prev) =>
      prev.includes(gap) ? prev.filter((g) => g !== gap) : [...prev, gap]
    );
  }

  function toggleBlockerAcknowledged(blocker: string) {
    setAcknowledgedBlockers((prev) =>
      prev.includes(blocker) ? prev.filter((b) => b !== blocker) : [...prev, blocker]
    );
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading gap analysis...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-red-600">
        <p>{error || 'Failed to load review data'}</p>
        <button
          onClick={fetchReviewData}
          className="mt-4 text-blue-600 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const { gapAnalysis, selection, strategy } = data;
  const blockerWarnings = gapAnalysis.warnings.filter((w) => w.severity === 'blocker');
  const otherWarnings = gapAnalysis.warnings.filter((w) => w.severity !== 'blocker');

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="border-b pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">Gap Review</h1>
            <p className="text-gray-600 mt-1">
              Review content coverage before generating your resume for{' '}
              <span className="font-medium">{strategy.company.name}</span>
            </p>
          </div>
          <a
            href={`/v2/diagnostics/${sessionId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-blue-600 hover:underline"
          >
            View Full Diagnostics
          </a>
        </div>
      </div>

      {/* Coverage Score */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Coverage Assessment</h2>
        <div className="flex items-center gap-6">
          <div
            className={`text-5xl font-bold ${
              gapAnalysis.overallCoverage.score >= 7
                ? 'text-green-600'
                : gapAnalysis.overallCoverage.score >= 5
                ? 'text-yellow-600'
                : 'text-red-600'
            }`}
          >
            {gapAnalysis.overallCoverage.score}/10
          </div>
          <div>
            <div className="font-medium text-lg capitalize">
              {gapAnalysis.overallCoverage.assessment}
            </div>
            <div className="text-sm text-gray-600 mt-1 max-w-md">
              {gapAnalysis.overallCoverage.summary}
            </div>
          </div>
        </div>
      </div>

      {/* Blockers */}
      {blockerWarnings.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-red-800 mb-4">
            Blockers ({blockerWarnings.length})
          </h3>
          <p className="text-sm text-red-700 mb-4">
            These are significant gaps. Acknowledge them to proceed anyway.
          </p>
          <ul className="space-y-3">
            {blockerWarnings.map((warning, i) => (
              <li key={i} className="bg-white rounded p-4 border border-red-200">
                <div className="flex items-start justify-between gap-4">
                  <div className="font-medium text-red-800">{warning.message}</div>
                  <label className="flex items-center gap-2 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={acknowledgedBlockers.includes(warning.message)}
                      onChange={() => toggleBlockerAcknowledged(warning.message)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-600">Acknowledge</span>
                  </label>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Honest Gaps */}
      {gapAnalysis.honestGaps.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-yellow-800 mb-4">
            Honest Gaps ({gapAnalysis.honestGaps.length})
          </h3>
          <p className="text-sm text-yellow-700 mb-4">
            These requirements cannot be fully addressed with existing content. Acknowledge
            them to proceed.
          </p>
          <ul className="space-y-3">
            {gapAnalysis.honestGaps.map((gap, i) => (
              <li key={i} className="bg-white rounded p-4 border border-yellow-200">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">{gap.requirement}</div>
                    <div className="text-sm text-gray-600 mt-1">{gap.reason}</div>
                    {gap.mitigation && (
                      <div className="text-sm text-blue-600 mt-2">
                        Mitigation: {gap.mitigation}
                      </div>
                    )}
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acknowledgedGaps.includes(gap.requirement)}
                      onChange={() => toggleGapAcknowledged(gap.requirement)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-600">Acknowledge</span>
                  </label>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {otherWarnings.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-blue-800 mb-4">
            Warnings ({otherWarnings.length})
          </h3>
          <ul className="space-y-2">
            {otherWarnings.map((warning, i) => (
              <li key={i} className="text-sm">
                <span
                  className={`inline-block w-2 h-2 rounded-full mr-2 ${
                    warning.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`}
                ></span>
                {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Positioning Alignment */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-4">Positioning Alignment</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-3 h-3 rounded-full ${
                gapAnalysis.positioningAlignment.primaryAngleSupported
                  ? 'bg-green-500'
                  : 'bg-red-500'
              }`}
            ></span>
            <span className="font-medium">Primary Angle:</span>
            <span>{strategy.positioning.primaryAngle.angle}</span>
          </div>
          {gapAnalysis.positioningAlignment.supportingAnglesCovered.length > 0 && (
            <div>
              <span className="text-sm text-gray-600">Supported angles: </span>
              <span className="text-sm">
                {gapAnalysis.positioningAlignment.supportingAnglesCovered.join(', ')}
              </span>
            </div>
          )}
          {gapAnalysis.positioningAlignment.missingAngles.length > 0 && (
            <div>
              <span className="text-sm text-gray-600">Missing angles: </span>
              <span className="text-sm text-red-600">
                {gapAnalysis.positioningAlignment.missingAngles.join(', ')}
              </span>
            </div>
          )}
          <div className="text-sm text-gray-600 italic mt-2">
            {gapAnalysis.positioningAlignment.narrativeViability}
          </div>
        </div>
      </div>

      {/* Content Slots */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-4">Selected Content</h3>

        {/* Summary */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-700 mb-2">Summary</h4>
          <ContentSlot
            label="Summary"
            slot={selection.summary}
            onSwap={(from, to) => handleSwap('summary', from, to)}
          />
        </div>

        {/* Career Highlights */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-700 mb-2">Career Highlights</h4>
          {selection.careerHighlights.map((slot, i) => (
            <ContentSlot
              key={i}
              label={`Highlight ${i + 1}`}
              slot={slot}
              onSwap={(from, to) => handleSwap(`ch_${i + 1}`, from, to)}
            />
          ))}
        </div>

        {/* Position 1 */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-700 mb-2">Position 1 Bullets</h4>
          {selection.position1.bullets.map((slot, i) => (
            <ContentSlot
              key={i}
              label={`P1 Bullet ${i + 1}`}
              slot={slot}
              onSwap={(from, to) => handleSwap(`p1_bullet_${i + 1}`, from, to)}
            />
          ))}
        </div>

        {/* Position 2 */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-700 mb-2">Position 2 Bullets</h4>
          {selection.position2.bullets.map((slot, i) => (
            <ContentSlot
              key={i}
              label={`P2 Bullet ${i + 1}`}
              slot={slot}
              onSwap={(from, to) => handleSwap(`p2_bullet_${i + 1}`, from, to)}
            />
          ))}
        </div>
      </div>

      {/* Emphasis Recommendations */}
      {gapAnalysis.emphasisRecommendations.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-green-800 mb-4">Writer Guidance</h3>
          <ul className="space-y-2">
            {gapAnalysis.emphasisRecommendations.map((rec, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">[{rec.slotId}]</span> {rec.recommendation}
                <span className="text-gray-600 ml-2">— {rec.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Additional Context */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-4">Additional Notes for Writer (Optional)</h3>
        <textarea
          className="w-full border rounded p-3 h-24"
          placeholder="Add any context the writer should know..."
          value={globalInstructions}
          onChange={(e) => setGlobalInstructions(e.target.value)}
        />
      </div>

      {/* Error Messages */}
      {(swapError || approveError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          {swapError && (
            <p className="text-red-800 text-sm">
              <strong>Swap error:</strong> {swapError}
            </p>
          )}
          {approveError && (
            <p className="text-red-800 text-sm">
              <strong>Approval error:</strong> {approveError}
            </p>
          )}
        </div>
      )}

      {/* Approve Button */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600 space-x-4">
          {blockerWarnings.length > 0 && (
            <span>
              {acknowledgedBlockers.length}/{blockerWarnings.length} blockers acknowledged
            </span>
          )}
          {gapAnalysis.honestGaps.length > 0 && (
            <span>
              {acknowledgedGaps.length}/{gapAnalysis.honestGaps.length} gaps acknowledged
            </span>
          )}
        </div>
        <button
          onClick={handleApprove}
          disabled={
            approving ||
            (blockerWarnings.length > 0 &&
              acknowledgedBlockers.length < blockerWarnings.length) ||
            (gapAnalysis.honestGaps.length > 0 &&
              acknowledgedGaps.length < gapAnalysis.honestGaps.length)
          }
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {approving ? 'Approving...' : 'Approve & Generate Resume'}
        </button>
      </div>
    </div>
  );
}

// Sub-component for content slot display
function ContentSlot({
  label,
  slot,
  onSwap,
}: {
  label: string;
  slot: SlotSelection;
  onSwap: (from: string, to: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!slot.sources || slot.sources.length === 0) {
    return (
      <div className="border rounded p-3 mb-2 text-gray-500">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs ml-2">No content available</span>
      </div>
    );
  }

  const current = slot.sources[0];
  const alternatives = slot.sources.slice(1);

  return (
    <div className="border rounded p-3 mb-2">
      <div className="flex justify-between items-start">
        <div>
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-gray-500 ml-2">
            [{current.id}] Score: {current.score}
          </span>
          {current.variantLabel && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded ml-2">
              {current.variantLabel}
            </span>
          )}
        </div>
        {alternatives.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-600 hover:underline"
          >
            {expanded ? 'Hide' : `${alternatives.length} alternatives`}
          </button>
        )}
      </div>
      <div className="text-sm text-gray-700 mt-1 line-clamp-2">
        {current.content.substring(0, 150)}...
      </div>

      {expanded && alternatives.length > 0 && (
        <div className="mt-3 pl-4 border-l-2 border-gray-200 space-y-2">
          {alternatives.map((alt, i) => (
            <div key={i} className="text-sm bg-gray-50 p-2 rounded">
              <div className="flex justify-between">
                <span className="text-gray-500">
                  [{alt.id}] Score: {alt.score}
                  {alt.variantLabel && (
                    <span className="text-xs bg-gray-200 px-1 rounded ml-1">
                      {alt.variantLabel}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => onSwap(current.id, alt.id)}
                  className="text-blue-600 hover:underline"
                >
                  Use this instead
                </button>
              </div>
              <div className="text-gray-600 line-clamp-2 mt-1">
                {alt.content.substring(0, 100)}...
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
