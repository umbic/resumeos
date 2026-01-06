/**
 * Format Checker - Pure code validation (no LLM needed)
 * Validates formatting rules for V2.1 resume output
 */

import { NarrativeWriterOutput, DetailWriterOutput, FormatChecks } from '@/types/v2.1';

// Word count thresholds
const SUMMARY_WORD_COUNT = { min: 140, max: 160 };
const CAREER_HIGHLIGHT_WORD_COUNT = { min: 25, max: 40 };
const BULLET_WORD_COUNT = { min: 25, max: 40 };
const OVERVIEW_WORD_COUNT = { min: 40, max: 60 };

// Words that shouldn't be overused (threshold: 3+)
const OVERUSE_THRESHOLD = 3;

/**
 * Main entry point - runs all format checks
 */
export function runFormatChecks(
  narrativeOutput: NarrativeWriterOutput,
  detailOutput: DetailWriterOutput
): FormatChecks {
  return {
    emdashDetected: checkEmdashes(narrativeOutput, detailOutput),
    wordVariety: checkWordVariety(narrativeOutput, detailOutput),
    summaryLength: checkSummaryLength(narrativeOutput),
    bulletLengths: checkBulletLengths(narrativeOutput, detailOutput),
    verbRepetition: checkVerbRepetition(narrativeOutput, detailOutput),
    overviewLengths: checkOverviewLengths(detailOutput),
  };
}

/**
 * Check for forbidden emdashes (—) in content
 */
export function checkEmdashes(
  narrativeOutput: NarrativeWriterOutput,
  detailOutput: DetailWriterOutput
): FormatChecks['emdashDetected'] {
  const locations: string[] = [];

  // Check summary
  if (narrativeOutput.summary.content.includes('—')) {
    locations.push('summary');
  }

  // Check career highlights
  narrativeOutput.careerHighlights.forEach((ch, i) => {
    if (ch.headline.includes('—') || ch.content.includes('—')) {
      locations.push(`career-highlight-${i + 1}`);
    }
  });

  // Check P1 overview and bullets
  if (detailOutput.position1.overview.content.includes('—')) {
    locations.push('p1-overview');
  }
  detailOutput.position1.bullets.forEach((b, i) => {
    if (b.content.includes('—')) {
      locations.push(`p1-bullet-${i + 1}`);
    }
  });

  // Check P2 overview and bullets
  if (detailOutput.position2.overview.content.includes('—')) {
    locations.push('p2-overview');
  }
  detailOutput.position2.bullets.forEach((b, i) => {
    if (b.content.includes('—')) {
      locations.push(`p2-bullet-${i + 1}`);
    }
  });

  return {
    passed: locations.length === 0,
    locations,
  };
}

/**
 * Check for overused words (>3 occurrences across resume)
 */
export function checkWordVariety(
  narrativeOutput: NarrativeWriterOutput,
  detailOutput: DetailWriterOutput
): FormatChecks['wordVariety'] {
  // Collect all text with locations
  const textWithLocations: { text: string; location: string }[] = [
    { text: narrativeOutput.summary.content, location: 'summary' },
    ...narrativeOutput.careerHighlights.map((ch, i) => ({
      text: `${ch.headline} ${ch.content}`,
      location: `career-highlight-${i + 1}`,
    })),
    { text: detailOutput.position1.overview.content, location: 'p1-overview' },
    ...detailOutput.position1.bullets.map((b, i) => ({
      text: b.content,
      location: `p1-bullet-${i + 1}`,
    })),
    { text: detailOutput.position2.overview.content, location: 'p2-overview' },
    ...detailOutput.position2.bullets.map((b, i) => ({
      text: b.content,
      location: `p2-bullet-${i + 1}`,
    })),
  ];

  // Count word occurrences with locations
  const wordCounts: Map<string, { count: number; locations: string[] }> = new Map();

  // Words to ignore (common words that aren't problematic)
  const ignoreWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
    'that', 'which', 'who', 'whom', 'this', 'these', 'those', 'it', 'its',
    'their', 'they', 'them', 'we', 'our', 'us', 'you', 'your', 'he', 'she',
    'his', 'her', 'i', 'my', 'me', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'between', 'under', 'over', 'out', 'up',
    'down', 'off', 'about', 'against', 'more', 'most', 'other', 'some',
    'such', 'no', 'not', 'only', 'same', 'so', 'than', 'too', 'very',
    'just', 'also', 'now', 'here', 'there', 'when', 'where', 'why', 'how',
    'all', 'each', 'every', 'both', 'few', 'any', 'many', 'much', 'new',
  ]);

  textWithLocations.forEach(({ text, location }) => {
    const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    words.forEach(word => {
      if (word.length < 4 || ignoreWords.has(word)) return;

      const existing = wordCounts.get(word);
      if (existing) {
        if (!existing.locations.includes(location)) {
          existing.locations.push(location);
        }
        existing.count++;
      } else {
        wordCounts.set(word, { count: 1, locations: [location] });
      }
    });
  });

  // Find overused words
  const overusedWords: { word: string; count: number; locations: string[] }[] = [];
  wordCounts.forEach((data, word) => {
    if (data.count >= OVERUSE_THRESHOLD) {
      overusedWords.push({ word, count: data.count, locations: data.locations });
    }
  });

  // Sort by count descending
  overusedWords.sort((a, b) => b.count - a.count);

  return {
    passed: overusedWords.length === 0,
    overusedWords,
  };
}

