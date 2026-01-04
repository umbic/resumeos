'use client';

import { useState } from 'react';
import type { Gap, GeneratedResume } from '@/types';
import { AlertTriangle, Check, X, Loader2 } from 'lucide-react';

interface GapRecommendationsProps {
  gaps: Gap[];
  sessionId: string;
  onGapAddressed: (updatedGaps: Gap[]) => void;
  onResumeUpdated: (resume: GeneratedResume) => void;
}

export function GapRecommendations({
  gaps,
  sessionId,
  onGapAddressed,
  onResumeUpdated
}: GapRecommendationsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const openGaps = gaps.filter(g => g.status === 'open');

  if (openGaps.length === 0) {
    return null;
  }

  const handleAddress = async (gapId: string) => {
    setLoading(gapId);
    try {
      const response = await fetch('/api/address-gap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, gapId }),
      });

      const data = await response.json();

      if (data.success) {
        onGapAddressed(data.gaps);
        onResumeUpdated(data.resume);
      }
    } catch (error) {
      console.error('Failed to address gap:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleSkip = async (gapId: string) => {
    setLoading(gapId);
    try {
      const response = await fetch('/api/skip-gap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, gapId }),
      });

      const data = await response.json();

      if (data.success) {
        onGapAddressed(data.gaps);
      }
    } catch (error) {
      console.error('Failed to skip gap:', error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <h3 className="font-semibold text-amber-900">
          {openGaps.length} Gap{openGaps.length > 1 ? 's' : ''} Identified
        </h3>
      </div>

      <p className="text-sm text-amber-700 mb-4">
        These JD themes weren&apos;t addressed but could be with minor reframing.
      </p>

      <div className="space-y-4">
        {openGaps.map((gap) => (
          <div
            key={gap.id}
            className="bg-white border border-amber-200 rounded-md p-3"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="font-medium text-gray-900">{gap.theme}</span>
                <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                  gap.severity === 'critical'
                    ? 'bg-red-100 text-red-700'
                    : gap.severity === 'moderate'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {gap.severity}
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-2">{gap.reason}</p>

            {gap.recommendation && (
              <div className="bg-blue-50 rounded p-2 mb-3">
                <p className="text-sm text-blue-800">
                  <strong>Suggestion:</strong> {gap.recommendation.suggestion}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Affects: {gap.recommendation.affectedSections.join(', ')}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              {gap.recommendation && (
                <button
                  onClick={() => handleAddress(gap.id)}
                  disabled={loading === gap.id}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading === gap.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Address It
                </button>
              )}

              <button
                onClick={() => handleSkip(gap.id)}
                disabled={loading === gap.id}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Skip
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
