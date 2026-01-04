'use client';

import type { QualityScore } from '@/types';
import { CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';

interface QualityIndicatorProps {
  score: QualityScore;
  showDetails?: boolean;
}

export function QualityIndicator({ score, showDetails = false }: QualityIndicatorProps) {
  const gradeColors: Record<string, string> = {
    'A': 'bg-green-100 text-green-800 border-green-300',
    'B': 'bg-blue-100 text-blue-800 border-blue-300',
    'C': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'D': 'bg-orange-100 text-orange-800 border-orange-300',
    'F': 'bg-red-100 text-red-800 border-red-300',
  };

  const errorCount = score.issues.filter(i => i.severity === 'error').length;
  const warningCount = score.issues.filter(i => i.severity === 'warning').length;

  return (
    <div className="space-y-3">
      {/* Grade Badge */}
      <div className="flex items-center gap-4">
        <div className={`px-4 py-2 rounded-lg border-2 ${gradeColors[score.overall]}`}>
          <span className="text-2xl font-bold">{score.overall}</span>
        </div>

        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Keywords:</span>
            <span className="font-medium">{score.keyword_coverage}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Themes:</span>
            <span className="font-medium">{score.theme_alignment}%</span>
          </div>
        </div>
      </div>

      {/* Issue Summary */}
      {(errorCount > 0 || warningCount > 0) && (
        <div className="flex gap-3 text-sm">
          {errorCount > 0 && (
            <div className="flex items-center gap-1 text-red-600">
              <AlertCircle className="h-4 w-4" />
              {errorCount} error{errorCount > 1 ? 's' : ''}
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center gap-1 text-yellow-600">
              <AlertTriangle className="h-4 w-4" />
              {warningCount} warning{warningCount > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Issue Details */}
      {showDetails && score.issues.length > 0 && (
        <div className="mt-3 space-y-2">
          {score.issues.map((issue, index) => (
            <div
              key={index}
              className={`flex items-start gap-2 p-2 rounded text-sm ${
                issue.severity === 'error'
                  ? 'bg-red-50 text-red-800'
                  : 'bg-yellow-50 text-yellow-800'
              }`}
            >
              {issue.severity === 'error' ? (
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <span className="font-medium">{issue.location}:</span>{' '}
                {issue.message}
                {issue.autoFixed && (
                  <span className="ml-2 text-green-600 text-xs">(auto-fixed)</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All Clear */}
      {score.issues.length === 0 && (
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <CheckCircle className="h-4 w-4" />
          All quality checks passed
        </div>
      )}
    </div>
  );
}
