import { JDStrategy } from '@/types/v2';
import { ContentAllocation, NarrativeWriterOutput } from '@/types/v2.1';
import { UMBERTO_VOICE_GUIDE_CONDENSED } from './voice-guide';

/**
 * Build the prompt for Phase 2: Detail Writer
 * Writes: P1 overview + 4 bullets, P2 overview + 3 bullets
 *
 * Key difference from Phase 1:
 * - Receives bannedVerbs from Phase 1 output
 * - Receives thematicAnchors to maintain coherence
 * - More focused on metrics and CAR structure
 */
export function buildDetailWriterPrompt(
  strategy: JDStrategy,
  allocation: ContentAllocation,
  phase1Output: NarrativeWriterOutput
): string {
  const bannedVerbs = phase1Output.metadata.usedVerbs;
  const anchors = phase1Output.metadata.thematicAnchors;

  // Format P1 sources
  const p1OverviewSource = allocation.position1Overview
    ? `[${allocation.position1Overview.contentId}]\n${allocation.position1Overview.content}`
    : 'No overview source provided';

  const p1BulletsText = allocation.position1Bullets
    .map((b, i) => `**P1-Bullet-${i + 1}** [Source: ${b.contentId}]\n${b.content}`)
    .join('\n\n');

  // Format P2 sources
  const p2OverviewSource = allocation.position2Overview
    ? `[${allocation.position2Overview.contentId}]\n${allocation.position2Overview.content}`
    : 'No overview source provided';

  const p2BulletsText = allocation.position2Bullets
    .map((b, i) => `**P2-Bullet-${i + 1}** [Source: ${b.contentId}]\n${b.content}`)
    .join('\n\n');

  return `You are an elite executive resume writer creating the position detail sections.

${UMBERTO_VOICE_GUIDE_CONDENSED}

---

## CONTEXT FROM PHASE 1

The summary and career highlights have established this narrative. Your content must feel like a natural continuation.

**Primary Narrative:** ${anchors.primaryNarrative}
**Distinctive Value:** ${anchors.distinctiveValue}
**Tone:** ${anchors.toneEstablished}

### Proof Points Already Used (DO NOT repeat these metrics)
${anchors.keyProofPoints.map(p => `- ${p}`).join('\n')}

---

## BANNED VERBS

These verbs were used in Career Highlights. DO NOT use any of them:
**${bannedVerbs.join(', ')}**

You must start each bullet with a DIFFERENT verb not in this list.

---

## TARGET ROLE

**Company:** ${strategy.company.name}
**Role:** ${strategy.role.title}

### Language to Mirror (naturally)
${(strategy.language?.termsToMirror || []).slice(0, 3).map(t => `- "${t.jdTerm}"`).join('\n')}

---

## SOURCE MATERIAL

Use ONLY facts and metrics from these sources. You may reframe language but CANNOT invent metrics.

### Position 1 Overview Source
${p1OverviewSource}

### Position 1 Bullet Sources
${p1BulletsText}

### Position 2 Overview Source
${p2OverviewSource}

### Position 2 Bullet Sources
${p2BulletsText}

---

## YOUR TASK

Write:
1. **Position 1 Overview** (40-60 words) - Sets context for the role, highlights scope
2. **Position 1 Bullets (4)** - 25-40 words each, metrics-driven, CAR structure
3. **Position 2 Overview** (40-60 words) - Sets context for the role
4. **Position 2 Bullets (3)** - 25-40 words each, metrics-driven, CAR structure

## OUTPUT FORMAT

Return ONLY valid JSON (no markdown, no explanation):

{
  "position1": {
    "overview": {
      "content": "Overview paragraph setting context for this role. Should be 40-60 words.",
      "sourceId": "OV-P1-XX",
      "wordCount": 52
    },
    "bullets": [
      {
        "slot": "p1-bullet-1",
        "content": "Bullet starting with unique verb, including specific metrics from source.",
        "sourceId": "P1-BXX-VY",
        "primaryVerb": "Architected",
        "wordCount": 35
      },
      {
        "slot": "p1-bullet-2",
        "content": "...",
        "sourceId": "...",
        "primaryVerb": "Unified",
        "wordCount": 32
      },
      {
        "slot": "p1-bullet-3",
        "content": "...",
        "sourceId": "...",
        "primaryVerb": "Pioneered",
        "wordCount": 38
      },
      {
        "slot": "p1-bullet-4",
        "content": "...",
        "sourceId": "...",
        "primaryVerb": "Orchestrated",
        "wordCount": 30
      }
    ]
  },
  "position2": {
    "overview": {
      "content": "Overview paragraph for second position. 40-60 words.",
      "sourceId": "OV-P2-XX",
      "wordCount": 48
    },
    "bullets": [
      {
        "slot": "p2-bullet-1",
        "content": "...",
        "sourceId": "P2-BXX-VY",
        "primaryVerb": "Crafted",
        "wordCount": 33
      },
      {
        "slot": "p2-bullet-2",
        "content": "...",
        "sourceId": "...",
        "primaryVerb": "Launched",
        "wordCount": 36
      },
      {
        "slot": "p2-bullet-3",
        "content": "...",
        "sourceId": "...",
        "primaryVerb": "Integrated",
        "wordCount": 31
      }
    ]
  },
  "metadata": {
    "usedVerbs": ["Architected", "Unified", "Pioneered", "Orchestrated", "Crafted", "Launched", "Integrated"],
    "metricsUsed": [
      {"metric": "10% awareness lift", "sourceId": "P1-B05-V1"},
      {"metric": "$727M revenue", "sourceId": "P1-B06-V3"}
    ]
  }
}

## CRITICAL CONSTRAINTS

1. Bullets MUST be 25-40 words. Count carefully.
2. Overviews MUST be 40-60 words.
3. NO emdashes (-) anywhere. Rewrite sentences instead.
4. DO NOT use banned verbs: ${bannedVerbs.join(', ')}
5. NO repeated verbs within Position 1.
6. NO repeated verbs within Position 2.
7. A verb used in P1 CAN be reused in P2 (but try to vary).
8. Every metric must match source material EXACTLY.
9. Name clients/companies when the source names them.
10. DO NOT repeat metrics already used in Career Highlights.

Return ONLY the JSON object, no other text.`;
}
