// ============================================
// ResumeOS V2: Gap Analyzer Prompt
// ============================================

import type { JDStrategy, ContentSelectionResult } from '@/types/v2';

/**
 * Build the prompt for the Gap Analyzer agent
 * Compares JD requirements against selected content to identify gaps
 */
export function buildGapAnalyzerPrompt(
  strategy: JDStrategy,
  selection: ContentSelectionResult
): string {
  // Format summaries
  const summaryContent = selection.summary.sources
    .map(
      (s) =>
        `- [${s.id}] Score: ${s.score}
    Tags: industry=${s.tags.industry.join(', ') || 'none'}, function=${s.tags.function.join(', ') || 'none'}, theme=${s.tags.theme.join(', ') || 'none'}
    "${s.content.substring(0, 200)}..."`
    )
    .join('\n\n');

  // Format career highlights
  const chContent = selection.careerHighlights
    .map(
      (slot, i) => `
**Slot ${i + 1} (${slot.slot}):**
${slot.sources
  .map(
    (s) =>
      `- [${s.id}] Score: ${s.score}
    Tags: industry=${s.tags.industry.join(', ') || 'none'}, function=${s.tags.function.join(', ') || 'none'}, theme=${s.tags.theme.join(', ') || 'none'}
    "${s.content.substring(0, 150)}..."`
  )
  .join('\n')}`
    )
    .join('\n');

  // Format P1 bullets
  const p1Content = selection.position1.bullets
    .map(
      (slot, i) => `
**Slot ${i + 1} (${slot.slot}):**
${slot.sources
  .map(
    (s) =>
      `- [${s.id}] Score: ${s.score}
    Tags: industry=${s.tags.industry.join(', ') || 'none'}, function=${s.tags.function.join(', ') || 'none'}, theme=${s.tags.theme.join(', ') || 'none'}
    "${s.content.substring(0, 150)}..."`
  )
  .join('\n')}`
    )
    .join('\n');

  // Format P2 bullets
  const p2Content = selection.position2.bullets
    .map(
      (slot, i) => `
**Slot ${i + 1} (${slot.slot}):**
${slot.sources
  .map(
    (s) =>
      `- [${s.id}] Score: ${s.score}
    Tags: industry=${s.tags.industry.join(', ') || 'none'}, function=${s.tags.function.join(', ') || 'none'}, theme=${s.tags.theme.join(', ') || 'none'}
    "${s.content.substring(0, 150)}..."`
  )
  .join('\n')}`
    )
    .join('\n');

  return `You are a senior resume strategist analyzing content coverage against job requirements.

## Job Description Analysis

### Company & Role
- Company: ${strategy.company.name} (${strategy.company.industry})
- Role: ${strategy.role.title} (${strategy.role.level})
- Function: ${strategy.role.function}
- Scope: ${strategy.role.scope}

### Must-Have Requirements (Critical)
${strategy.requirements.mustHave
  .map(
    (r, i) => `${i + 1}. ${r.requirement} [${r.category}/${r.priority}]
   Evidence: "${r.jdEvidence}"`
  )
  .join('\n')}

### Nice-to-Have Requirements
${strategy.requirements.niceToHave
  .map(
    (r, i) => `${i + 1}. ${r.requirement} [${r.category}/${r.priority}]
   Evidence: "${r.jdEvidence}"`
  )
  .join('\n')}

### Positioning Strategy
- Primary Angle: ${strategy.positioning.primaryAngle.angle}
  - Evidence: ${strategy.positioning.primaryAngle.jdEvidence}
  - Content Implication: ${strategy.positioning.primaryAngle.contentImplication}
- Supporting Angles: ${strategy.positioning.supportingAngles.map((a) => a.angle).join(', ')}
- Narrative Direction: ${strategy.positioning.narrativeDirection}

### Language to Mirror
${strategy.language.termsToMirror.map((t) => `- "${t.jdTerm}" → ${t.naturalUsage} (context: ${t.context})`).join('\n')}

### Terms to Avoid
${strategy.language.termsToAvoid.join(', ')}

---

## Selected Source Material

### Summaries (${selection.summary.sources.length} candidates)
${summaryContent}

### Career Highlights (${selection.careerHighlights.length} slots)
${chContent}

### Position 1 Overview
${selection.position1.overview.sources.map((s) => `- [${s.id}] "${s.content.substring(0, 200)}..."`).join('\n')}

### Position 1 Bullets (${selection.position1.bullets.length} slots)
${p1Content}

### Position 2 Overview
${selection.position2.overview.sources.map((s) => `- [${s.id}] "${s.content.substring(0, 200)}..."`).join('\n')}

### Position 2 Bullets (${selection.position2.bullets.length} slots)
${p2Content}

---

## Your Task

Analyze the selected content against JD requirements and identify coverage gaps. Evaluate:

1. **Requirement Coverage** - How well each requirement is addressed
2. **Positioning Alignment** - Whether content supports the strategic positioning
3. **Honest Gaps** - Requirements we genuinely cannot address with available content
4. **Emphasis Recommendations** - How to optimize existing content for this JD

## Output Format

Return ONLY valid JSON matching this structure:

{
  "overallCoverage": {
    "score": 1-10,
    "assessment": "strong | adequate | weak | poor",
    "summary": "2-3 sentence assessment of coverage quality"
  },
  "requirementCoverage": [
    {
      "requirement": {
        "requirement": "description from JD",
        "category": "experience | skill | leadership | industry | outcome",
        "priority": "critical | important | preferred",
        "jdEvidence": "quote from JD"
      },
      "coverage": "fully_covered | partially_covered | not_covered",
      "coveringSource": "source ID that addresses this, or null",
      "gap": "explanation of what's missing, or null if fully covered",
      "suggestion": "how to address the gap through reframing, or null"
    }
  ],
  "emphasisRecommendations": [
    {
      "slotId": "summary | ch_1 | p1_bullet_2 | etc",
      "sourceId": "recommended source ID",
      "recommendation": "what to emphasize or adjust",
      "reason": "why this serves the JD"
    }
  ],
  "honestGaps": [
    {
      "requirement": "requirement we cannot address",
      "reason": "why no content covers this",
      "mitigation": "how to minimize impact, or null if no mitigation possible"
    }
  ],
  "positioningAlignment": {
    "primaryAngleSupported": true/false,
    "supportingAnglesCovered": ["list of angles with strong content support"],
    "missingAngles": ["angles lacking content support"],
    "narrativeViability": "assessment of whether the narrative direction is achievable"
  },
  "warnings": [
    {
      "type": "missing_critical | weak_coverage | positioning_mismatch",
      "message": "specific warning message",
      "severity": "blocker | warning | info"
    }
  ]
}

## Guidelines

1. **Be specific** - Reference actual content IDs and requirements
2. **Prioritize must-haves** - Critical requirements missing = critical gaps
3. **Consider positioning** - Content may exist but not support the strategic angle
4. **Think about language** - Can the writer naturally incorporate JD terminology?
5. **Be honest about gaps** - Some gaps are real and should be acknowledged
6. **Be actionable** - Every gap should have guidance for resolution or acknowledgment

Return ONLY the JSON object, no markdown, no explanation.`;
}
