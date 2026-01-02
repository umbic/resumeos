import React from 'react';

interface RenderContentProps {
  content: string;
  showHighlights: boolean;
}

/**
 * Renders content with optional highlight markers.
 * When showHighlights is true, <mark> tags are rendered as yellow highlights.
 * When false, the mark tags are stripped and plain text is returned.
 */
export function renderContent({ content, showHighlights }: RenderContentProps): React.ReactNode {
  if (!content) return null;

  if (!showHighlights) {
    // Strip mark tags and return plain text
    return content.replace(/<\/?mark>/g, '');
  }

  // Parse and render with highlights
  const parts: React.ReactNode[] = [];
  let remaining = content;
  let keyIndex = 0;

  while (remaining.length > 0) {
    const markStart = remaining.indexOf('<mark>');

    if (markStart === -1) {
      // No more marks, add remaining text
      parts.push(remaining);
      break;
    }

    // Add text before the mark
    if (markStart > 0) {
      parts.push(remaining.slice(0, markStart));
    }

    // Find the closing tag
    const markEnd = remaining.indexOf('</mark>', markStart);

    if (markEnd === -1) {
      // No closing tag, add remaining as-is
      parts.push(remaining.slice(markStart));
      break;
    }

    // Extract the highlighted content
    const highlightedContent = remaining.slice(markStart + 6, markEnd);

    parts.push(
      <mark
        key={keyIndex++}
        className="bg-yellow-200 rounded px-0.5"
      >
        {highlightedContent}
      </mark>
    );

    // Move past the closing tag
    remaining = remaining.slice(markEnd + 7);
  }

  return <>{parts}</>;
}

/**
 * Strips all <mark> tags from content.
 * Used for DOCX export and other plain text outputs.
 */
export function stripMarks(content: string): string {
  if (!content) return '';
  return content.replace(/<\/?mark>/g, '');
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
