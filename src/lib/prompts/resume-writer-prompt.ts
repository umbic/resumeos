// ============================================
// ResumeOS V2: Resume Writer Prompt
// ============================================

import type {
  JDStrategy,
  ContentSelectionResult,
  GapAnalysis,
  UserAdjustments,
  SourceItem,
} from '@/types/v2';

/**
 * Parse user preference from slotContext to get preferred source ID
 */
function getPreferredSourceId(
  slotId: string,
  userAdjustments: UserAdjustments | null
): string | null {
  if (!userAdjustments) return null;

  const slotCtx = userAdjustments.slotContext.find((s) => s.slotId === slotId);
  if (!slotCtx) return null;

  // Look for "prefer:SOURCE_ID" in emphasize array
  const preferEntry = slotCtx.emphasize.find((e) => e.startsWith('prefer:'));
  if (preferEntry) {
    return preferEntry.replace('prefer:', '');
  }

  return null;
}

/**
 * Reorder sources to put preferred source first
 */
function prioritizeSources(
  sources: SourceItem[],
  preferredId: string | null
): SourceItem[] {
  if (!preferredId) return sources;

  const preferred = sources.find((s) => s.id === preferredId);
  if (!preferred) return sources;

  return [preferred, ...sources.filter((s) => s.id !== preferredId)];
}

/**
 * Format sources for a slot, applying user preferences
 */
function formatSlotSources(
  slotId: string,
  sources: SourceItem[],
  userAdjustments: UserAdjustments | null
): string {
  const preferredId = getPreferredSourceId(slotId, userAdjustments);
  const orderedSources = prioritizeSources(sources, preferredId);

  return orderedSources
    .map((s, i) => {
      const isPreferred = preferredId && s.id === preferredId;
      const marker = isPreferred ? ' ★ USER PREFERRED' : '';
      const rank = i === 0 ? ' (Primary)' : '';
      return `[${s.id}]${marker}${rank}
Score: ${s.score}
${s.content}`;
    })
    .join('\n\n');
}

/**
 * Get slot context for additional instructions
 */
function getSlotContext(
  slotId: string,
  userAdjustments: UserAdjustments | null
): string | null {
  if (!userAdjustments) return null;

  const slotCtx = userAdjustments.slotContext.find((s) => s.slotId === slotId);
  if (!slotCtx || !slotCtx.additionalContext) return null;

  return slotCtx.additionalContext;
}

/**
 * Build the prompt for the Resume Writer agent
 */