/**
 * Check summary word count (140-160 words)
 */
export function checkSummaryLength(
  narrativeOutput: NarrativeWriterOutput
): FormatChecks['summaryLength'] {
  const wordCount = narrativeOutput.summary.wordCount ||
    narrativeOutput.summary.content.split(/\s+/).length;

  return {
    wordCount,
    passed: wordCount >= SUMMARY_WORD_COUNT.min && wordCount <= SUMMARY_WORD_COUNT.max,
    expected: `${SUMMARY_WORD_COUNT.min}-${SUMMARY_WORD_COUNT.max} words`,
  };
}

/**
 * Check bullet lengths (career highlights: 25-40, position bullets: 25-40)
 */
export function checkBulletLengths(
  narrativeOutput: NarrativeWriterOutput,
  detailOutput: DetailWriterOutput
): FormatChecks['bulletLengths'] {
  const issues: { location: string; wordCount: number; expected: string }[] = [];
  const expectedRange = `${BULLET_WORD_COUNT.min}-${BULLET_WORD_COUNT.max} words`;

  // Check career highlights
  narrativeOutput.careerHighlights.forEach((ch, i) => {
    const wordCount = ch.content.split(/\s+/).length;
    if (wordCount < CAREER_HIGHLIGHT_WORD_COUNT.min || wordCount > CAREER_HIGHLIGHT_WORD_COUNT.max) {
      issues.push({
        location: `career-highlight-${i + 1}`,
        wordCount,
        expected: `${CAREER_HIGHLIGHT_WORD_COUNT.min}-${CAREER_HIGHLIGHT_WORD_COUNT.max} words`,
      });
    }
  });

  // Check P1 bullets
  detailOutput.position1.bullets.forEach((b, i) => {
    const wordCount = b.wordCount || b.content.split(/\s+/).length;
    if (wordCount < BULLET_WORD_COUNT.min || wordCount > BULLET_WORD_COUNT.max) {
      issues.push({
        location: `p1-bullet-${i + 1}`,
        wordCount,
        expected: expectedRange,
      });
    }
  });

  // Check P2 bullets
  detailOutput.position2.bullets.forEach((b, i) => {
    const wordCount = b.wordCount || b.content.split(/\s+/).length;
    if (wordCount < BULLET_WORD_COUNT.min || wordCount > BULLET_WORD_COUNT.max) {
      issues.push({
        location: `p2-bullet-${i + 1}`,
        wordCount,
        expected: expectedRange,
      });
    }
  });

  return {
    passed: issues.length === 0,
    issues,
  };
}

/**
 * Check verb repetition:
 * - No repeated verbs within a position
 * - Flag verbs used more than 2x across entire resume
 */
