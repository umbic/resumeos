// ============================================
// ResumeOS V2: Validator Prompt
// ============================================

import type {
  JDStrategy,
  ContentSelectionResult,
  WriterOutput,
  SourceItem,
} from '@/types/v2';

/**
 * Flatten all sources from a selection for easy lookup
 */
function getAllSources(selection: ContentSelectionResult): SourceItem[] {
  const sources: SourceItem[] = [];

  // Summaries
  sources.push(...selection.summary.sources);

  // Career Highlights
  selection.careerHighlights.forEach((slot) => {
    sources.push(...slot.sources);
  });

  // Position 1
  sources.push(...selection.position1.overview.sources);
  selection.position1.bullets.forEach((slot) => {
    sources.push(...slot.sources);
  });

  // Position 2
  sources.push(...selection.position2.overview.sources);
  selection.position2.bullets.forEach((slot) => {
    sources.push(...slot.sources);
  });

  // Positions 3-6
  selection.positions3to6.forEach((p) => {
    sources.push(...p.overview.sources);
  });

  return sources;
}

/**
 * Format source material for the validator
 */
function formatSourceMaterial(selection: ContentSelectionResult): string {
  const sources = getAllSources(selection);

  // Group by base ID for easier reading
  const grouped = new Map<string, SourceItem[]>();
  sources.forEach((s) => {
    const key = s.baseId || s.id;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(s);
  });

  let output = '';
  grouped.forEach((items, baseId) => {
    output += `### ${baseId}\n`;
    items.forEach((item) => {
      const variant = item.id !== item.baseId ? ` (${item.variantLabel || item.id})` : '';
      output += `[${item.id}]${variant}\n${item.content}\n\n`;
    });
  });

  return output;
}

/**
 * Format the written resume for validation
 */
function formatWrittenResume(writerOutput: WriterOutput): string {
  let output = '';

  // Summary
  output += `## Summary\n`;
  output += `Content: ${writerOutput.summary.content}\n`;
  output += `Sources claimed: ${writerOutput.summary.sourcesUsed.join(', ')}\n\n`;

  // Career Highlights
  output += `## Career Highlights\n`;
  writerOutput.careerHighlights.forEach((ch, i) => {
    output += `### CH ${i + 1} (${ch.slotId})\n`;
    output += `Content: ${ch.content}\n`;
    output += `Sources claimed: ${ch.sourcesUsed.join(', ')}\n\n`;
  });

  // Positions
  writerOutput.positions.forEach((pos) => {
    output += `## Position ${pos.position}: ${pos.title} at ${pos.company}\n`;
    output += `Dates: ${pos.dates} | Location: ${pos.location}\n\n`;

    output += `### Overview\n`;
    output += `Content: ${pos.overview.content}\n`;
    output += `Sources claimed: ${pos.overview.sourcesUsed.join(', ')}\n\n`;

    if (pos.bullets && pos.bullets.length > 0) {
      output += `### Bullets\n`;
      pos.bullets.forEach((b, i) => {
        output += `${i + 1}. ${b.content}\n`;
        output += `   Sources claimed: ${b.sourcesUsed.join(', ')}\n\n`;
      });
    }
  });

  // Writing metadata
  output += `## Writing Metadata (from Writer)\n`;
  output += `Metrics used: ${writerOutput.writingMetadata.metricsUsed.map((m) => `${m.metric} (from ${m.sourceId} in ${m.usedIn})`).join(', ')}\n`;
  output += `Clients referenced: ${writerOutput.writingMetadata.clientsReferenced.join(', ')}\n`;
  output += `Positioning angle served: ${writerOutput.writingMetadata.positioningAngleServed}\n`;

  return output;
}

/**
 * Build the prompt for the Validator agent
 */
