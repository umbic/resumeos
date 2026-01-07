// src/lib/v3/voice-guide.ts
// Voice and formatting rules for Umberto's resume

export const UMBERTO_VOICE_GUIDE = `
## VOICE & PERSONALITY

Write as a confident, senior executive who:
- States accomplishments directly without hedging
- Uses active voice and strong verbs
- Backs claims with specific metrics
- Shows strategic thinking, not just execution
- Has a clear point of view on brand/marketing

## FORBIDDEN WORDS

Never use: Leveraged, Utilized, Spearheaded, Synergy, Passionate, Dynamic,
Results-driven, Self-starter, Team player, Responsible for, Assisted with

## FORMATTING RULES

- No emdashes (—), use commas or periods instead
- No exclamation points
- Bold headlines for Career Highlights: **Headline**: Description
- Metrics should be specific: "$727M" not "significant revenue"
- Client names when source includes them

## WORD COUNT TARGETS

- Summary: 140-160 words
- Career Highlights: 35-50 words each
- P1/P2 Overview: 40-60 words
- P1/P2 Bullets: 25-40 words each
- P3-P6 Overview: 20-40 words
`;

export const UMBERTO_VOICE_GUIDE_CONDENSED = `
## VOICE: Confident executive. Active voice. Specific metrics. No hedging.

## FORBIDDEN: Leveraged, Utilized, Spearheaded, Synergy, Passionate, Dynamic,
Results-driven, Responsible for, emdashes (—), exclamation points

## FORMAT: Bold headlines (**Headline**: Description), specific metrics ($727M not "significant")
`;

// Forbidden words list for validation
export const FORBIDDEN_WORDS = [
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
  'responsible for',
  'assisted with',
];

// Word count ranges by section type
export const WORD_COUNT_RANGES = {
  summary: { min: 140, max: 160 },
  careerHighlight: { min: 35, max: 50 },
  p1Overview: { min: 40, max: 60 },
  p2Overview: { min: 40, max: 60 },
  p1Bullet: { min: 25, max: 40 },
  p2Bullet: { min: 25, max: 40 },
  p3p6Overview: { min: 20, max: 40 },
} as const;

// Strong action verbs to use
export const STRONG_VERBS = [
  'Architected',
  'Built',
  'Created',
  'Delivered',
  'Designed',
  'Developed',
  'Drove',
  'Established',
  'Expanded',
  'Generated',
  'Grew',
  'Launched',
  'Led',
  'Managed',
  'Orchestrated',
  'Pioneered',
  'Positioned',
  'Rebuilt',
  'Repositioned',
  'Scaled',
  'Shaped',
  'Transformed',
  'Unified',
];