export function checkVerbRepetition(
  narrativeOutput: NarrativeWriterOutput,
  detailOutput: DetailWriterOutput
): FormatChecks['verbRepetition'] {
  const withinPositionIssues: { position: string; verb: string; count: number }[] = [];
  const allVerbs: string[] = [];

  // Collect CH verbs
  const chVerbs: string[] = [];
  narrativeOutput.careerHighlights.forEach(ch => {
    if (ch.primaryVerb) {
      chVerbs.push(ch.primaryVerb.toLowerCase());
      allVerbs.push(ch.primaryVerb.toLowerCase());
    }
  });

  // Check for duplicates in CH
  const chVerbCounts: Record<string, number> = {};
  chVerbs.forEach(v => {
    chVerbCounts[v] = (chVerbCounts[v] || 0) + 1;
  });
  Object.entries(chVerbCounts).forEach(([verb, count]) => {
    if (count > 1) {
      withinPositionIssues.push({ position: 'career-highlights', verb, count });
    }
  });

  // Collect P1 verbs
  const p1Verbs: string[] = [];
  detailOutput.position1.bullets.forEach(b => {
    if (b.primaryVerb) {
      p1Verbs.push(b.primaryVerb.toLowerCase());
      allVerbs.push(b.primaryVerb.toLowerCase());
    }
  });

  // Check for duplicates in P1
  const p1VerbCounts: Record<string, number> = {};
  p1Verbs.forEach(v => {
    p1VerbCounts[v] = (p1VerbCounts[v] || 0) + 1;
  });
  Object.entries(p1VerbCounts).forEach(([verb, count]) => {
    if (count > 1) {
      withinPositionIssues.push({ position: 'position-1', verb, count });
    }
  });

  // Collect P2 verbs
  const p2Verbs: string[] = [];
  detailOutput.position2.bullets.forEach(b => {
    if (b.primaryVerb) {
      p2Verbs.push(b.primaryVerb.toLowerCase());
      allVerbs.push(b.primaryVerb.toLowerCase());
    }
  });

  // Check for duplicates in P2
  const p2VerbCounts: Record<string, number> = {};
  p2Verbs.forEach(v => {
    p2VerbCounts[v] = (p2VerbCounts[v] || 0) + 1;
  });
  Object.entries(p2VerbCounts).forEach(([verb, count]) => {
    if (count > 1) {
      withinPositionIssues.push({ position: 'position-2', verb, count });
    }
  });

  // Check across entire resume (threshold: >2)
  const acrossResumeIssues: { verb: string; count: number }[] = [];
  const totalVerbCounts: Record<string, number> = {};
  allVerbs.forEach(v => {
    totalVerbCounts[v] = (totalVerbCounts[v] || 0) + 1;
  });
  Object.entries(totalVerbCounts).forEach(([verb, count]) => {
    if (count > 2) {
      acrossResumeIssues.push({ verb, count });
    }
  });

  return {
    passed: withinPositionIssues.length === 0 && acrossResumeIssues.length === 0,
    withinPositionIssues,
    acrossResumeIssues,
  };
}

/**
 * Check overview lengths (40-60 words)
 */
