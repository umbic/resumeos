'use client';

import { PencilIcon } from 'lucide-react';
import type {
  AssembledResume,
  NarrativeWriterOutput,
  DetailWriterOutput,
  ContentAllocation,
} from '@/types/v2.1';

export type SectionType =
  | 'summary'
  | 'career-highlight'
  | 'position-overview'
  | 'position-bullet';

export interface EditTarget {
  type: SectionType;
  index?: number;
  positionIndex?: number;
  bulletIndex?: number;
}

interface InteractiveResumeProps {
  assembledResume: AssembledResume;
  narrativeOutput: NarrativeWriterOutput;
  detailOutput: DetailWriterOutput;
  allocation: ContentAllocation;
  onEditSection: (target: EditTarget) => void;
}

export function InteractiveResume({
  assembledResume,
  narrativeOutput,
  detailOutput,
  onEditSection,
}: InteractiveResumeProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-8 max-w-3xl mx-auto">
      {/* Header - Read Only */}
      <HeaderSection header={assembledResume.header} />

      {/* Summary - Editable */}
      <SummarySection
        content={assembledResume.summary}
        sources={narrativeOutput.summary.sourcesUsed}
        wordCount={narrativeOutput.summary.wordCount}
        onClick={() => onEditSection({ type: 'summary' })}
      />

      {/* Career Highlights - Editable */}
      <CareerHighlightsSection
        highlights={assembledResume.careerHighlights}
        narrativeHighlights={narrativeOutput.careerHighlights}
        onClickHighlight={(index) =>
          onEditSection({ type: 'career-highlight', index })
        }
      />

      {/* Positions */}
      <PositionsSection
        positions={assembledResume.positions}
        detailOutput={detailOutput}
        onEditOverview={(positionIndex) =>
          onEditSection({ type: 'position-overview', positionIndex })
        }
        onEditBullet={(positionIndex, bulletIndex) =>
          onEditSection({ type: 'position-bullet', positionIndex, bulletIndex })
        }
      />

      {/* Education - Read Only */}
      <EducationSection education={assembledResume.education} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Header Section (Read Only)
// ─────────────────────────────────────────────────────────────

function HeaderSection({ header }: { header: AssembledResume['header'] }) {
  return (
    <div className="text-center border-b pb-6 mb-6">
      <h1 className="text-2xl font-bold text-gray-900">{header.name}</h1>
      <p className="text-lg text-blue-600 mt-1">{header.targetTitle}</p>
      <div className="text-sm text-gray-600 mt-2 flex items-center justify-center gap-4">
        <span>{header.location}</span>
        <span className="text-gray-300">|</span>
        <span>{header.phone}</span>
        <span className="text-gray-300">|</span>
        <span>{header.email}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Summary Section (Editable)
// ─────────────────────────────────────────────────────────────

interface SummarySectionProps {
  content: string;
  sources: string[];
  wordCount: number;
  onClick: () => void;
}

function SummarySection({
  content,
  sources,
  wordCount,
  onClick,
}: SummarySectionProps) {
  const isValidWordCount = wordCount >= 140 && wordCount <= 160;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
          Summary
        </h2>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span
            className={
              isValidWordCount ? 'text-green-600' : 'text-amber-600'
            }
          >
            {wordCount} words
          </span>
          <span className="text-gray-300">|</span>
          <span>Sources: {sources.join(', ')}</span>
        </div>
      </div>
      <EditableSection onClick={onClick}>
        <p className="text-gray-700 leading-relaxed">{content}</p>
      </EditableSection>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Career Highlights Section (Editable)
// ─────────────────────────────────────────────────────────────

interface CareerHighlightsSectionProps {
  highlights: string[];
  narrativeHighlights: NarrativeWriterOutput['careerHighlights'];
  onClickHighlight: (index: number) => void;
}

function CareerHighlightsSection({
  highlights,
  narrativeHighlights,
  onClickHighlight,
}: CareerHighlightsSectionProps) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
        Career Highlights
      </h2>
      <div className="space-y-3">
        {highlights.map((highlight, index) => {
          const narrativeData = narrativeHighlights[index];
          const wordCount = highlight.split(/\s+/).length;
          const isValidWordCount = wordCount >= 25 && wordCount <= 40;

          return (
            <EditableSection
              key={index}
              onClick={() => onClickHighlight(index)}
            >
              <div className="flex items-start gap-3">
                <span className="text-blue-600 font-bold text-sm mt-0.5">
                  {index + 1}.
                </span>
                <div className="flex-1">
                  <p
                    className="text-gray-700"
                    dangerouslySetInnerHTML={{
                      __html: highlight.replace(
                        /\*\*(.*?)\*\*/g,
                        '<strong>$1</strong>'
                      ),
                    }}
                  />
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span
                      className={
                        isValidWordCount ? 'text-green-600' : 'text-amber-600'
                      }
                    >
                      {wordCount} words
                    </span>
                    {narrativeData && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span>Source: {narrativeData.sourceId}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </EditableSection>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Positions Section
// ─────────────────────────────────────────────────────────────

interface PositionsSectionProps {
  positions: AssembledResume['positions'];
  detailOutput: DetailWriterOutput;
  onEditOverview: (positionIndex: number) => void;
  onEditBullet: (positionIndex: number, bulletIndex: number) => void;
}

function PositionsSection({
  positions,
  detailOutput,
  onEditOverview,
  onEditBullet,
}: PositionsSectionProps) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
        Professional Experience
      </h2>
      <div className="space-y-6">
        {positions.map((position, posIndex) => {
          // Only P1 and P2 have editable overviews/bullets from detailOutput
          const isEditablePosition = posIndex < 2;
          const positionDetail = isEditablePosition
            ? posIndex === 0
              ? detailOutput.position1
              : detailOutput.position2
            : null;

          return (
            <PositionItem
              key={posIndex}
              position={position}
              positionDetail={positionDetail}
              isEditable={isEditablePosition}
              onEditOverview={() => onEditOverview(posIndex)}
              onEditBullet={(bulletIndex) => onEditBullet(posIndex, bulletIndex)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface PositionItemProps {
  position: AssembledResume['positions'][0];
  positionDetail: DetailWriterOutput['position1'] | null;
  isEditable: boolean;
  onEditOverview: () => void;
  onEditBullet: (bulletIndex: number) => void;
}

function PositionItem({
  position,
  positionDetail,
  isEditable,
  onEditOverview,
  onEditBullet,
}: PositionItemProps) {
  const overviewWordCount = position.overview?.split(/\s+/).length || 0;
  const isValidOverviewWordCount =
    overviewWordCount >= 40 && overviewWordCount <= 60;

  return (
    <div className="border-l-2 border-gray-200 pl-4">
      {/* Position Header */}
      <div className="mb-2">
        <h3 className="font-bold text-gray-900">{position.title}</h3>
        <p className="text-gray-600">
          {position.company} | {position.location}
        </p>
        <p className="text-sm text-gray-500">
          {position.startDate} - {position.endDate}
        </p>
      </div>

      {/* Overview */}
      {position.overview && (
        <div className="mb-3">
          {isEditable ? (
            <EditableSection onClick={onEditOverview}>
              <p className="text-gray-700 text-sm leading-relaxed">
                {position.overview}
              </p>
              {positionDetail && (
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                  <span
                    className={
                      isValidOverviewWordCount
                        ? 'text-green-600'
                        : 'text-amber-600'
                    }
                  >
                    {overviewWordCount} words
                  </span>
                  <span className="text-gray-300">|</span>
                  <span>Source: {positionDetail.overview.sourceId}</span>
                </div>
              )}
            </EditableSection>
          ) : (
            <p className="text-gray-700 text-sm leading-relaxed">
              {position.overview}
            </p>
          )}
        </div>
      )}

      {/* Bullets */}
      {position.bullets && position.bullets.length > 0 && (
        <ul className="space-y-2 ml-2">
          {position.bullets.map((bullet, bulletIndex) => {
            const bulletWordCount = bullet.split(/\s+/).length;
            const isValidBulletWordCount =
              bulletWordCount >= 25 && bulletWordCount <= 40;
            const bulletDetail = positionDetail?.bullets?.[bulletIndex];

            return (
              <li key={bulletIndex}>
                {isEditable ? (
                  <EditableSection onClick={() => onEditBullet(bulletIndex)}>
                    <div className="flex items-start gap-2">
                      <span className="text-gray-400 mt-1">-</span>
                      <div className="flex-1">
                        <p className="text-gray-700 text-sm">{bullet}</p>
                        {bulletDetail && (
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                            <span
                              className={
                                isValidBulletWordCount
                                  ? 'text-green-600'
                                  : 'text-amber-600'
                              }
                            >
                              {bulletWordCount} words
                            </span>
                            <span className="text-gray-300">|</span>
                            <span>Source: {bulletDetail.sourceId}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </EditableSection>
                ) : (
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">-</span>
                    <p className="text-gray-700 text-sm">{bullet}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Education Section (Read Only)
// ─────────────────────────────────────────────────────────────

function EducationSection({
  education,
}: {
  education: AssembledResume['education'];
}) {
  return (
    <div>
      <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">
        Education
      </h2>
      <div className="text-gray-700">
        <p className="font-medium">{education.degree}</p>
        <p className="text-sm text-gray-600">
          {education.school} | {education.field}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Editable Section Wrapper
// ─────────────────────────────────────────────────────────────

interface EditableSectionProps {
  onClick: () => void;
  children: React.ReactNode;
}

function EditableSection({ onClick, children }: EditableSectionProps) {
  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer rounded-lg p-3 -m-3 transition-all hover:bg-blue-50 hover:ring-2 hover:ring-blue-200"
    >
      {children}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-blue-600 text-white p-1.5 rounded-full shadow-lg">
          <PencilIcon className="w-3 h-3" />
        </div>
      </div>
    </div>
  );
}
