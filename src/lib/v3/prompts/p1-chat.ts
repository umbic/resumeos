// src/lib/v3/prompts/p1-chat.ts
// Position 1 generation prompt for V3 pipeline

import type {
  JDAnalyzerOutput,
  BulletSource,
  SummaryChatOutput,
  CHChatOutput,
  P1ChatOutput,
  ProfilePosition,
} from '../types';
import { UMBERTO_VOICE_GUIDE_CONDENSED } from '../voice-guide';

export function buildP1ChatPrompt(
  jdAnalysis: JDAnalyzerOutput,
  p1Sources: BulletSource[],
  position: ProfilePosition,
  summaryOutput: SummaryChatOutput,
  chOutput: CHChatOutput,
  previousIssues?: string[]
): string {
  // Separate overviews from bullets
  const overviewSources = p1Sources.filter((s) => s.type === 'overview');
  const bulletSources = p1Sources.filter((s) => s.type === 'bullet');

  // Format overview options
  const overviewOptions = overviewSources
    .map(
      (ov) => `
### ${ov.id}${ov.variantLabel ? ` - ${ov.variantLabel}` : ''}
**Tags**: ${ov.tags.theme.join(', ')}
${ov.content}
`
    )
    .join('\n');

  // Format bullet options
  const bulletOptions = bulletSources
    .map(
      (b) => `
### ${b.id} (Base: ${b.baseId})${b.variantLabel ? ` - ${b.variantLabel}` : ''}
**Tags**: Industry: ${b.tags.industry.join(', ')} | Function: ${b.tags.function.join(', ')} | Theme: ${b.tags.theme.join(', ')}
${b.content}
`
    )
    .join('\n');

  // Banned items from upstream
  const bannedBaseIds = chOutput.stateForDownstream.usedBaseIds;
  const bannedVerbs = [
    ...summaryOutput.stateForDownstream.usedVerbs,
    ...chOutput.stateForDownstream.usedVerbs,
  ];
  const bannedMetrics = [
    ...summaryOutput.stateForDownstream.usedMetrics,
    ...chOutput.stateForDownstream.usedMetrics,
  ];

  // Gaps to address
  const gaps = chOutput.coverageAnalysis.gapsRemaining
    .map((g) => `- ${g.gap} [${g.severity}]: ${g.notes}`)
    .join('\n');

  // JD phrases not yet used
  const usedPhrases = new Set([
    ...summaryOutput.stateForDownstream.jdPhrasesUsed,
    ...chOutput.careerHighlights.flatMap((ch) => ch.jdMapping.map((m) => m.phraseUsed)),
  ]);

  const unusedHighPhrases = jdAnalysis.sections
    .flatMap((s) => s.keyPhrases.filter((p) => p.weight === 'HIGH'))
    .filter((p) => !usedPhrases.has(p.phrase))
    .map((p) => `- "${p.phrase}"`)
    .join('\n');

  // Previous issues block
  const issuesBlock = previousIssues?.length
    ? `
## PREVIOUS ATTEMPT ISSUES - FIX THESE

${previousIssues.map((i) => `- ${i}`).join('\n')}
`
    : '';

  return `You are writing Position 1 (current/most recent role) for a senior executive's resume. This section provides detailed proof of the capabilities highlighted in the Summary and Career Highlights.

## TARGET ROLE

**Company**: ${jdAnalysis.metadata.company}
**Title**: ${jdAnalysis.metadata.title}
**Industry**: ${jdAnalysis.metadata.industry}

## POSITION TO WRITE

**Title**: ${position.title}
**Company**: ${position.company}
**Dates**: ${position.startDate} - ${position.endDate}
**Location**: ${position.location}

## GAPS TO ADDRESS

The Career Highlights left these gaps. P1 bullets should address them:
${gaps || 'No significant gaps identified'}

## UNUSED HIGH-PRIORITY JD PHRASES

These HIGH-weight phrases haven't been used yet. Incorporate where natural:
${unusedHighPhrases || 'All high-priority phrases have been used'}

## ⛔ BANNED ITEMS - CRITICAL: DO NOT USE

### Banned Base IDs (already in Career Highlights):
${bannedBaseIds.length > 0 ? bannedBaseIds.map(id => `- ❌ ${id}`).join('\n') : '(none)'}

### Banned Starting Verbs (already used in Summary/CH):
${bannedVerbs.length > 0 ? bannedVerbs.map(v => `- ❌ ${v}`).join('\n') : '(none)'}

### ⚠️ BANNED METRICS - NEVER REPEAT THESE NUMBERS:
${bannedMetrics.length > 0 ? bannedMetrics.map(m => `- ❌ "${m}" - DO NOT USE THIS METRIC`).join('\n') : '(none)'}

**If a source bullet contains a banned metric, you MUST rewrite it with a DIFFERENT metric or remove the metric entirely.**

## AVAILABLE CONTENT

### Overview Options
${overviewOptions}

### Bullet Options
${bulletOptions}

${UMBERTO_VOICE_GUIDE_CONDENSED}
${issuesBlock}

## YOUR TASK

1. **Write 1 Overview** - 40-60 words, sets context for the role
2. **Write 4 Bullets** - 25-40 words each, specific achievements with metrics
3. **Address gaps** - Prioritize bullets that fill coverage gaps
4. **Map to JD** - Show which JD phrases each element addresses

## OUTPUT FORMAT

Return ONLY valid JSON:

\`\`\`json
{
  "overview": {
    "sourceId": "OV-P1-V3",
    "content": "40-60 word overview of the role...",
    "wordCount": 52,
    "jdMapping": [
      {
        "phraseUsed": "phrase in overview",
        "jdSection": "Overview",
        "jdPhraseSource": "original JD phrase",
        "exactQuote": true
      }
    ]
  },
  "bullets": [
    {
      "slot": "p1-bullet-1",
      "sourceId": "P1-B03-V2",
      "baseId": "P1-B03",
      "content": "25-40 word achievement with specific metric...",
      "wordCount": 32,
      "primaryVerb": "Created",
      "jdMapping": [
        {
          "phraseUsed": "phrase in bullet",
          "jdSection": "Requirements",
          "jdPhraseSource": "original JD phrase",
          "exactQuote": true
        }
      ],
      "gapAddressed": "Which gap this bullet addresses or null",
      "selectionRationale": "Why this bullet was chosen"
    }
  ],
  "coverageAnalysis": {
    "jdSectionsAddressed": [
      {
        "section": "Requirements",
        "strength": "Strong",
        "coveredBy": ["p1-bullet-1", "p1-bullet-3"]
      }
    ],
    "gapsRemaining": [
      {
        "gap": "Any remaining gaps",
        "severity": "Low",
        "notes": "Can be addressed in P2"
      }
    ],
    "phrasesCovered": ["list", "of", "JD", "phrases", "used"]
  },
  "stateForDownstream": {
    "usedBaseIds": ["P1-B03", "P1-B05", "P1-B07", "P1-B09"],
    "usedVerbs": ["Created", "Drove", "Scaled", "Built"],
    "usedMetrics": ["9% acquisition", "43% leads"],
    "jdSectionsCoveredByP1": ["Requirements", "Qualifications"]
  }
}
\`\`\`

## CRITICAL REQUIREMENTS

1. **1 overview + 4 bullets** - Exactly this structure
2. **Overview: 40-60 words** - Count carefully
3. **Bullets: 25-40 words each** - Count carefully
4. **NO BANNED BASE IDs** - Never use: ${bannedBaseIds.join(', ')}
5. **NO BANNED VERBS** - Never start with: ${bannedVerbs.join(', ')}
6. **NO BANNED METRICS** - Never repeat: ${bannedMetrics.join(', ') || 'None'}
7. **Unique verbs within P1** - Each bullet starts with different verb
8. **At least 1 JD mapping per element** - Show JD connection
9. **No forbidden words** - Never use: leveraged, utilized, spearheaded, synergy
10. **No emdashes** - Use commas or periods instead of —

Return ONLY the JSON object. No markdown, no explanations.`;
}

// Type guard
export function isValidP1ChatOutput(data: unknown): data is P1ChatOutput {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  if (!obj.overview || typeof obj.overview !== 'object') return false;
  if (!Array.isArray(obj.bullets)) return false;
  if (obj.bullets.length !== 4) return false;
  if (!obj.coverageAnalysis || typeof obj.coverageAnalysis !== 'object') return false;
  if (!obj.stateForDownstream || typeof obj.stateForDownstream !== 'object') return false;

  return true;
}

// Parse response
export function parseP1ChatResponse(response: string): P1ChatOutput {
  const cleaned = response
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  const parsed = JSON.parse(cleaned);

  if (!isValidP1ChatOutput(parsed)) {
    throw new Error('Invalid P1 chat output structure');
  }

  return parsed as P1ChatOutput;
}
