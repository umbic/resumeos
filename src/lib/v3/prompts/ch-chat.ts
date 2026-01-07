// src/lib/v3/prompts/ch-chat.ts
// Career Highlights generation prompt for V3 pipeline

import type {
  JDAnalyzerOutput,
  CHSource,
  SummaryChatOutput,
  CHChatOutput,
} from '../types';
import { UMBERTO_VOICE_GUIDE_CONDENSED } from '../voice-guide';

export function buildCHChatPrompt(
  jdAnalysis: JDAnalyzerOutput,
  chSources: CHSource[],
  summaryOutput: SummaryChatOutput,
  previousIssues?: string[]
): string {
  // Format CH sources
  const chOptions = chSources
    .map(
      (ch) => `
### ${ch.id} (Base: ${ch.baseId})${ch.variantLabel ? ` - ${ch.variantLabel}` : ''}
**Tags**: Industry: ${ch.tags.industry.join(', ')} | Function: ${ch.tags.function.join(', ')} | Theme: ${ch.tags.theme.join(', ')}
**Content**:
${ch.content}
`
    )
    .join('\n');

  // Format JD sections with HIGH phrases
  const highPhrases = jdAnalysis.sections
    .flatMap((s) =>
      s.keyPhrases
        .filter((p) => p.weight === 'HIGH')
        .map((p) => `- "${p.phrase}" [${s.name}]`)
    )
    .join('\n');

  // Format themes
  const themes = jdAnalysis.themes
    .map((t) => `- **${t.theme}** [${t.priority}]`)
    .join('\n');

  // Format thematic anchors from summary
  const anchors = summaryOutput.thematicAnchors;

  // Previous issues block
  const issuesBlock = previousIssues?.length
    ? `
## PREVIOUS ATTEMPT ISSUES - FIX THESE

${previousIssues.map((i) => `- ${i}`).join('\n')}
`
    : '';

  return `You are selecting and writing 5 Career Highlights for a senior executive's resume. These highlights are the "proof points" that support the Summary's positioning.

## TARGET ROLE

**Company**: ${jdAnalysis.metadata.company}
**Title**: ${jdAnalysis.metadata.title}
**Industry**: ${jdAnalysis.metadata.industry}

## JD THEMES TO ADDRESS

${themes}

## HIGH-PRIORITY JD PHRASES

These phrases should appear in your highlights where natural:
${highPhrases}

## THEMATIC ANCHORS FROM SUMMARY

The Summary established these anchors. Your highlights should REINFORCE the narrative without REPEATING specific metrics/phrases.

**Primary Narrative**: ${anchors.primaryNarrative}
**Distinctive Value**: ${anchors.distinctiveValue}

**DO NOT REPEAT these from the summary**:
- Metrics: ${anchors.doNotRepeat.metrics.join(', ') || 'None'}
- Clients: ${anchors.doNotRepeat.clients.join(', ') || 'None'}
- Phrases: ${anchors.doNotRepeat.phrases.join(', ') || 'None'}

**REINFORCE these themes**:
- Beliefs: ${anchors.reinforce.beliefs.join(', ')}
- Capabilities: ${anchors.reinforce.capabilities.join(', ')}

## AVAILABLE CAREER HIGHLIGHT SOURCES

Select 5 highlights from these options. Each base ID can only be used ONCE. Choose the variant that best matches the JD themes.

${chOptions}

${UMBERTO_VOICE_GUIDE_CONDENSED}
${issuesBlock}

## YOUR TASK

1. **Select 5 Career Highlights** - Choose the best 5 base items and their optimal variants
2. **Write each highlight** - Format: **Bold Headline**: [35-50 word achievement narrative]
   - The headline is SHORT (2-4 words)
   - The content AFTER the colon must be 35-50 words
   - DO NOT count the headline in the word count
   - Example: "**Digital Transformation**: [35-50 words of content here...]"
3. **Map to JD** - Show exactly which JD phrases each highlight addresses
4. **Track coverage** - Which JD sections are now addressed vs still have gaps

⚠️ WORD COUNT CRITICAL: Each highlight's content (AFTER the colon) must be 35-50 words. Count carefully!

## OUTPUT FORMAT

Return ONLY valid JSON:

\`\`\`json
{
  "careerHighlights": [
    {
      "slot": "ch-1",
      "sourceId": "CH-01-V3",
      "baseId": "CH-01",
      "headline": "Bold Headline Text",
      "content": "**Bold Headline Text**: Full 35-50 word achievement narrative with specific metrics...",
      "wordCount": 42,
      "primaryVerb": "Built",
      "jdMapping": [
        {
          "phraseUsed": "phrase in your highlight",
          "jdSection": "Requirements",
          "jdPhraseSource": "original JD phrase",
          "exactQuote": true
        }
      ],
      "selectionRationale": "Why this highlight addresses key JD requirements"
    }
  ],
  "coverageAnalysis": {
    "jdSectionsCovered": [
      {
        "section": "Key Responsibilities",
        "strength": "Strong",
        "coveredBy": ["ch-1", "ch-3"]
      }
    ],
    "gapsRemaining": [
      {
        "gap": "Technical leadership experience",
        "severity": "Medium",
        "notes": "Can be addressed in P1 bullets"
      }
    ]
  },
  "stateForDownstream": {
    "usedBaseIds": ["CH-01", "CH-04", "CH-05", "CH-07", "CH-09"],
    "usedVerbs": ["Built", "Transformed", "Scaled", "Drove", "Created"],
    "usedMetrics": ["$40M", "191% increase", "$727M"],
    "jdSectionsCoveredByCH": ["Overview", "Key Responsibilities"]
  }
}
\`\`\`

## CRITICAL REQUIREMENTS

1. **Exactly 5 highlights** - No more, no less
2. **Unique base IDs** - Each baseId can only appear once
3. **Unique verbs** - Each highlight content must start with a DIFFERENT action verb (after the headline colon)
4. ⚠️ **Word count 35-50** - Content AFTER the headline colon must be 35-50 words. Count ONLY the words after ":". This is CRITICAL - highlights under 35 words will be rejected!
5. **Bold headline format** - **Short Headline**: Description (headline is 2-4 words max)
6. **At least 2 JD mappings per highlight** - Show how each addresses the JD
7. **No forbidden words** - Never use: leveraged, utilized, spearheaded, synergy
8. **No emdashes** - Use commas or periods instead of —
9. **Metrics from source only** - Don't fabricate numbers

Return ONLY the JSON object. No markdown, no explanations.`;
}

// Type guard
export function isValidCHChatOutput(data: unknown): data is CHChatOutput {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.careerHighlights)) return false;
  if (obj.careerHighlights.length !== 5) return false;
  if (!obj.coverageAnalysis || typeof obj.coverageAnalysis !== 'object') return false;
  if (!obj.stateForDownstream || typeof obj.stateForDownstream !== 'object') return false;

  return true;
}

// Parse response
export function parseCHChatResponse(response: string): CHChatOutput {
  const cleaned = response
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  const parsed = JSON.parse(cleaned);

  if (!isValidCHChatOutput(parsed)) {
    throw new Error('Invalid CH chat output structure');
  }

  return parsed as CHChatOutput;
}
