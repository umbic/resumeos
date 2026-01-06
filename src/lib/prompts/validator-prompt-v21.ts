/**
 * Validator Prompt for V2.1 - Focuses on honesty, coverage, and quality
 * Format checking is done in code (format-checker.ts)
 */

import { JDStrategy } from '@/types/v2';
import {
  ContentAllocation,
  NarrativeWriterOutput,
  DetailWriterOutput,
} from '@/types/v2.1';

export function buildValidatorPromptV21(
  strategy: JDStrategy,
  allocation: ContentAllocation,
  narrativeOutput: NarrativeWriterOutput,
  detailOutput: DetailWriterOutput
): string {
  // Build source reference map for honesty checking
  const sourceMap = buildSourceMap(allocation);

  // Build requirements list for coverage checking
  const requirements = buildRequirementsList(strategy);

  // Build the resume content for review
  const resumeContent = buildResumeContent(narrativeOutput, detailOutput);

  return `You are a senior resume validation specialist. Your job is to verify the resume meets quality and honesty standards.

## YOUR TASK

Evaluate this resume for:
1. **HONESTY** (0-10): Every metric and claim must match the source material exactly
2. **COVERAGE** (0-10): How well the resume addresses the job requirements
3. **QUALITY** (0-10): Writing clarity, impact, and professionalism

---

## TARGET ROLE

**Company:** ${strategy.company.name}
**Role:** ${strategy.role.title}

---

## JOB REQUIREMENTS TO ADDRESS

${requirements}

---

## SOURCE MATERIAL (for honesty verification)

${sourceMap}

---

## RESUME CONTENT TO VALIDATE

${resumeContent}

---

## VALIDATION INSTRUCTIONS

### 1. HONESTY CHECK
For each metric or specific claim in the resume:
- Find the source ID that was attributed
- Verify the metric matches EXACTLY (no rounding, no inflation)
- Flag any metric that cannot be traced to source material
- Flag any claims that go beyond what the source supports

### 2. COVERAGE CHECK
For each key requirement:
- Determine if it's addressed in the resume
- Rate strength: "strong" (with metrics), "adequate" (mentioned), "weak" (implied), "missing"
- Priority requirements (high) should have strong coverage

### 3. QUALITY CHECK
Evaluate:
- Clarity and readability
- Impact and compelling language
- Professional tone (not corporate-speak)
- Logical flow from summary through positions

---

## OUTPUT FORMAT

Return ONLY valid JSON (no markdown, no explanation):

{
  "honestyScore": 9,
  "coverageScore": 8,
  "qualityScore": 8,

  "metricsVerification": [
    {
      "metric": "10% awareness lift",
      "location": "career-highlight-3",
      "sourceId": "CH-05-V2",
      "sourceValue": "10% awareness lift",
      "match": true
    },
    {
      "metric": "$50M revenue impact",
      "location": "p1-bullet-2",
      "sourceId": "P1-B06-V1",
      "sourceValue": "$45M revenue",
      "match": false,
      "issue": "Resume claims $50M but source says $45M"
    }
  ],

  "requirementsCoverage": [
    {
      "requirement": "strategic brand positioning",
      "priority": "high",
      "covered": true,
      "location": "summary, career-highlight-1",
      "strength": "strong"
    },
    {
      "requirement": "cross-functional leadership",
      "priority": "medium",
      "covered": true,
      "location": "p1-bullet-3",
      "strength": "adequate"
    }
  ],

  "issues": [
    {
      "category": "honesty",
      "severity": "blocker",
      "location": "p1-bullet-2",
      "issue": "Metric inflated from source",
      "evidence": "Resume says $50M, source says $45M",
      "suggestedFix": "Change to $45M to match source"
    },
    {
      "category": "coverage",
      "severity": "warning",
      "location": "entire resume",
      "issue": "High-priority requirement not strongly addressed",
      "evidence": "GTM expertise only mentioned once",
      "suggestedFix": "Add GTM example to career highlights"
    },
    {
      "category": "quality",
      "severity": "suggestion",
      "location": "summary",
      "issue": "Opening could be more impactful",
      "evidence": "Starts with generic language",
      "suggestedFix": "Lead with a distinctive value proposition"
    }
  ]
}

## SCORING GUIDELINES

**Honesty Score:**
- 10: All metrics exactly match sources
- 8-9: Minor discrepancies (rounding, paraphrasing)
- 5-7: Some claims need verification
- 0-4: Multiple fabricated or inflated metrics

**Coverage Score:**
- 10: All high-priority requirements strongly addressed
- 8-9: Most requirements covered, some gaps
- 5-7: Key requirements addressed but weakly
- 0-4: Major requirements missing

**Quality Score:**
- 10: Exceptional writing, compelling narrative
- 8-9: Strong writing with minor improvements possible
- 5-7: Adequate but could be more impactful
- 0-4: Needs significant rewriting

## ISSUE SEVERITY

- **blocker**: Must fix before resume is usable (fabricated metrics, major errors)
- **warning**: Should fix but resume is usable (coverage gaps, awkward phrasing)
- **suggestion**: Optional improvement (word choice, minor polish)

Return ONLY the JSON object.`;
}

