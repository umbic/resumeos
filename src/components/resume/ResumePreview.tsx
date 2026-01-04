'use client';

import type { GeneratedResume } from '@/types';

interface ResumePreviewProps {
  resume: GeneratedResume;
  onSectionClick?: (section: string) => void;
  activeSection?: string | null;
}

export function ResumePreview({
  resume,
  onSectionClick,
  activeSection,
}: ResumePreviewProps) {

  const sectionClass = (section: string) => `
    cursor-pointer rounded p-2 -m-2 transition-colors
    ${activeSection === section ? 'bg-blue-50 ring-2 ring-blue-300' : 'hover:bg-gray-50'}
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
        onClick={() => onSectionClick?.('summary')}
      >
        <p className="text-gray-800 leading-relaxed">
          {resume.summary}
        </p>
      </div>

      {/* Career Highlights */}
      <div className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide border-b pb-1 mb-3">
          Career Highlights
        </h2>
        <ul className="space-y-2">
          {resume.career_highlights.map((highlight, index) => (
            <li
              key={index}
              className={sectionClass(`highlight_${index + 1}`)}
              onClick={() => onSectionClick?.(`highlight_${index + 1}`)}
            >
              {highlight}
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
              onClick={() => onSectionClick?.(`position_${position.number}_overview`)}
            >
              <p className="text-gray-700">
                {position.overview}
              </p>
            </div>

            {/* Bullets */}
            {position.bullets && position.bullets.length > 0 && (
              <ul className="mt-2 space-y-2 list-disc list-inside">
                {position.bullets.map((bullet, bulletIndex) => (
                  <li
                    key={bulletIndex}
                    className={sectionClass(`position_${position.number}_bullet_${bulletIndex + 1}`)}
                    onClick={() => onSectionClick?.(`position_${position.number}_bullet_${bulletIndex + 1}`)}
                  >
                    {bullet}
                  </li>
                ))}
              </ul>
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
