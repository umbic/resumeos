'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useResumeStore } from '@/lib/store';
import { STATIC_CONTENT, POSITIONS } from '@/lib/rules';

export function PreviewPanel() {
  const {
    format,
    header,
    summary,
    highlights,
    positions,
    targetTitle,
  } = useResumeStore();

  const displayHeader = header || {
    name: STATIC_CONTENT.header.name,
    title: targetTitle || 'Brand Strategist',
    location: STATIC_CONTENT.header.location,
    phone: STATIC_CONTENT.header.phone,
    email: STATIC_CONTENT.header.email,
  };

  return (
    <div className="h-full bg-white">
      <div className="sticky top-0 bg-zinc-100 border-b border-zinc-300 px-4 py-2 flex items-center justify-between">
        <h2 className="font-semibold text-zinc-700">Resume Preview</h2>
        <Badge variant="outline" className="text-zinc-600">
          {format === 'long' ? 'Long Format' : 'Short Format'}
        </Badge>
      </div>

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
                  {summary}
                </p>
              </>
            )}

            {/* Career Highlights */}
            {highlights.length > 0 && (
              <div className="mb-4">
                <SectionHeader>Career Highlights</SectionHeader>
                <ul className="list-disc list-outside ml-4 space-y-1">
                  {highlights.map((highlight, idx) => (
                    <li key={idx} className="text-sm text-zinc-700">
                      <HighlightText text={highlight} />
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
                        {posData.overview}
                      </p>
                    )}

                    {showBullets && posData?.bullets && posData.bullets.length > 0 && (
                      <ul className="list-disc list-outside ml-4 mt-2 space-y-1">
                        {posData.bullets.map((bullet, idx) => (
                          <li key={idx} className="text-sm text-zinc-700">
                            {bullet}
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

function HighlightText({ text }: { text: string }) {
  // Parse for bold hook phrase (text before the colon)
  const colonIndex = text.indexOf(':');

  if (colonIndex > 0 && colonIndex < 60) {
    const hook = text.substring(0, colonIndex + 1);
    const rest = text.substring(colonIndex + 1);

    return (
      <>
        <span className="font-semibold">{hook}</span>
        {rest}
      </>
    );
  }

  return <>{text}</>;
}