/**
 * Build a map of source IDs to their content for verification
 */
function buildSourceMap(allocation: ContentAllocation): string {
  const sources: string[] = [];

  // Summary sources
  allocation.summaries.forEach(s => {
    sources.push(`**${s.contentId}** (Summary source)\n${s.content}`);
  });

  // Career highlight sources
  allocation.careerHighlights.forEach(ch => {
    sources.push(`**${ch.contentId}** (Career Highlight)\n${ch.content}`);
  });

  // P1 sources
  if (allocation.position1Overview) {
    sources.push(`**${allocation.position1Overview.contentId}** (P1 Overview)\n${allocation.position1Overview.content}`);
  }
  allocation.position1Bullets.forEach(b => {
    sources.push(`**${b.contentId}** (P1 Bullet)\n${b.content}`);
  });

  // P2 sources
  if (allocation.position2Overview) {
    sources.push(`**${allocation.position2Overview.contentId}** (P2 Overview)\n${allocation.position2Overview.content}`);
  }
  allocation.position2Bullets.forEach(b => {
    sources.push(`**${b.contentId}** (P2 Bullet)\n${b.content}`);
  });

  return sources.join('\n\n---\n\n');
}

/**
 * Build requirements list from strategy
 */
function buildRequirementsList(strategy: JDStrategy): string {
  const requirements: string[] = [];

  // Must-have requirements (high priority)
  if (strategy.requirements?.mustHave) {
    strategy.requirements.mustHave.forEach((req, i) => {
      const priority = req.priority === 'critical' ? 'high' : 'medium';
      requirements.push(`${i + 1}. ${req.requirement} (${priority} priority)`);
    });
  }

  // Nice-to-have requirements (lower priority)
  if (strategy.requirements?.niceToHave) {
    strategy.requirements.niceToHave.forEach(req => {
      requirements.push(`- ${req.requirement} (low priority)`);
    });
  }

  // Language to mirror
  if (strategy.language?.termsToMirror) {
    strategy.language.termsToMirror.slice(0, 5).forEach(term => {
      requirements.push(`- Mirror: "${term.jdTerm}"`);
    });
  }

  return requirements.join('\n');
}

/**
 * Build resume content for validation
 */
function buildResumeContent(
  narrativeOutput: NarrativeWriterOutput,
  detailOutput: DetailWriterOutput
): string {
  const sections: string[] = [];

  // Summary
  sections.push(`### SUMMARY\n${narrativeOutput.summary.content}\n(Sources: ${narrativeOutput.summary.sourcesUsed.join(', ')})`);

  // Career Highlights
  sections.push(`### CAREER HIGHLIGHTS`);
  narrativeOutput.careerHighlights.forEach((ch, i) => {
    sections.push(`${i + 1}. **${ch.headline}** (Verb: ${ch.primaryVerb}, Source: ${ch.sourceId})\n${ch.content}`);
  });

  // Position 1
  sections.push(`### POSITION 1`);
  sections.push(`**Overview** (Source: ${detailOutput.position1.overview.sourceId}):\n${detailOutput.position1.overview.content}`);
  sections.push(`**Bullets:**`);
  detailOutput.position1.bullets.forEach((b, i) => {
    sections.push(`${i + 1}. (Verb: ${b.primaryVerb}, Source: ${b.sourceId})\n${b.content}`);
  });

  // Position 2
  sections.push(`### POSITION 2`);
  sections.push(`**Overview** (Source: ${detailOutput.position2.overview.sourceId}):\n${detailOutput.position2.overview.content}`);
  sections.push(`**Bullets:**`);
  detailOutput.position2.bullets.forEach((b, i) => {
    sections.push(`${i + 1}. (Verb: ${b.primaryVerb}, Source: ${b.sourceId})\n${b.content}`);
  });

  return sections.join('\n\n');
}
