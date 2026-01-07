// src/lib/v3/prompts/p3p6-chat.ts
// Positions 3-6 generation prompt for V3 pipeline

import type {
  JDAnalyzerOutput,
  BulletSource,
  P3P6ChatOutput,
  ProfilePosition,
} from '../types';
import { UMBERTO_VOICE_GUIDE_CONDENSED } from '../voice-guide';

export function buildP3P6ChatPrompt(
  jdAnalysis: JDAnalyzerOutput,
  overviewSources: BulletSource[],
  positions: ProfilePosition[],
  allUsedVerbs: string[],
  previousIssues?: string[]
): string {
  // Format positions
  const positionsList = positions
    .map(
      (p, i) => `
### Position ${3 + i}
**Title**: ${p.title}
**Company**: ${p.company}
**Dates**: ${p.startDate} - ${p.endDate}
**Location**: ${p.location}
`
    )
    .join('\n');

  // Format overview options by position
  const overviewsByPosition = [3, 4, 5, 6].map((posNum) => {
    const posOverviews = overviewSources.filter(
      (ov) => ov.id.includes(`P${posNum}`) || ov.id.includes(`OV-P${posNum}`)
    );
    if (posOverviews.length === 0) {
      return `### Position ${posNum} Overview Options\nNo specific overviews available - write based on position info.`;
    }
    return `### Position ${posNum} Overview Options
${posOverviews.map((ov) => `- ${ov.id}: ${ov.content}`).join('\n')}`;
  });

  // Key themes for optional connection
  const themes = jdAnalysis.themes
    .filter((t) => t.priority === 'Critical' || t.priority === 'High')
    .map((t) => t.theme)
    .join(', ');

  // Previous issues block
  const issuesBlock = previousIssues?.length
    ? `
## PREVIOUS ATTEMPT ISSUES - FIX THESE

${previousIssues.map((i) => `- ${i}`).join('\n')}
`
    : '';

  return `You are writing Positions 3-6 (earlier career) for a senior executive's resume. These are overview-only entries that show career progression and trajectory.

## TARGET ROLE

**Company**: ${jdAnalysis.metadata.company}
**Title**: ${jdAnalysis.metadata.title}

## KEY JD THEMES (for optional connection)

${themes}

## POSITIONS TO WRITE

${positionsList}

## BANNED VERBS (Already Used in Resume)

DO NOT start any overview with these verbs:
${allUsedVerbs.join(', ')}

## AVAILABLE CONTENT

${overviewsByPosition.join('\n\n')}

${UMBERTO_VOICE_GUIDE_CONDENSED}
${issuesBlock}

## YOUR TASK

Write 4 brief overviews (20-40 words each) that:
1. Show career progression and trajectory
2. Use UNIQUE starting verbs (not used elsewhere in resume)
3. Connect to JD themes where natural (not forced)
4. Demonstrate growth from early career to senior roles

## OUTPUT FORMAT

Return ONLY valid JSON:

\`\`\`json
{
  "overviews": [
    {
      "position": 3,
      "sourceId": "OV-P3-01",
      "content": "20-40 word overview showing role scope and relevance...",
      "wordCount": 28,
      "startingVerb": "Promoted",
      "jdRelevance": {
        "relevant": true,
        "connection": "How this role connects to JD themes",
        "phraseUsed": "JD phrase used or null"
      }
    },
    {
      "position": 4,
      "sourceId": "OV-P4-01",
      "content": "20-40 word overview...",
      "wordCount": 25,
      "startingVerb": "Recruited",
      "jdRelevance": {
        "relevant": false,
        "connection": null,
        "phraseUsed": null
      }
    },
    {
      "position": 5,
      "sourceId": "OV-P5-01",
      "content": "20-40 word overview...",
      "wordCount": 22,
      "startingVerb": "Developed",
      "jdRelevance": {
        "relevant": false,
        "connection": null,
        "phraseUsed": null
      }
    },
    {
      "position": 6,
      "sourceId": "OV-P6-01",
      "content": "20-40 word overview...",
      "wordCount": 24,
      "startingVerb": "Supported",
      "jdRelevance": {
        "relevant": false,
        "connection": null,
        "phraseUsed": null
      }
    }
  ],
  "verbsUsed": ["Promoted", "Recruited", "Developed", "Supported"],
  "trajectoryNarrative": "Brief description of the career progression story these overviews tell"
}
\`\`\`

## CRITICAL REQUIREMENTS

1. **Exactly 4 overviews** - One for each position (3, 4, 5, 6)
2. **Word count: 20-40 words each** - Count carefully
3. **NO BANNED VERBS** - Never start with: ${allUsedVerbs.join(', ')}
4. **Unique verbs within P3-P6** - Each overview starts with DIFFERENT verb
5. **Position numbers must be 3, 4, 5, 6** - In that order
6. **JD connection optional** - Only connect if natural, don't force it
7. **Show progression** - Earlier roles should feel like building blocks
8. **No forbidden words** - Never use: leveraged, utilized, spearheaded, synergy
9. **No emdashes** - Use commas or periods instead of —

## SUGGESTED CAREER VERBS (not yet used)

Consider using verbs that show career growth:
- Promoted, Recruited, Selected, Appointed (show advancement)
- Developed, Established, Built, Created (show building)
- Managed, Directed, Oversaw, Led (show leadership)
- Supported, Contributed, Assisted (for earlier roles)

Return ONLY the JSON object. No markdown, no explanations.`;
}

// Type guard
export function isValidP3P6ChatOutput(data: unknown): data is P3P6ChatOutput {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.overviews)) return false;
  if (obj.overviews.length !== 4) return false;
  if (!Array.isArray(obj.verbsUsed)) return false;
  if (typeof obj.trajectoryNarrative !== 'string') return false;

  // Check positions are 3, 4, 5, 6
  const positions = (obj.overviews as Array<{ position: number }>).map((o) => o.position);
  if (!positions.includes(3) || !positions.includes(4) || !positions.includes(5) || !positions.includes(6)) {
    return false;
  }

  return true;
}

// Parse response
export function parseP3P6ChatResponse(response: string): P3P6ChatOutput {
  const cleaned = response
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  const parsed = JSON.parse(cleaned);

  if (!isValidP3P6ChatOutput(parsed)) {
    throw new Error('Invalid P3-P6 chat output structure');
  }

  return parsed as P3P6ChatOutput;
}
