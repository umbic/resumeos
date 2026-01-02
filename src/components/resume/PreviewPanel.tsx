'use client';

import { useState } from 'react';
import { ListFilter } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useResumeStore } from '@/lib/store';
import { STATIC_CONTENT, POSITIONS } from '@/lib/rules';
import { renderContent } from '@/lib/render-highlights';
import { KeywordsPanel } from './KeywordsPanel';

export function PreviewPanel() {
  const [showHighlights, setShowHighlights] = useState(false);
  const [showKeywords, setShowKeywords] = useState(false);

  const {
    format,
    header,
    summary,
    highlights,
    positions,
    targetTitle,
    jdAnalysis,
  } = useResumeStore();

  // Calculate keyword stats
  const keywordStats = jdAnalysis
    ? {
        total: jdAnalysis.keywords.filter((k: { status: string }) => k.status !== 'dismissed').length,
        addressed: jdAnalysis.keywords.filter((k: { status: string }) => k.status === 'addressed').length,
      }
    : null;

  const displayHeader = header || {
    name: STATIC_CONTENT.header.name,
    title: targetTitle || 'Brand Strategist',
    location: STATIC_CONTENT.header.location,
    phone: STATIC_CONTENT.header.phone,
    email: STATIC_CONTENT.header.email,
  };

  return (
    <div className="h-full bg-white relative">
      <div className="sticky top-0 bg-zinc-100 border-b border-zinc-300 px-4 py-2 flex items-center justify-between z-20">
        <h2 className="font-semibold text-zinc-700">Resume Preview</h2>
        <div className="flex items-center gap-4">
          {/* Keywords toggle button */}
          {jdAnalysis && keywordStats && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowKeywords(!showKeywords)}
              className={`flex items-center gap-2 ${
                showKeywords ? 'bg-zinc-200 border-zinc-400' : ''
              }`}
            >
              <ListFilter className="h-4 w-4" />
              <span className="text-xs">
                Keywords {keywordStats.addressed}/{keywordStats.total}
              </span>
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Switch
              id="show-highlights"
              checked={showHighlights}
              onCheckedChange={setShowHighlights}
            />
            <Label htmlFor="show-highlights" className="text-sm text-zinc-600 cursor-pointer">
              Show Customizations
            </Label>
          </div>
          <Badge variant="outline" className="text-zinc-600">
            {format === 'long' ? 'Long Format' : 'Short Format'}
          </Badge>
        </div>
      </div>

      {/* Keywords Panel (slides from right) */}
      <KeywordsPanel isOpen={showKeywords} onClose={() => setShowKeywords(false)} />

      <ScrollArea className="h-[calc(100%-48px)]">
        <div className="p-8 max-w-[700px] mx-auto">
          {/* Document preview styled like a resume */}
          <div className="bg-white shadow-lg rounded-sm border border-zinc-200 p-8 min-h-[800px]">
            {/* Header */}
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-zinc-900">
                {displayHeader.name}
              </h1>
              <p className="text-lg text-zinc-700">{displayHeader.title}</p>
              <p className="text-sm text-zinc-500 mt-1">
                {displayHeader.location} | {displayHeader.phone} |{' '}
                {displayHeader.email}
              </p>
            </div>

            {/* Summary */}
            {summary && (
              <>
                <p className="text-sm text-zinc-700 leading-relaxed mb-4">
                  {renderContent({ content: summary, showHighlights })}
                </p>
              </>
            )}

            {/* Career Highlights */}
            {highlights.length > 0 && (
              <div className="mb-4">
                <SectionHeader>Career Highlights</SectionHeader>
                <ul className="list-disc list-outside ml-4 space-y-1">
                  {highlights.map((highlight: string, idx: number) => (
                    <li key={idx} className="text-sm text-zinc-700">
                      <HighlightText text={highlight} showHighlights={showHighlights} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Professional Experience */}
            <div className="mb-4">
              <SectionHeader>Professional Experience</SectionHeader>

              {POSITIONS.map((posConfig) => {
                const posData = positions[posConfig.number];
                const showBullets =
                  format === 'long' &&
                  (posConfig.number === 1 || posConfig.number === 2);

                return (
                  <div key={posConfig.number} className="mb-4">
                    <div className="flex justify-between items-baseline">
                      <h3 className="font-semibold text-zinc-900 text-sm">
                        {posData?.title || posConfig.titleDefault}
                      </h3>
                      <span className="text-sm text-zinc-500">
                        {posData?.dates || posConfig.dates}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-600">
                      {posData?.company || posConfig.company} |{' '}
                      {posData?.location || posConfig.location}
                    </p>

                    {posData?.overview && (
                      <p className="text-sm text-zinc-700 mt-2 leading-relaxed">
                        {renderContent({ content: posData.overview, showHighlights })}
                      </p>
                    )}

                    {showBullets && posData?.bullets && posData.bullets.length > 0 && (
                      <ul className="list-disc list-outside ml-4 mt-2 space-y-1">
                        {posData.bullets.map((bullet: string, idx: number) => (
                          <li key={idx} className="text-sm text-zinc-700">
                            {renderContent({ content: bullet, showHighlights })}
                          </li>
                        ))}
                      </ul>
                    )}

                    {!posData?.overview && (
                      <p className="text-sm text-zinc-400 italic mt-1">
                        Overview pending...
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Education */}
            <div>
              <SectionHeader>Education</SectionHeader>
              <p className="text-sm text-zinc-700">
                <span className="font-medium">
                  {STATIC_CONTENT.education.school}:
                </span>{' '}
                {STATIC_CONTENT.education.degree} |{' '}
                {STATIC_CONTENT.education.field}
              </p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <>
      <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wide mb-1">
        {children}
      </h2>
      <Separator className="mb-2 bg-zinc-300" />
    </>
  );
}

function HighlightText({ text, showHighlights }: { text: string; showHighlights: boolean }) {
  // First, handle mark tags for highlight display
  const processedText = showHighlights ? text : text.replace(/<\/?mark>/g, '');

  // Parse for bold hook phrase (text before the colon)
  const colonIndex = processedText.indexOf(':');

  if (colonIndex > 0 && colonIndex < 60) {
    const hook = processedText.substring(0, colonIndex + 1);
    const rest = processedText.substring(colonIndex + 1);

    return (
      <>
        <span className="font-semibold">{renderContent({ content: hook, showHighlights })}</span>
        {renderContent({ content: rest, showHighlights })}
      </>
    );
  }

  return <>{renderContent({ content: processedText, showHighlights })}</>;
}