export function buildValidatorPrompt(
  strategy: JDStrategy,
  selection: ContentSelectionResult,
  writerOutput: WriterOutput
): string {
  const sourceContent = formatSourceMaterial(selection);
  const resumeContent = formatWrittenResume(writerOutput);

  // Format requirements
  const mustHaveReqs = strategy.requirements.mustHave
    .map((r) => `- [${r.priority}] ${r.requirement}`)
    .join('\n');

  const niceToHaveReqs = strategy.requirements.niceToHave
    .map((r) => `- [${r.priority}] ${r.requirement}`)
    .join('\n');

  return `You are a rigorous resume validator. Your job is to verify the written resume against source material and catch any fabrications, coverage gaps, or quality issues.

## VALIDATION PRINCIPLES

1. **STRICT ON HONESTY** - Any metric modification is a blocker (source says "$60M", resume says "$65M" = FAIL)
2. **EXACT MATCHING** - Percentages, dollar amounts, client names must match sources exactly
3. **ATTRIBUTION CHECK** - Claimed sourceIds must actually support the content
4. **PRAGMATIC ON COVERAGE** - Not every requirement needs equal weight, but critical ones matter
5. **ACTIONABLE FIXES** - Every issue should have a concrete suggestion

---

## WRITTEN RESUME (To Validate)

${resumeContent}

---

## SOURCE MATERIAL (Ground Truth)

The following is the ONLY valid source of facts. Every metric, client, and outcome claim MUST trace back to this material.

${sourceContent}

---

## JD REQUIREMENTS

**Must-Have Requirements (Critical):**
${mustHaveReqs}

**Nice-to-Have Requirements:**
${niceToHaveReqs}

**Primary Positioning Angle:**
${strategy.positioning.primaryAngle.angle}

**Content Implication:**
${strategy.positioning.primaryAngle.contentImplication}

---

## VALIDATION TASKS

### 1. HONESTY CHECK (Most Important)
For each metric, percentage, dollar amount, or client name in the resume:
- Verify it appears EXACTLY in the claimed source(s)
- Flag any modifications (rounding, approximation, enhancement)
- Flag any inventions (claims not in any source)
- Flag wrong attributions (claim says source X but content isn't from X)

Issue types for honesty:
- "metric_not_in_source" - A number/metric doesn't match source exactly
- "client_not_in_source" - A client/company name was invented
- "outcome_fabricated" - An outcome claim has no source support

### 2. COVERAGE CHECK
For each must-have requirement:
- Identify where it's addressed in the resume
- Note if it's strongly, adequately, or weakly addressed
- Flag if completely missing

### 3. QUALITY CHECK
Review writing quality:
- Verb repetition: Same verb used multiple times in a position = issue
- Bullet length: Career highlights should be 25-40 words, position bullets 20-35 words
- Summary length: Should be 80-120 words
- Passive voice at start of bullets = issue
- Weak verbs = suggestion

### 4. POSITIONING CHECK
Does the resume serve the primary positioning angle?
- Is the summary aligned with the angle?
- Do career highlights support the positioning?
- Is the narrative coherent?

---

## OUTPUT FORMAT

Return ONLY valid JSON matching this structure:

{
  "passed": true | false,
  "overallScore": 0-100,

  "honesty": {
    "score": 0-100,
    "passed": true | false,
    "issues": [
      {
        "location": "summary | ch_1 | p1_bullet_2 | etc",
        "claim": "The problematic claim in the resume",
        "issue": "metric_not_in_source | client_not_in_source | outcome_fabricated",
        "severity": "blocker | warning"
      }
    ],
    "metricsVerified": [
      {
        "metric": "The metric as written",
        "sourceId": "The source it claims to come from",
        "verified": true | false
      }
    ]
  },

  "coverage": {
    "score": 0-100,
    "passed": true | false,
    "requirementsAddressed": [
      {
        "requirement": "The requirement text",
        "addressed": true | false,
        "where": "Location(s) where it's addressed, or null if missing"
      }
    ],
    "positioningServed": true | false
  },

  "quality": {
    "score": 0-100,
    "passed": true | false,
    "issues": [
      {
        "type": "verb_repetition | bullet_too_long | bullet_too_short | passive_voice | weak_verb | missing_quantification",
        "location": "summary | ch_1 | p1_bullet_2 | etc",
        "detail": "Description of the issue",
        "severity": "blocker | warning | suggestion"
      }
    ],
    "verbUsage": [
      {
        "verb": "The verb",
        "count": 2,
        "locations": ["ch_1", "p1_bullet_3"]
      }
    ]
  },

  "suggestedFixes": [
    {
      "location": "ch_1",
      "issue": "Brief description of issue",
      "suggestion": "How to fix it",
      "autoFixable": false
    }
  ]
}

## SCORING GUIDELINES

**Overall passed = true if:**
- No blocker issues in any category
- All scores >= 70

**Honesty Score:**
- 100: All metrics verified, no issues
- 80-99: Minor issues (warnings only)
- 50-79: Some metrics unverified but no fabrications
- 0-49: Fabricated content detected (blockers present)

**Coverage Score:**
- 100: All must-have requirements strongly addressed
- 80-99: All addressed, some weakly
- 60-79: Most addressed, some missing
- 0-59: Critical requirements missing

**Quality Score:**
- 100: No issues
- 80-99: Suggestions only
- 60-79: Warnings but no blockers
- 0-59: Blockers present

Return ONLY the JSON object, no markdown code fences, no additional text.`;
}
