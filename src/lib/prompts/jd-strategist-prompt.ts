// ============================================
// ResumeOS V2: JD Strategist Prompt
// ============================================

import type { JDStrategistInput } from '@/types/v2';

export function buildJDStrategistPrompt(input: JDStrategistInput): string {
  return `You are a senior executive resume strategist. Analyze this job description and produce a positioning strategy.

## Job Description
${input.jobDescription}

${input.companyName ? `## Company Name (provided separately)\n${input.companyName}\n` : ''}
${input.targetTitle ? `## Target Title (provided separately)\n${input.targetTitle}\n` : ''}

## Your Task

Analyze this JD to extract:
1. **Company Context** - Industry, culture signals, company-specific language
2. **Role Analysis** - Level, function, scope, stakeholders
3. **Requirements** - Categorized as must-have vs nice-to-have, with priority levels
4. **Positioning Strategy** - Primary angle and supporting angles for the candidate
5. **Language Guidance** - Terms to mirror naturally (NOT keyword stuffing), terms to avoid
6. **Scoring Signals** - Tags for content selection (industries, functions, themes)

## Output Format

Return ONLY valid JSON matching this exact structure:

{
  "company": {
    "name": "string",
    "industry": "string",
    "subIndustry": "string or null",
    "industryKeywords": ["array", "of", "tags"],
    "competitors": ["array or null"],
    "cultureSignals": ["array", "of", "observations"],
    "companySpecificLanguage": ["terms", "unique", "to", "this", "JD"]
  },
  "role": {
    "title": "string",
    "level": "executive | senior | mid | junior",
    "function": "primary function slug (e.g., brand-strategy, product-marketing)",
    "functionKeywords": ["array", "of", "tags"],
    "scope": "description of team size, budget, geography",
    "reportsTo": "string or null",
    "keyStakeholders": ["array", "of", "stakeholders"]
  },
  "requirements": {
    "mustHave": [
      {
        "requirement": "description",
        "category": "experience | skill | leadership | industry | outcome",
        "priority": "critical | important | preferred",
        "jdEvidence": "exact quote from JD"
      }
    ],
    "niceToHave": [
      {
        "requirement": "description",
        "category": "experience | skill | leadership | industry | outcome",
        "priority": "critical | important | preferred",
        "jdEvidence": "exact quote from JD"
      }
    ]
  },
  "positioning": {
    "primaryAngle": {
      "angle": "concise positioning statement",
      "jdEvidence": "why this angle serves the JD",
      "contentImplication": "what to emphasize in the resume"
    },
    "supportingAngles": [
      {
        "angle": "supporting angle",
        "jdEvidence": "supporting evidence",
        "contentImplication": "what to emphasize"
      }
    ],
    "narrativeDirection": "2-3 sentence strategic direction for the resume"
  },
  "language": {
    "termsToMirror": [
      {
        "jdTerm": "term from JD",
        "naturalUsage": "how to use it naturally",
        "context": "where to use it"
      }
    ],
    "termsToAvoid": ["competitor names", "etc"],
    "toneGuidance": "formal, conversational, etc."
  },
  "scoringSignals": {
    "industries": ["tag1", "tag2"],
    "functions": ["tag1", "tag2"],
    "themes": ["tag1", "tag2"]
  }
}

## Important Guidelines

1. **Be specific** - "sports entertainment" not just "entertainment"
2. **Extract real evidence** - Quote the JD, don't paraphrase
3. **Prioritize accurately** - Critical means deal-breaker, not just mentioned first
4. **Think strategically** - The positioning should differentiate, not just match
5. **Language guidance is NOT keyword stuffing** - It's about speaking the company's language naturally

Return ONLY the JSON object, no markdown, no explanation.`;
}
