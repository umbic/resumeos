// src/lib/v3/prompts/p2-chat.ts
// Position 2 generation prompt for V3 pipeline

import type {
  JDAnalyzerOutput,
  BulletSource,
  SummaryChatOutput,
  CHChatOutput,
  P1ChatOutput,
  P2ChatOutput,
  ProfilePosition,
} from '../types';
import { UMBERTO_VOICE_GUIDE_CONDENSED } from '../voice-guide';

export function buildP2ChatPrompt(
  jdAnalysis: JDAnalyzerOutput,
  p2Sources: BulletSource[],
  position: ProfilePosition,
  summaryOutput: SummaryChatOutput,
  chOutput: CHChatOutput,
  p1Output: P1ChatOutput,
  previousIssues?: string[]
): string {
  // Separate overviews from bullets
  const overviewSources = p2Sources.filter((s) => s.type === 'overview');
  const bulletSources = p2Sources.filter((s) => s.type === 'bullet');

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

  // Aggregate ALL banned items from upstream
  const bannedBaseIds = [
    ...chOutput.stateForDownstream.usedBaseIds,
    ...p1Output.stateForDownstream.usedBaseIds,
  ];
  const bannedVerbs = [
    ...summaryOutput.stateForDownstream.usedVerbs,
    ...chOutput.stateForDownstream.usedVerbs,
    ...p1Output.stateForDownstream.usedVerbs,
  ];
  const bannedMetrics = [
    ...summaryOutput.stateForDownstream.usedMetrics,
    ...chOutput.stateForDownstream.usedMetrics,
    ...p1Output.stateForDownstream.usedMetrics,
  ];

  // Gaps remaining after P1
  const gaps = p1Output.coverageAnalysis.gapsRemaining
    .map((g) => `- ${g.gap} [${g.severity}]: ${g.notes}`)
    .join('\n');

  // Calculate unused HIGH phrases
  const usedPhrases = new Set([
    ...summaryOutput.stateForDownstream.jdPhrasesUsed,
    ...chOutput.careerHighlights.flatMap((ch) => ch.jdMapping.map((m) => m.phraseUsed)),
    ...p1Output.coverageAnalysis.phrasesCovered,
  ]);

  const unusedHighPhrases = jdAnalysis.sections
    .flatMap((s) => s.keyPhrases.filter((p) => p.weight === 'HIGH'))
    .filter((p) => !usedPhrases.has(p.phrase))
    .map((p) => `- "${p.phrase}"`)
    .join('\n');

  // P1 achievements for pattern proof reference
  const p1Achievements = p1Output.bullets
    .map((b) => `- ${b.slot}: ${b.content.substring(0, 60)}...`)
    .join('\n');

  // Previous issues block
  const issuesBlock = previousIssues?.length
    ? `
## PREVIOUS ATTEMPT ISSUES - FIX THESE

${previousIssues.map((i) => `- ${i}`).join('\n')}
`
    : '';

  return `You are writing Position 2 (previous role) for a senior executive's resume. This section proves that the capabilities shown in P1 are a PATTERN, not a one-time achievement.

## TARGET ROLE

**Company**: ${jdAnalysis.metadata.company}
**Title**: ${jdAnalysis.metadata.title}
**Industry**: ${jdAnalysis.metadata.industry}

## POSITION TO WRITE

**Title**: ${position.title}
**Company**: ${position.company}
**Dates**: ${position.startDate} - ${position.endDate}
**Location**: ${position.location}

## P2'S SPECIAL PURPOSE: PROVE THE PATTERN

P1 showed recent achievements. P2 must show EARLIER evidence of the same capabilities. For each bullet, explain how it proves this is a consistent pattern, not a one-off.

### P1 Achievements (for reference)
${p1Achievements}

## GAPS TO ADDRESS

These gaps remain after P1:
${gaps || 'No significant gaps remaining'}

## UNUSED HIGH-PRIORITY JD PHRASES

These HIGH-weight phrases haven't been used. Last chance to incorporate:
${unusedHighPhrases || 'All high-priority phrases have been used'}

## BANNED ITEMS (Already Used in Resume)

**DO NOT USE these base IDs**:
${bannedBaseIds.join(', ')}

**DO NOT START bullets with these verbs**:
${bannedVerbs.join(', ')}

**DO NOT REPEAT these metrics**:
${bannedMetrics.join(', ') || 'None'}

## AVAILABLE CONTENT

### Overview Options
${overviewOptions}

### Bullet Options
${bulletOptions}

${UMBERTO_VOICE_GUIDE_CONDENSED}
${issuesBlock}

## YOUR TASK

1. **Write 1 Overview** - 40-60 words
2. **Write 3 Bullets** - 25-40 words each with patternProof field
3. **Prove patterns** - Each bullet's patternProof explains how it shows earlier evidence
4. **Final coverage** - Report final JD coverage and any remaining gaps

## OUTPUT FORMAT

Return ONLY valid JSON:

\`\`\`json
{
  "overview": {
    "sourceId": "OV-P2-V2",
    "content": "40-60 word overview...",
    "wordCount": 48,
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
      "slot": "p2-bullet-1",
      "sourceId": "P2-B04-V1",
      "baseId": "P2-B04",
      "content": "25-40 word achievement...",
      "wordCount": 35,
      "primaryVerb": "Repositioned",
      "jdMapping": [
        {
          "phraseUsed": "phrase in bullet",
          "jdSection": "Requirements",
          "jdPhraseSource": "original JD phrase",
          "exactQuote": true
        }
      ],
      "gapAddressed": "Gap this addresses or null",
      "patternProof": "How this proves earlier evidence of capability shown in P1",
      "selectionRationale": "Why this bullet was chosen"
    }
  ],
  "coverageAnalysis": {
    "finalCoverage": [
      {
        "section": "Key Responsibilities",
        "strength": "Strong",
        "coveredBy": ["ch-1", "p1-bullet-2", "p2-bullet-1"]
      }
    ],
    "remainingGaps": [
      {
        "gap": "Any gaps that couldn't be addressed",
        "severity": "Low",
        "notes": "Explanation"
      }
    ],
    "unusedHighPhrases": ["any HIGH phrases not incorporated"]
  },
  "stateForDownstream": {
    "usedBaseIds": ["P2-B04", "P2-B06", "P2-B08"],
    "usedVerbs": ["Repositioned", "Developed", "Established"],
    "allVerbsUsedInResume": ["Built", "Transformed", "Created", "Repositioned", "Developed", "Established"]
  }
}
\`\`\`

## CRITICAL REQUIREMENTS

1. **1 overview + 3 bullets** - Exactly this structure
2. **Overview: 40-60 words** - Count carefully
⚠️ 3. **Bullets: EXACTLY 25-40 words each** - Count EVERY word. Bullets under 25 words WILL BE REJECTED! Target 30-35 words per bullet.
4. **patternProof REQUIRED** - Each bullet must explain how it proves a pattern
5. **NO BANNED BASE IDs** - Never use: ${bannedBaseIds.join(', ')}
6. **NO BANNED VERBS** - Never start with: ${bannedVerbs.join(', ')}
7. **NO BANNED METRICS** - Never repeat: ${bannedMetrics.join(', ') || 'None'}
8. **Unique verbs within P2** - Each bullet starts with different verb
9. **Final coverage report** - Show complete JD coverage analysis
10. **No forbidden words** - Never use: leveraged, utilized, spearheaded, synergy
11. **No emdashes** - Use commas or periods instead of —

⚠️ WORD COUNT CHECK: Each P2 bullet MUST have at least 25 words. Count carefully before returning!

Return ONLY the JSON object. No markdown, no explanations.`;
}

// Type guard
export function isValidP2ChatOutput(data: unknown): data is P2ChatOutput {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  if (!obj.overview || typeof obj.overview !== 'object') return false;
  if (!Array.isArray(obj.bullets)) return false;
  if (obj.bullets.length !== 3) return false;
  if (!obj.coverageAnalysis || typeof obj.coverageAnalysis !== 'object') return false;
  if (!obj.stateForDownstream || typeof obj.stateForDownstream !== 'object') return false;

  // Check patternProof on bullets
  for (const bullet of obj.bullets as Array<Record<string, unknown>>) {
    if (typeof bullet.patternProof !== 'string') return false;
  }

  return true;
}

// Parse response
export function parseP2ChatResponse(response: string): P2ChatOutput {
  const cleaned = response
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  const parsed = JSON.parse(cleaned);

  if (!isValidP2ChatOutput(parsed)) {
    throw new Error('Invalid P2 chat output structure');
  }

  return parsed as P2ChatOutput;
}
