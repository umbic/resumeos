// src/lib/v3/validators.ts
// ResumeOS V3 Output Validators

import type {
  AccumulatedState,
  ValidationResult,
  JDAnalyzerOutput,
  SummaryChatOutput,
  CHChatOutput,
  P1ChatOutput,
  P2ChatOutput,
  P3P6ChatOutput,
} from './types';

// ============ JD Analyzer Validator ============

export function validateJDOutput(output: unknown): ValidationResult {
  const issues: string[] = [];
  const data = output as Partial<JDAnalyzerOutput>;

  // Check metadata
  if (!data.metadata?.company) {
    issues.push('Missing company in metadata');
  }
  if (!data.metadata?.title) {
    issues.push('Missing title in metadata');
  }

  // Check sections
  if (!data.sections || data.sections.length === 0) {
    issues.push('No sections extracted');
  } else {
    for (const section of data.sections) {
      if (!section.keyPhrases || section.keyPhrases.length < 3) {
        issues.push(`Section "${section.name}" has fewer than 3 key phrases`);
      }
    }
  }

  // Check themes
  if (!data.themes || data.themes.length === 0) {
    issues.push('No themes identified');
  }

  // Check section mapping
  if (!data.sectionToResumeMapping || data.sectionToResumeMapping.length === 0) {
    issues.push('No section-to-resume mapping provided');
  }

  return {
    valid: issues.length === 0,
    issues,
    canRetry: true,
  };
}

// ============ Summary Validator ============

const FORBIDDEN_WORDS = [
  'leveraged',
  'utilized',
  'spearheaded',
  'synergy',
  'passionate',
  'passion',
  'dynamic',
  'results-driven',
  'self-starter',
  'team player',
];

export function validateSummaryOutput(output: unknown): ValidationResult {
  const issues: string[] = [];
  const data = output as Partial<SummaryChatOutput>;

  // Check word count (140-160)
  const wordCount = data.summary?.wordCount || 0;
  if (wordCount < 140 || wordCount > 160) {
    issues.push(`Summary word count ${wordCount} outside 140-160 range`);
  }

  // Check thematic anchors
  if (!data.thematicAnchors?.primaryNarrative) {
    issues.push('Missing primaryNarrative in thematicAnchors');
  }
  if (!data.thematicAnchors?.distinctiveValue) {
    issues.push('Missing distinctiveValue in thematicAnchors');
  }

  // Check JD mapping (at least 3 phrases)
  if (!data.jdMapping || data.jdMapping.length < 3) {
    issues.push('Summary must use at least 3 JD phrases');
  }

  // Check for forbidden words
  const content = (data.summary?.content || '').toLowerCase();
  for (const word of FORBIDDEN_WORDS) {
    if (content.includes(word)) {
      issues.push(`Forbidden word "${word}" in summary`);
    }
  }

  // Check for emdash
  if (data.summary?.content?.includes('—')) {
    issues.push('Summary contains emdash (—)');
  }

  // Check positioning decision
  if (!data.positioningDecision?.approach) {
    issues.push('Missing positioning decision approach');
  }

  // Check stateForDownstream
  if (!data.stateForDownstream) {
    issues.push('Missing stateForDownstream');
  }

  return {
    valid: issues.length === 0,
    issues,
    canRetry: true,
  };
}

// ============ CH Validator ============

export function validateCHOutput(
  output: unknown,
  state: AccumulatedState
): ValidationResult {
  const issues: string[] = [];
  const data = output as Partial<CHChatOutput>;

  // Check exactly 5 career highlights
  if (data.careerHighlights?.length !== 5) {
    issues.push(`Expected 5 career highlights, got ${data.careerHighlights?.length || 0}`);
  }

  const usedBaseIds = new Set<string>();
  const usedVerbs = new Set<string>();

  for (const ch of data.careerHighlights || []) {
    // Check for duplicate base IDs
    if (usedBaseIds.has(ch.baseId)) {
      issues.push(`Duplicate base ID: ${ch.baseId}`);
    }
    usedBaseIds.add(ch.baseId);

    // Check for duplicate verbs across CHs
    const verb = ch.primaryVerb?.toLowerCase();
    if (verb && usedVerbs.has(verb)) {
      issues.push(`Duplicate verb across CHs: ${ch.primaryVerb}`);
    }
    if (verb) usedVerbs.add(verb);

    // Check word count (35-50)
    if (ch.wordCount < 35 || ch.wordCount > 50) {
      issues.push(`CH ${ch.slot} word count ${ch.wordCount} outside 35-50 range`);
    }

    // Check JD mapping (at least 2)
    if (!ch.jdMapping || ch.jdMapping.length < 2) {
      issues.push(`CH ${ch.slot} must have at least 2 JD mappings`);
    }

    // Check headline exists
    if (!ch.headline) {
      issues.push(`CH ${ch.slot} missing headline`);
    }

    // Check content exists
    if (!ch.content) {
      issues.push(`CH ${ch.slot} missing content`);
    }
  }

  // Check coverage analysis exists
  if (!data.coverageAnalysis?.jdSectionsCovered) {
    issues.push('Missing coverage analysis');
  }

  // Check stateForDownstream
  if (!data.stateForDownstream) {
    issues.push('Missing stateForDownstream');
  }

  return {
    valid: issues.length === 0,
    issues,
    canRetry: issues.length <= 3,
  };
}

