import { JDStrategy } from '@/types/v2';
import { ContentAllocation } from '@/types/v2.1';
import { UMBERTO_VOICE_GUIDE } from './voice-guide';

/**
 * Build the prompt for Phase 1: Narrative Writer
 * Writes: Summary + 5 Career Highlights
 */
export function buildNarrativeWriterPrompt(
  strategy: JDStrategy,
  allocation: ContentAllocation
): string {
  // Condense JD strategy to essential positioning info
  const positioningContext = buildPositioningContext(strategy);

  // Format allocated content for the prompt
  const summarySourcesText = allocation.summaries
    .map(s => `[${s.contentId}]\n${s.content}`)
    .join('\n\n');

  const chSourcesText = allocation.careerHighlights
    .map((ch, i) => `**Career Highlight ${i + 1}** [Source: ${ch.contentId}]\n${ch.content}`)
    .join('\n\n');

  return `You are an elite executive resume writer creating the narrative sections of a resume.

${UMBERTO_VOICE_GUIDE}

---

## TARGET ROLE

**Company:** ${strategy.company.name}
**Industry:** ${strategy.company.industry}${strategy.company.subIndustry ? ` / ${strategy.company.subIndustry}` : ''}
**Role:** ${strategy.role.title}
**Level:** ${strategy.role.level}

${positioningContext}

---

## SOURCE MATERIAL

You must use ONLY the facts, metrics, and details from these sources. You may reframe, combine angles, and adjust language, but you CANNOT invent new metrics or outcomes.

### Summary Sources (synthesize into ONE 140-160 word summary)
${summarySourcesText}

### Career Highlight Sources (reframe each into a highlight)
${chSourcesText}

---

## YOUR TASK

Write:
1. **Summary** (140-160 words) - Fresh prose with personality. NOT a copy of sources.
2. **5 Career Highlights** - Each reframed for this specific role. Format: **Bold Headline**: Description with metric.

## OUTPUT FORMAT

Return ONLY valid JSON (no markdown, no explanation):

{
  "summary": {
    "content": "The complete summary paragraph. Must be 140-160 words.",
    "wordCount": 152,
    "sourcesUsed": ["SUM-01", "SUM-02"]
  },
  "careerHighlights": [
    {
      "slot": "ch-1",
      "headline": "Healthcare Platform Launch",
      "content": "**Healthcare Platform Launch**: Developed product positioning strategy for first-of-kind DTC healthcare platform, defining value proposition and launch activation. Delivered $727M revenue, outperforming forecasts by 20%.",
      "sourceId": "CH-05-V2",
      "primaryVerb": "Developed",
      "wordCount": 38
    },
    {
      "slot": "ch-2",
      "headline": "...",
      "content": "...",
      "sourceId": "...",
      "primaryVerb": "...",
      "wordCount": 42
    }
  ],
  "metadata": {
    "usedVerbs": ["Developed", "Transformed", "Built", "Drove", "Established"],
    "thematicAnchors": {
      "primaryNarrative": "One sentence describing the throughline established",
      "distinctiveValue": "What makes this candidate unique for this role",
      "keyProofPoints": ["$727M healthcare platform", "1.6M patient appointments"],
      "toneEstablished": "Confident, outcomes-focused, strategic"
    }
  }
}

## CRITICAL CONSTRAINTS

1. Summary MUST be 140-160 words. Count them carefully.
2. Each Career Highlight MUST be 35-50 words (including headline).
3. NO emdashes (-) anywhere. Rewrite sentences that need them.
4. NO repeated verbs across the 5 highlights. Each must start differently.
5. Every metric must come EXACTLY from source material. Do not round or modify.
6. Headlines must be specific to the achievement (not generic like "Brand Leadership").
7. Do NOT mention practice-building ($15M to $40M) unless this is a consulting role.
8. The summary should NOT repeat achievements that are in Career Highlights.

Return ONLY the JSON object, no other text.`;
}

/**
 * Build condensed positioning context from JD strategy
 */
function buildPositioningContext(strategy: JDStrategy): string {
  const primaryAngle = strategy.positioning?.primaryAngle;
  const supportingAngles = strategy.positioning?.supportingAngles || [];
  const narrativeDirection = strategy.positioning?.narrativeDirection;
  const termsToMirror = strategy.language?.termsToMirror || [];

  let context = '## POSITIONING STRATEGY\n\n';

  if (primaryAngle) {
    context += `**Primary Angle:** ${primaryAngle.angle}\n`;
    context += `${primaryAngle.contentImplication}\n\n`;
  }

  if (supportingAngles.length > 0) {
    context += '**Supporting Angles:**\n';
    supportingAngles.slice(0, 3).forEach(a => {
      context += `- ${a.angle}\n`;
    });
    context += '\n';
  }

  if (narrativeDirection) {
    context += `**Narrative Direction:**\n${narrativeDirection}\n\n`;
  }

  if (termsToMirror.length > 0) {
    context += '## LANGUAGE TO MIRROR (naturally, not keyword stuffing)\n';
    termsToMirror.slice(0, 5).forEach(t => {
      context += `- "${t.jdTerm}" -> ${t.naturalUsage}\n`;
    });
  }

  return context;
}
