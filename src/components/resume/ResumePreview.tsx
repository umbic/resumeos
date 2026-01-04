'use client';

import type { GeneratedResume } from '@/types';
import { renderContent } from '@/lib/render-highlights';
import { Plus, X } from 'lucide-react';

interface ResumePreviewProps {
  resume: GeneratedResume;
  onSectionClick?: (sectionKey: string, content: string) => void;
  activeSection?: string | null;
  onAddItem?: (type: 'highlight' | 'bullet', positionNumber?: number) => void;
  onRemoveItem?: (type: 'highlight' | 'bullet', index: number, positionNumber?: number) => void;
}

export function ResumePreview({
  resume,
  onSectionClick,
  activeSection,
  onAddItem,
  onRemoveItem,
}: ResumePreviewProps) {

  const sectionClass = (section: string) => `
    cursor-pointer rounded p-2 -m-2 transition-all duration-150
    ${activeSection === section
      ? 'bg-blue-50 ring-2 ring-blue-300'
      : 'hover:bg-blue-50/50 hover:ring-1 hover:ring-blue-200'}
  `;

  return (
    <div className="prose prose-sm max-w-none">
      {/* Header */}
      <div className="text-center border-b pb-4 mb-4">
        <h1 className="text-2xl font-bold mb-1">Umberto Castaldo</h1>
        <p className="text-lg text-gray-700">
          {resume.positions[0]?.title || 'Brand Strategy Executive'}
        </p>
        <p className="text-sm text-gray-500">
          New York, NY | umberto@example.com
        </p>
      </div>

      {/* Summary */}
      <div
        className={sectionClass('summary')}
        onClick={() => onSectionClick?.('summary', resume.summary)}
      >
        <p className="text-gray-800 leading-relaxed">
          {renderContent({ content: resume.summary })}
        </p>
      </div>

      {/* Career Highlights */}
      <div className="mt-6">
        <div className="flex items-center justify-between border-b pb-1 mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wide">
            Career Highlights
          </h2>
          {onAddItem && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddItem('highlight');
              }}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Add highlight"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
        <ul className="space-y-2">
          {resume.career_highlights.map((highlight, index) => (
            <li
              key={index}
              className={`group relative ${sectionClass(`highlight_${index + 1}`)}`}
              onClick={() => onSectionClick?.(`highlight_${index + 1}`, highlight)}
            >
              {renderContent({ content: highlight })}
              {onRemoveItem && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveItem('highlight', index);
                  }}
                  className="absolute -right-1 top-1 p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                  title="Remove highlight"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Professional Experience */}
      <div className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide border-b pb-1 mb-3">
          Professional Experience
        </h2>

        {resume.positions.map((position) => (
          <div key={position.number} className="mb-6">
            {/* Position Header */}
            <div className="flex justify-between items-baseline mb-1">
              <h3 className="font-bold text-gray-900">{position.title}</h3>
              <span className="text-sm text-gray-500">{position.dates}</span>
            </div>
            <p className="text-gray-600 text-sm mb-2">
              {position.company} | {position.location}
            </p>

            {/* Overview */}
            <div
              className={sectionClass(`position_${position.number}_overview`)}
              onClick={() => onSectionClick?.(`position_${position.number}_overview`, position.overview)}
            >
              <p className="text-gray-700">
                {renderContent({ content: position.overview })}
              </p>
            </div>

            {/* Bullets */}
            {position.bullets && position.bullets.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-end mb-1">
                  {onAddItem && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddItem('bullet', position.number);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Add bullet"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <ul className="space-y-2 list-disc list-inside">
                  {position.bullets.map((bullet, bulletIndex) => (
                    <li
                      key={bulletIndex}
                      className={`group relative ${sectionClass(`position_${position.number}_bullet_${bulletIndex + 1}`)}`}
                      onClick={() => onSectionClick?.(`position_${position.number}_bullet_${bulletIndex + 1}`, bullet)}
                    >
                      {renderContent({ content: bullet })}
                      {onRemoveItem && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveItem('bullet', bulletIndex, position.number);
                          }}
                          className="absolute -right-1 top-1 p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                          title="Remove bullet"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Add bullet button when no bullets exist */}
            {(!position.bullets || position.bullets.length === 0) && onAddItem && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddItem('bullet', position.number);
                }}
                className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add bullet
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Education */}
      <div className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide border-b pb-1 mb-3">
          Education
        </h2>
        <p className="text-gray-700">
          <strong>Marist College</strong>: Bachelor of Business Administration |
          Business Management &amp; Marketing Communications
        </p>
      </div>
    </div>
  );
}