// ============ P1 Validator ============

export function validateP1Output(
  output: unknown,
  state: AccumulatedState
): ValidationResult {
  const issues: string[] = [];
  const data = output as Partial<P1ChatOutput>;

  // Check overview word count (40-60)
  const ovWordCount = data.overview?.wordCount || 0;
  if (ovWordCount < 40 || ovWordCount > 60) {
    issues.push(`P1 overview word count ${ovWordCount} outside 40-60 range`);
  }

  // Check overview has content
  if (!data.overview?.content) {
    issues.push('P1 overview missing content');
  }

  // Check exactly 4 bullets
  if (data.bullets?.length !== 4) {
    issues.push(`Expected 4 P1 bullets, got ${data.bullets?.length || 0}`);
  }

  const usedVerbs = new Set<string>();

  for (const bullet of data.bullets || []) {
    // Check word count (25-40)
    if (bullet.wordCount < 25 || bullet.wordCount > 40) {
      issues.push(`Bullet ${bullet.slot} word count ${bullet.wordCount} outside 25-40 range`);
    }

    // Check for banned base IDs
    if (state.allUsedBaseIds.includes(bullet.baseId)) {
      issues.push(`Bullet ${bullet.slot} uses banned base ID: ${bullet.baseId}`);
    }

    // Check for banned verbs
    const verbLower = bullet.primaryVerb?.toLowerCase();
    if (verbLower && state.allUsedVerbs.map((v) => v.toLowerCase()).includes(verbLower)) {
      issues.push(`Bullet ${bullet.slot} starts with banned verb: ${bullet.primaryVerb}`);
    }

    // Check for verb repetition within P1
    if (verbLower && usedVerbs.has(verbLower)) {
      issues.push(`Duplicate verb within P1: ${bullet.primaryVerb}`);
    }
    if (verbLower) usedVerbs.add(verbLower);

    // Check for banned metrics
    for (const metric of state.allUsedMetrics) {
      if (bullet.content?.includes(metric)) {
        issues.push(`Bullet ${bullet.slot} contains banned metric: ${metric}`);
      }
    }

    // Check JD mapping exists
    if (!bullet.jdMapping || bullet.jdMapping.length === 0) {
      issues.push(`Bullet ${bullet.slot} missing JD mapping`);
    }

    // Check content exists
    if (!bullet.content) {
      issues.push(`Bullet ${bullet.slot} missing content`);
    }
  }

  // Check coverage analysis
  if (!data.coverageAnalysis) {
    issues.push('Missing coverage analysis');
  }

  // Check stateForDownstream
  if (!data.stateForDownstream) {
    issues.push('Missing stateForDownstream');
  }

  return {
    valid: issues.length === 0,
    issues,
    canRetry: !issues.some((i) => i.includes('banned')),
  };
}

// ============ P2 Validator ============

