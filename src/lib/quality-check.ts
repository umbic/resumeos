import type { GeneratedResume, QualityScore, QualityIssue, ATSKeyword } from '@/types';
import { calculateActualKeywordCoverage } from './gap-detection';

// Common action verbs to track
const ACTION_VERBS = [
  'led', 'built', 'drove', 'developed', 'created', 'designed', 'launched',
  'transformed', 'architected', 'pioneered', 'established', 'delivered',
  'scaled', 'accelerated', 'managed', 'directed', 'orchestrated', 'spearheaded',
  'implemented', 'executed', 'negotiated', 'cultivated', 'optimized'
];

// Jargon patterns to flag
const JARGON_PATTERNS = [
  /B2B\s+\w+\s+partner/i,
  /enterprise\s+\w+\s+platform\s+\w+/i,
  /\w+\s+technology\s+\w+\s+brand/i,
  /strategic\s+\w+\s+\w+\s+initiative/i,
];

/**
 * Run quality checks on a generated resume.
 * Returns a QualityScore with grade, coverage metrics, and issues.
 * @param resume - The generated resume to check
 * @param atsKeywords - Optional ATS keywords for accurate coverage calculation
 */
export function runQualityCheck(
  resume: GeneratedResume,
  atsKeywords?: ATSKeyword[]
): QualityScore {
  const issues: QualityIssue[] = [];

  // Check summary
  issues.push(...checkSummary(resume.summary));

  // Check career highlights
  resume.career_highlights.forEach((highlight, index) => {
    issues.push(...checkHighlight(highlight, index + 1));
  });

  // Check positions
  resume.positions.forEach(position => {
    issues.push(...checkOverview(position.overview, position.number));

    position.bullets?.forEach((bullet, index) => {
      issues.push(...checkBullet(bullet, position.number, index + 1));
    });
  });

  // Check verb repetition across resume
  issues.push(...checkVerbRepetition(resume));

  // Check phrase repetition across resume
  issues.push(...checkPhraseRepetition(resume));

  // Calculate scores
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  // Use actual keyword coverage if ATS keywords provided
  const keywordCoverage = atsKeywords
    ? calculateActualKeywordCoverage(atsKeywords, resume)
    : calculateKeywordCoverage(resume);

  const themeAlignment = calculateThemeAlignment(resume);

  // Calculate grade with keyword coverage cap
  const overall = calculateGrade(errorCount, warningCount, keywordCoverage);

  return {
    overall,
    keyword_coverage: keywordCoverage,
    theme_alignment: themeAlignment,
    issues,
  };
}

function checkSummary(summary: string): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // Safety check: ensure summary is a string
  const summaryText = typeof summary === 'string' ? summary : String(summary || '');

  // Check sentence count (should be 3-4)
  const sentences = summaryText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 5) {
    issues.push({
      type: 'bullet_length',
      severity: 'warning',
      location: 'summary',
      message: `Summary has ${sentences.length} sentences (target: 3-4)`,
    });
  }

  // Check for jargon
  issues.push(...checkJargon(summaryText, 'summary'));

  return issues;
}

function checkHighlight(highlight: string, index: number): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const location = `highlight_${index}`;

  // Safety check: ensure highlight is a string
  const highlightText = typeof highlight === 'string' ? highlight : String(highlight || '');

  // Check word count
  const wordCount = highlightText.split(/\s+/).length;
  if (wordCount > 50) {
    issues.push({
      type: 'bullet_length',
      severity: 'warning',
      location,
      message: `Highlight ${index} has ${wordCount} words (consider trimming)`,
    });
  }

  // Check for jargon
  issues.push(...checkJargon(highlightText, location));

  return issues;
}

function checkOverview(overview: string, positionNumber: number): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const location = `position_${positionNumber}_overview`;

  // Safety check: ensure overview is a string
  const overviewText = typeof overview === 'string' ? overview : String(overview || '');

  // Check for jargon
  issues.push(...checkJargon(overviewText, location));

  return issues;
}

function checkBullet(
  bullet: string,
  positionNumber: number,
  bulletNumber: number
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const location = `position_${positionNumber}_bullet_${bulletNumber}`;

  // Safety check: ensure bullet is a string
  const bulletText = typeof bullet === 'string' ? bullet : String(bullet || '');

  // Check word count (HARD LIMIT: 40)
  const wordCount = bulletText.split(/\s+/).length;
  if (wordCount > 40) {
    issues.push({
      type: 'bullet_length',
      severity: 'error',
      location,
      message: `Bullet has ${wordCount} words (limit: 40)`,
    });
  } else if (wordCount > 35) {
    issues.push({
      type: 'bullet_length',
      severity: 'warning',
      location,
      message: `Bullet has ${wordCount} words (approaching limit)`,
    });
  }

  // Check for jargon
  issues.push(...checkJargon(bulletText, location));

  return issues;
}

function checkJargon(text: string, location: string): QualityIssue[] {
  const issues: QualityIssue[] = [];

  for (const pattern of JARGON_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      issues.push({
        type: 'jargon',
        severity: 'warning',
        location,
        message: `Jargon detected: "${match[0]}"`,
      });
    }
  }

  return issues;
}