export function buildResumeWriterPrompt(
  strategy: JDStrategy,
  selection: ContentSelectionResult,
  gapAnalysis: GapAnalysis,
  userAdjustments: UserAdjustments | null
): string {
  // Format emphasis recommendations
  const emphasisGuidance = gapAnalysis.emphasisRecommendations
    .map((r) => `- ${r.slotId}: ${r.recommendation} (${r.reason})`)
    .join('\n');

  // Format honest gaps that require navigation
  const gapsToNavigate = gapAnalysis.honestGaps
    .filter((g) => g.mitigation)
    .map((g) => `- ${g.requirement}: ${g.mitigation}`)
    .join('\n');

  // Format critical warnings
  const criticalWarnings = gapAnalysis.warnings
    .filter((w) => w.severity === 'blocker' || w.severity === 'warning')
    .map((w) => `- [${w.severity.toUpperCase()}] ${w.message}`)
    .join('\n');

  // Format language terms to mirror
  const languageGuidance = strategy.language.termsToMirror
    .map((t) => `- "${t.jdTerm}" → Use as: "${t.naturalUsage}" (${t.context})`)
    .join('\n');

  // Build source material sections
  const summarySection = formatSlotSources(
    'summary',
    selection.summary.sources,
    userAdjustments
  );
  const summaryContext = getSlotContext('summary', userAdjustments);

  // Career Highlights
  const chSections = selection.careerHighlights
    .map((slot, i) => {
      const slotId = slot.slot;
      const sources = formatSlotSources(slotId, slot.sources, userAdjustments);
      const context = getSlotContext(slotId, userAdjustments);
      return `
**CH Slot ${i + 1} (${slotId}):**
${sources}
${context ? `\n> User Note: ${context}` : ''}`;
    })
    .join('\n');

  // Position 1 Bullets
  const p1BulletSections = selection.position1.bullets
    .map((slot, i) => {
      const slotId = slot.slot;
      const sources = formatSlotSources(slotId, slot.sources, userAdjustments);
      const context = getSlotContext(slotId, userAdjustments);
      return `
**P1 Bullet ${i + 1} (${slotId}):**
${sources}
${context ? `\n> User Note: ${context}` : ''}`;
    })
    .join('\n');

  // Position 2 Bullets
  const p2BulletSections = selection.position2.bullets
    .map((slot, i) => {
      const slotId = slot.slot;
      const sources = formatSlotSources(slotId, slot.sources, userAdjustments);
      const context = getSlotContext(slotId, userAdjustments);
      return `
**P2 Bullet ${i + 1} (${slotId}):**
${sources}
${context ? `\n> User Note: ${context}` : ''}`;
    })
    .join('\n');

  // Position Overviews
  const p1OverviewSources = formatSlotSources(
    'p1_overview',
    selection.position1.overview.sources,
    userAdjustments
  );
  const p2OverviewSources = formatSlotSources(
    'p2_overview',
    selection.position2.overview.sources,
    userAdjustments
  );

  // P3-P6 Overviews
  const laterOverviews = selection.positions3to6
    .map((p) => {
      const slotId = `p${p.position}_overview`;
      const sources = formatSlotSources(slotId, p.overview.sources, userAdjustments);
      return `
**Position ${p.position} Overview (${slotId}):**
${sources}`;
    })
    .join('\n');

  return `You are an elite executive resume writer. Write a complete, tailored resume using ONLY the provided source material.

## CRITICAL CONSTRAINTS

### Factual Constraint (NON-NEGOTIABLE)
- ✅ Every metric MUST come exactly from source material (if source says "$727M", write "$727M" not "$700M+")
- ✅ Every client/company name MUST come from source material
- ✅ Every outcome claim MUST be supported by source material
- ❌ You CANNOT invent metrics, clients, or outcomes
- ✅ You CAN reframe, restructure, and combine angles from sources
- ✅ You CAN change verb choices and sentence structure
- ✅ You CAN emphasize certain aspects over others

### Quality Rules (ENFORCED)
- Bullet length: Career Highlights 25-40 words, Position bullets 20-35 words
- NEVER exceed 50 words per bullet
- Action verb variety: Never repeat a verb within a position, max 2x across entire resume
- Strong action verbs only - no passive voice to start bullets
- CAR structure: Challenge → Action → Result (implied, not labeled)

---

## TARGET ROLE

**Company:** ${strategy.company.name} (${strategy.company.industry}${strategy.company.subIndustry ? ` / ${strategy.company.subIndustry}` : ''})
**Role:** ${strategy.role.title}
**Level:** ${strategy.role.level}
**Function:** ${strategy.role.function}
**Scope:** ${strategy.role.scope}

---

## POSITIONING STRATEGY

**Primary Angle:** ${strategy.positioning.primaryAngle.angle}
- JD Evidence: "${strategy.positioning.primaryAngle.jdEvidence}"
- Content Implication: ${strategy.positioning.primaryAngle.contentImplication}

**Supporting Angles:**
${strategy.positioning.supportingAngles.map((a) => `- ${a.angle}: ${a.contentImplication}`).join('\n')}

**Narrative Direction:**
${strategy.positioning.narrativeDirection}

---

## LANGUAGE GUIDANCE

Mirror these terms naturally (NOT keyword stuffing):
${languageGuidance}

**Tone:** ${strategy.language.toneGuidance}

**Terms to Avoid:** ${strategy.language.termsToAvoid.join(', ') || 'None specified'}

---

## GAP ANALYSIS GUIDANCE

${emphasisGuidance ? `**Emphasis Recommendations:**\n${emphasisGuidance}` : 'No specific emphasis recommendations.'}

${gapsToNavigate ? `**Gaps to Navigate:**\n${gapsToNavigate}` : 'No critical gaps to navigate.'}

${criticalWarnings ? `**Warnings:**\n${criticalWarnings}` : 'No warnings.'}

${userAdjustments?.globalInstructions ? `**User Instructions:**\n${userAdjustments.globalInstructions}` : ''}

---

## SOURCE MATERIAL

### Summary Sources (Write 1 summary from these)
${summarySection}
${summaryContext ? `\n> User Note: ${summaryContext}` : ''}

### Career Highlight Sources (Write 5 highlights)
${chSections}

### Position 1 Overview Sources
${p1OverviewSources}

### Position 1 Bullet Sources (Write 4 bullets)
${p1BulletSections}

### Position 2 Overview Sources
${p2OverviewSources}

### Position 2 Bullet Sources (Write 3 bullets)
${p2BulletSections}

### Later Position Overviews (P3-P6)
${laterOverviews}

---

## OUTPUT FORMAT

Return ONLY valid JSON matching this exact structure:

{
  "summary": {
    "content": "4-6 sentence summary paragraph supporting the primary positioning angle (80-120 words)",
    "sourcesUsed": ["SUM-XX", "SUM-YY"]
  },
  "careerHighlights": [
    {
      "slotId": "ch_1",
      "content": "**Bold Headline**: Achievement description with exact metrics from source. (25-40 words)",
      "sourcesUsed": ["CH-XX-VY"]
    },
    {
      "slotId": "ch_2",
      "content": "...",
      "sourcesUsed": ["CH-XX"]
    },
    {
      "slotId": "ch_3",
      "content": "...",
      "sourcesUsed": ["CH-XX"]
    },
    {
      "slotId": "ch_4",
      "content": "...",
      "sourcesUsed": ["CH-XX"]
    },
    {
      "slotId": "ch_5",
      "content": "...",
      "sourcesUsed": ["CH-XX"]
    }
  ],
  "positions": [
    {
      "position": 1,
      "company": "Company Name from source",
      "title": "Title from source",
      "dates": "Dates from source",
      "location": "Location from source",
      "overview": {
        "content": "2-3 sentence overview",
        "sourcesUsed": ["OV-P1-XX"]
      },
      "bullets": [
        {
          "content": "Action verb + achievement with metrics. (20-35 words)",
          "sourcesUsed": ["P1-BXX"]
        },
        {
          "content": "...",
          "sourcesUsed": ["P1-BXX"]
        },
        {
          "content": "...",
          "sourcesUsed": ["P1-BXX"]
        },
        {
          "content": "...",
          "sourcesUsed": ["P1-BXX"]
        }
      ]
    },
    {
      "position": 2,
      "company": "Company Name",
      "title": "Title",
      "dates": "Dates",
      "location": "Location",
      "overview": {
        "content": "2-3 sentence overview",
        "sourcesUsed": ["OV-P2-XX"]
      },
      "bullets": [
        {
          "content": "...",
          "sourcesUsed": ["P2-BXX"]
        },
        {
          "content": "...",
          "sourcesUsed": ["P2-BXX"]
        },
        {
          "content": "...",
          "sourcesUsed": ["P2-BXX"]
        }
      ]
    },
    {
      "position": 3,
      "company": "Company Name",
      "title": "Title",
      "dates": "Dates",
      "location": "Location",
      "overview": {
        "content": "2-3 sentence overview",
        "sourcesUsed": ["OV-P3"]
      }
    },
    {
      "position": 4,
      "company": "Company Name",
      "title": "Title",
      "dates": "Dates",
      "location": "Location",
      "overview": {
        "content": "2-3 sentence overview",
        "sourcesUsed": ["OV-P4"]
      }
    },
    {
      "position": 5,
      "company": "Company Name",
      "title": "Title",
      "dates": "Dates",
      "location": "Location",
      "overview": {
        "content": "2-3 sentence overview",
        "sourcesUsed": ["OV-P5"]
      }
    },
    {
      "position": 6,
      "company": "Company Name",
      "title": "Title",
      "dates": "Dates",
      "location": "Location",
      "overview": {
        "content": "2-3 sentence overview",
        "sourcesUsed": ["OV-P6"]
      }
    }
  ],
  "writingMetadata": {
    "metricsUsed": [
      { "metric": "$XXM revenue", "sourceId": "CH-XX", "usedIn": "ch_1" }
    ],
    "clientsReferenced": ["Client A", "Client B"],
    "positioningAngleServed": "Primary angle description"
  }
}

---

## FINAL CHECKLIST (Verify before outputting)

□ All metrics match source material EXACTLY (no rounding, no approximating)
□ No verb repeated within any position
□ Max 2 uses of any verb across entire resume
□ Each career highlight is 25-40 words
□ Each position bullet is 20-35 words
□ Summary supports the primary positioning angle
□ JD terms woven in naturally (not forced)
□ 5 career highlights total
□ 4 P1 bullets, 3 P2 bullets
□ 6 position overviews

Return ONLY the JSON object, no markdown code fences, no additional text.`;
}
