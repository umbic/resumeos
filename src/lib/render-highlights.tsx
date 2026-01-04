import React from 'react';

interface RenderContentProps {
  content: string;
  showHighlights?: boolean;
}

/**
 * Parses text and renders markdown **bold** and <mark> tags as React elements.
 */
export function renderContent({ content, showHighlights = false }: RenderContentProps): React.ReactNode {
  if (!content) return null;

  // First strip mark tags if not showing highlights
  const processedContent = showHighlights ? content : content.replace(/<\/?mark>/g, '');

  // Parse both **bold** and <mark> tags
  const parts: React.ReactNode[] = [];
  let keyIndex = 0;

  // Regex to find **bold** text or <mark>highlighted</mark> text
  const pattern = /\*\*([^*]+)\*\*|<mark>([^<]+)<\/mark>/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(processedContent)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(processedContent.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // **bold** match
      parts.push(
        <strong key={keyIndex++} className="font-semibold">
          {match[1]}
        </strong>
      );
    } else if (match[2] && showHighlights) {
      // <mark> match (only render if showing highlights)
      parts.push(
        <mark key={keyIndex++} className="bg-yellow-200 rounded px-0.5">
          {match[2]}
        </mark>
      );
    } else if (match[2]) {
      // <mark> but not showing highlights - just add the text
      parts.push(match[2]);
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < processedContent.length) {
    parts.push(processedContent.slice(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : processedContent;
}

/**
 * Strips all <mark> tags and **bold** markers from content.
 * Used for plain text outputs.
 */
export function stripMarks(content: string): string {
  if (!content) return '';
  return content
    .replace(/<\/?mark>/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1');
}

/**
 * Segment of text for DOCX rendering
 */
export interface TextSegment {
  text: string;
  bold: boolean;
}

/**
 * Parses content and returns segments with bold flags.
 * Used for DOCX export to render **bold** text as actual bold.
 */
export function parseTextSegments(content: string): TextSegment[] {
  if (!content) return [];

  // Strip mark tags first
  const cleaned = content.replace(/<\/?mark>/g, '');

  const segments: TextSegment[] = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(cleaned)) !== null) {
    // Add non-bold text before this match
    if (match.index > lastIndex) {
      segments.push({
        text: cleaned.slice(lastIndex, match.index),
        bold: false,
      });
    }

    // Add bold segment
    segments.push({
      text: match[1],
      bold: true,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining non-bold text
  if (lastIndex < cleaned.length) {
    segments.push({
      text: cleaned.slice(lastIndex),
      bold: false,
    });
  }

  return segments;
}

/**
 * Renders an array of bullet points with optional highlights.
 */
export function renderBullets({
  bullets,
  showHighlights,
}: {
  bullets: string[];
  showHighlights: boolean;
}): React.ReactNode[] {
  return bullets.map((bullet, index) => (
    <li key={index}>
      {renderContent({ content: bullet, showHighlights })}
    </li>
  ));
}