export function checkOverviewLengths(
  detailOutput: DetailWriterOutput
): FormatChecks['overviewLengths'] {
  const issues: { location: string; wordCount: number; expected: string }[] = [];
  const expectedRange = `${OVERVIEW_WORD_COUNT.min}-${OVERVIEW_WORD_COUNT.max} words`;

  // Check P1 overview
  const p1WordCount = detailOutput.position1.overview.wordCount ||
    detailOutput.position1.overview.content.split(/\s+/).length;
  if (p1WordCount < OVERVIEW_WORD_COUNT.min || p1WordCount > OVERVIEW_WORD_COUNT.max) {
    issues.push({
      location: 'p1-overview',
      wordCount: p1WordCount,
      expected: expectedRange,
    });
  }

  // Check P2 overview
  const p2WordCount = detailOutput.position2.overview.wordCount ||
    detailOutput.position2.overview.content.split(/\s+/).length;
  if (p2WordCount < OVERVIEW_WORD_COUNT.min || p2WordCount > OVERVIEW_WORD_COUNT.max) {
    issues.push({
      location: 'p2-overview',
      wordCount: p2WordCount,
      expected: expectedRange,
    });
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

/**
 * Calculate format score (0-10) based on check results
 */
export function calculateFormatScore(formatChecks: FormatChecks): number {
  let score = 10;

  // Emdash deduction: -1 per occurrence, max -2
  if (!formatChecks.emdashDetected.passed) {
    score -= Math.min(formatChecks.emdashDetected.locations.length, 2);
  }

  // Word variety deduction: -0.5 per overused word, max -2
  if (!formatChecks.wordVariety.passed) {
    score -= Math.min(formatChecks.wordVariety.overusedWords.length * 0.5, 2);
  }

  // Summary length deduction: -1 if wrong
  if (!formatChecks.summaryLength.passed) {
    score -= 1;
  }

  // Bullet length deduction: -0.5 per issue, max -2
  if (!formatChecks.bulletLengths.passed) {
    score -= Math.min(formatChecks.bulletLengths.issues.length * 0.5, 2);
  }

  // Verb repetition deduction: -1 per within-position issue, -0.5 per across-resume issue, max -2
  if (!formatChecks.verbRepetition.passed) {
    const withinDeduction = formatChecks.verbRepetition.withinPositionIssues.length;
    const acrossDeduction = formatChecks.verbRepetition.acrossResumeIssues.length * 0.5;
    score -= Math.min(withinDeduction + acrossDeduction, 2);
  }

  // Overview length deduction: -0.5 per issue, max -1
  if (!formatChecks.overviewLengths.passed) {
    score -= Math.min(formatChecks.overviewLengths.issues.length * 0.5, 1);
  }

  return Math.max(0, Math.round(score * 10) / 10);
}

/**
 * Generate format issues from checks for inclusion in ValidationResultV21
 */
export function generateFormatIssues(
  formatChecks: FormatChecks
): { category: 'format'; severity: 'blocker' | 'warning' | 'suggestion'; location: string; issue: string; evidence: string; suggestedFix: string }[] {
  const issues: { category: 'format'; severity: 'blocker' | 'warning' | 'suggestion'; location: string; issue: string; evidence: string; suggestedFix: string }[] = [];

  // Emdash issues (warning)
  if (!formatChecks.emdashDetected.passed) {
    formatChecks.emdashDetected.locations.forEach(location => {
      issues.push({
        category: 'format',
        severity: 'warning',
        location,
        issue: 'Contains forbidden emdash character',
        evidence: 'Found — character which should be avoided',
        suggestedFix: 'Rewrite sentence to avoid emdash, use comma or period instead',
      });
    });
  }

  // Word variety issues (suggestion)
  if (!formatChecks.wordVariety.passed) {
    formatChecks.wordVariety.overusedWords.forEach(({ word, count, locations }) => {
      issues.push({
        category: 'format',
        severity: 'suggestion',
        location: locations.join(', '),
        issue: `Word "${word}" used ${count} times`,
        evidence: `Found in: ${locations.join(', ')}`,
        suggestedFix: `Use synonyms or restructure sentences to reduce repetition of "${word}"`,
      });
    });
  }

  // Summary length issue (warning)
  if (!formatChecks.summaryLength.passed) {
    issues.push({
      category: 'format',
      severity: 'warning',
      location: 'summary',
      issue: `Summary has ${formatChecks.summaryLength.wordCount} words (expected ${formatChecks.summaryLength.expected})`,
      evidence: `Word count: ${formatChecks.summaryLength.wordCount}`,
      suggestedFix: formatChecks.summaryLength.wordCount < 140
        ? 'Expand summary to include more detail'
        : 'Condense summary to be more concise',
    });
  }

  // Bullet length issues (warning)
  if (!formatChecks.bulletLengths.passed) {
    formatChecks.bulletLengths.issues.forEach(({ location, wordCount, expected }) => {
      issues.push({
        category: 'format',
        severity: 'warning',
        location,
        issue: `Bullet has ${wordCount} words (expected ${expected})`,
        evidence: `Word count: ${wordCount}`,
        suggestedFix: wordCount < 25
          ? 'Expand bullet with more context or metrics'
          : 'Condense bullet to focus on key achievement',
      });
    });
  }

  // Verb repetition issues (warning for within-position, suggestion for across-resume)
  if (!formatChecks.verbRepetition.passed) {
    formatChecks.verbRepetition.withinPositionIssues.forEach(({ position, verb, count }) => {
      issues.push({
        category: 'format',
        severity: 'warning',
        location: position,
        issue: `Verb "${verb}" repeated ${count} times within ${position}`,
        evidence: `Found ${count} occurrences of "${verb}"`,
        suggestedFix: `Use different verbs within ${position} to add variety`,
      });
    });

    formatChecks.verbRepetition.acrossResumeIssues.forEach(({ verb, count }) => {
      issues.push({
        category: 'format',
        severity: 'suggestion',
        location: 'entire resume',
        issue: `Verb "${verb}" used ${count} times across resume`,
        evidence: `Found ${count} total occurrences`,
        suggestedFix: 'Consider using synonyms for some occurrences',
      });
    });
  }

  // Overview length issues (warning)
  if (!formatChecks.overviewLengths.passed) {
    formatChecks.overviewLengths.issues.forEach(({ location, wordCount, expected }) => {
      issues.push({
        category: 'format',
        severity: 'warning',
        location,
        issue: `Overview has ${wordCount} words (expected ${expected})`,
        evidence: `Word count: ${wordCount}`,
        suggestedFix: wordCount < 40
          ? 'Expand overview to provide more context'
          : 'Condense overview to be more focused',
      });
    });
  }

  return issues;
}