export function validateP2Output(
  output: unknown,
  state: AccumulatedState
): ValidationResult {
  const issues: string[] = [];
  const data = output as Partial<P2ChatOutput>;

  // Check overview word count (40-60)
  const ovWordCount = data.overview?.wordCount || 0;
  if (ovWordCount < 40 || ovWordCount > 60) {
    issues.push(`P2 overview word count ${ovWordCount} outside 40-60 range`);
  }

  // Check overview has content
  if (!data.overview?.content) {
    issues.push('P2 overview missing content');
  }

  // Check exactly 3 bullets
  if (data.bullets?.length !== 3) {
    issues.push(`Expected 3 P2 bullets, got ${data.bullets?.length || 0}`);
  }

  const usedVerbs = new Set<string>();

  for (const bullet of data.bullets || []) {
    // Check word count (25-40)
    if (bullet.wordCount < 25 || bullet.wordCount > 40) {
      issues.push(`Bullet ${bullet.slot} word count ${bullet.wordCount} outside 25-40 range`);
    }

    // Check for banned base IDs
    if (state.allUsedBaseIds.includes(bullet.baseId)) {
      issues.push(`Bullet ${bullet.slot} uses banned base ID: ${bullet.baseId}`);
    }

    // Check for banned verbs
    const verbLower = bullet.primaryVerb?.toLowerCase();
    if (verbLower && state.allUsedVerbs.map((v) => v.toLowerCase()).includes(verbLower)) {
      issues.push(`Bullet ${bullet.slot} starts with banned verb: ${bullet.primaryVerb}`);
    }

    // Check for verb repetition within P2
    if (verbLower && usedVerbs.has(verbLower)) {
      issues.push(`Duplicate verb within P2: ${bullet.primaryVerb}`);
    }
    if (verbLower) usedVerbs.add(verbLower);

    // Check for banned metrics
    for (const metric of state.allUsedMetrics) {
      if (bullet.content?.includes(metric)) {
        issues.push(`Bullet ${bullet.slot} contains banned metric: ${metric}`);
      }
    }

    // Check patternProof field (required for P2)
    if (!bullet.patternProof) {
      issues.push(`Bullet ${bullet.slot} missing patternProof field`);
    }

    // Check JD mapping exists
    if (!bullet.jdMapping || bullet.jdMapping.length === 0) {
      issues.push(`Bullet ${bullet.slot} missing JD mapping`);
    }

    // Check content exists
    if (!bullet.content) {
      issues.push(`Bullet ${bullet.slot} missing content`);
    }
  }

  // Check coverage analysis
  if (!data.coverageAnalysis) {
    issues.push('Missing coverage analysis');
  }

  // Check stateForDownstream
  if (!data.stateForDownstream) {
    issues.push('Missing stateForDownstream');
  }

  return {
    valid: issues.length === 0,
    issues,
    canRetry: !issues.some((i) => i.includes('banned')),
  };
}

// ============ P3-P6 Validator ============

export function validateP3P6Output(
  output: unknown,
  state: AccumulatedState
): ValidationResult {
  const issues: string[] = [];
  const data = output as Partial<P3P6ChatOutput>;

  // Check exactly 4 overviews
  if (data.overviews?.length !== 4) {
    issues.push(`Expected 4 overviews, got ${data.overviews?.length || 0}`);
  }

  const usedVerbs = new Set<string>();

  for (const ov of data.overviews || []) {
    const verbLower = ov.startingVerb?.toLowerCase();

    // Check word count (20-40)
    if (ov.wordCount < 20 || ov.wordCount > 40) {
      issues.push(`Overview P${ov.position} word count ${ov.wordCount} outside 20-40 range`);
    }

    // Check for banned verbs from prior sections
    if (verbLower && state.allUsedVerbs.map((v) => v.toLowerCase()).includes(verbLower)) {
      issues.push(`Overview P${ov.position} starts with banned verb: ${ov.startingVerb}`);
    }

    // Check for verb repetition within P3-P6
    if (verbLower && usedVerbs.has(verbLower)) {
      issues.push(`Duplicate verb within P3-P6: ${ov.startingVerb}`);
    }
    if (verbLower) usedVerbs.add(verbLower);

    // Check content exists
    if (!ov.content) {
      issues.push(`Overview P${ov.position} missing content`);
    }

    // Check position is valid (3, 4, 5, or 6)
    if (![3, 4, 5, 6].includes(ov.position)) {
      issues.push(`Overview has invalid position: ${ov.position}`);
    }
  }

  // Check trajectoryNarrative exists
  if (!data.trajectoryNarrative) {
    issues.push('Missing trajectoryNarrative');
  }

  // Check verbsUsed array
  if (!data.verbsUsed || data.verbsUsed.length === 0) {
    issues.push('Missing verbsUsed array');
  }

  return {
    valid: issues.length === 0,
    issues,
    canRetry: true,
  };
}

// ============ Utility: Count Words ============

export function countWords(text: string): number {
  if (!text) return 0;
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

// ============ Utility: Validate Word Count ============

export function validateWordCount(
  text: string,
  min: number,
  max: number,
  label: string
): string | null {
  const count = countWords(text);
  if (count < min || count > max) {
    return `${label} word count ${count} outside ${min}-${max} range`;
  }
  return null;
}