function checkVerbRepetition(resume: GeneratedResume): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const verbUsage: Record<string, string[]> = {};

  // Extract all text sections
  const sections = [
    { text: resume.summary, location: 'summary' },
    ...resume.career_highlights.map((h, i) => ({
      text: h,
      location: `highlight_${i + 1}`
    })),
    ...resume.positions.flatMap(p => [
      { text: p.overview, location: `position_${p.number}_overview` },
      ...(p.bullets || []).map((b, i) => ({
        text: b,
        location: `position_${p.number}_bullet_${i + 1}`
      })),
    ]),
  ];

  // Track verb usage
  for (const { text, location } of sections) {
    // Safety check: ensure text is a string
    const textStr = typeof text === 'string' ? text : String(text || '');
    const words = textStr.toLowerCase().split(/\s+/);
    const firstWord = words[0]?.replace(/[^a-z]/g, '');

    for (const verb of ACTION_VERBS) {
      if (firstWord === verb || textStr.toLowerCase().includes(` ${verb} `)) {
        if (!verbUsage[verb]) {
          verbUsage[verb] = [];
        }
        verbUsage[verb].push(location);
      }
    }
  }

  // Check for violations
  for (const [verb, locations] of Object.entries(verbUsage)) {
    // Check within-position repetition
    const positionGroups: Record<string, string[]> = {};
    for (const loc of locations) {
      const posMatch = loc.match(/position_(\d+)/);
      if (posMatch) {
        const posKey = `position_${posMatch[1]}`;
        if (!positionGroups[posKey]) {
          positionGroups[posKey] = [];
        }
        positionGroups[posKey].push(loc);
      }
    }

    for (const [position, locs] of Object.entries(positionGroups)) {
      if (locs.length > 1) {
        issues.push({
          type: 'verb_repetition',
          severity: 'error',
          location: position,
          message: `"${verb}" used ${locs.length}x within same position: ${locs.join(', ')}`,
        });
      }
    }

    // Check resume-wide repetition (>2x)
    if (locations.length > 2) {
      issues.push({
        type: 'verb_repetition',
        severity: 'warning',
        location: 'resume',
        message: `"${verb}" used ${locations.length}x total (max: 2): ${locations.join(', ')}`,
      });
    }
  }

  return issues;
}

function checkPhraseRepetition(resume: GeneratedResume): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // Common phrases to track
  const phrasesToTrack = [
    'strategic storytelling',
    'executive narratives',
    'gtm alignment',
    'go-to-market',
    'cross-functional',
    'brand transformation',
    'enterprise buyer',
    'measurable impact',
    'business value',
  ];

  // Combine all text (ensure all items are strings)
  const toStr = (val: unknown): string => typeof val === 'string' ? val : String(val || '');
  const allText = [
    toStr(resume.summary),
    ...resume.career_highlights.map(toStr),
    ...resume.positions.flatMap(p => [
      toStr(p.overview),
      ...(p.bullets || []).map(toStr),
    ]),
  ].join(' ').toLowerCase();

  for (const phrase of phrasesToTrack) {
    const regex = new RegExp(phrase, 'gi');
    const matches = allText.match(regex);

    if (matches && matches.length > 2) {
      issues.push({
        type: 'phrase_repetition',
        severity: 'warning',
        location: 'resume',
        message: `"${phrase}" used ${matches.length}x (max: 2)`,
      });
    }
  }

  return issues;
}

function calculateGrade(
  errors: number,
  warnings: number,
  keywordCoverage: number = 100
): QualityScore['overall'] {
  // Calculate base grade from errors/warnings
  let baseGrade: QualityScore['overall'];
  if (errors === 0 && warnings === 0) baseGrade = 'A';
  else if (errors === 0 && warnings <= 2) baseGrade = 'A';
  else if (errors === 0 && warnings <= 4) baseGrade = 'B';
  else if (errors <= 1 && warnings <= 4) baseGrade = 'B';
  else if (errors <= 2 && warnings <= 6) baseGrade = 'C';
  else if (errors <= 4) baseGrade = 'D';
  else baseGrade = 'F';

  // Cap grade based on keyword coverage
  // If keyword coverage < 30%, cap at 'D'
  // If keyword coverage < 50%, cap at 'C'
  // If keyword coverage < 70%, cap at 'B'
  const gradeOrder: QualityScore['overall'][] = ['A', 'B', 'C', 'D', 'F'];
  let maxGrade: QualityScore['overall'] = 'A';

  if (keywordCoverage < 30) {
    maxGrade = 'D';
  } else if (keywordCoverage < 50) {
    maxGrade = 'C';
  } else if (keywordCoverage < 70) {
    maxGrade = 'B';
  }

  // Return the worse of baseGrade or maxGrade
  const baseIndex = gradeOrder.indexOf(baseGrade);
  const maxIndex = gradeOrder.indexOf(maxGrade);
  return gradeOrder[Math.max(baseIndex, maxIndex)];
}

function calculateKeywordCoverage(resume: GeneratedResume): number {
  const addressed = resume.themes_addressed?.length || 0;
  const total = addressed + (resume.themes_not_addressed?.length || 0);

  if (total === 0) return 100;
  return Math.round((addressed / total) * 100);
}

function calculateThemeAlignment(resume: GeneratedResume): number {
  const addressed = resume.themes_addressed?.length || 0;
  const notAddressed = resume.themes_not_addressed?.length || 0;
  const total = addressed + notAddressed;

  if (total === 0) return 100;
  return Math.round((addressed / total) * 100);
}
