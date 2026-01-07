// src/lib/v3/prompts/jd-analyzer.ts
// JD Analyzer prompt for V3 pipeline

import type { JDAnalyzerOutput } from '../types';

export function buildJDAnalyzerPrompt(jobDescription: string): string {
  return `You are an expert job description analyst preparing to customize a senior executive's resume. Your task is to deeply analyze this job description and extract structured information that will guide resume customization.

## JOB DESCRIPTION

${jobDescription}

## YOUR TASK

Analyze this job description and produce a comprehensive analysis in JSON format. Be thorough and specific - the quality of resume customization depends on your analysis.

## ANALYSIS REQUIREMENTS

### 1. Metadata
Extract basic job information:
- Company name
- Job title
- Industry (be specific: "Financial Services / Fintech" not just "Finance")
- Level (VP, SVP, Director, etc.)
- Location (if mentioned)
- Reports to (if mentioned)

### 2. Sections
Break the JD into logical sections (e.g., "Overview", "Key Responsibilities", "Requirements", "Qualifications", "Nice to Have"). For each section:
- Provide a brief summary (1-2 sentences)
- Extract 5-10 key phrases that are important for ATS matching and demonstrating fit
- Weight each phrase as HIGH, MEDIUM, or LOW based on:
  - HIGH: Appears multiple times, in title, or explicitly marked as "required"/"must have"
  - MEDIUM: Important skill or experience mentioned clearly
  - LOW: Nice-to-have or mentioned only once in passing

### 3. Global Phrase Frequency
Identify phrases that appear multiple times across the JD. These are high-signal terms that should appear in the resume.

### 4. Themes
Identify 3-5 major themes the employer cares about. For each theme:
- Name the theme clearly (e.g., "Brand-Led Growth", "Cross-Functional Leadership")
- Provide evidence from the JD (specific quotes or requirements)
- Assign priority: Critical, High, Medium, or Low

### 5. Section-to-Resume Mapping
For each JD section, indicate which resume sections would best address it:
- Summary: High-level positioning and value prop
- CH (Career Highlights): Proof points and achievements
- P1 (Current/Most Recent Role): Detailed accomplishments
- P2 (Previous Role): Supporting evidence of pattern
- P3-P6 (Earlier Roles): Career trajectory

### 6. Gaps
Identify requirements where a brand strategy executive might have weaker credentials:
- Technical skills outside typical brand/marketing scope
- Industry-specific certifications
- Very specific tool requirements
Rate risk as High, Medium, or Low and suggest mitigation notes.

## OUTPUT FORMAT

Return ONLY valid JSON matching this structure:

\`\`\`json
{
  "metadata": {
    "company": "Company Name",
    "title": "Job Title",
    "industry": "Industry / Sub-industry",
    "level": "VP/SVP/Director/etc",
    "location": "City, State or Remote",
    "reportsTo": "CMO/CEO/etc or null"
  },
  "sections": [
    {
      "name": "Section Name",
      "summary": "Brief 1-2 sentence summary of this section",
      "keyPhrases": [
        { "phrase": "exact phrase from JD", "weight": "HIGH" },
        { "phrase": "another phrase", "weight": "MEDIUM" },
        { "phrase": "less critical phrase", "weight": "LOW" }
      ]
    }
  ],
  "globalPhraseFrequency": [
    {
      "phrase": "repeated phrase",
      "count": 3,
      "sectionsFound": ["Overview", "Requirements"]
    }
  ],
  "themes": [
    {
      "theme": "Theme Name",
      "evidence": ["quote or requirement 1", "quote or requirement 2"],
      "priority": "Critical"
    }
  ],
  "sectionToResumeMapping": [
    {
      "jdSection": "Key Responsibilities",
      "bestAddressedBy": ["CH", "P1"]
    }
  ],
  "gaps": [
    {
      "requirement": "Specific technical skill or experience",
      "riskLevel": "High",
      "notes": "Mitigation strategy or how to address"
    }
  ]
}
\`\`\`

## IMPORTANT GUIDELINES

1. **Extract exact phrases** - Don't paraphrase. The resume will mirror these phrases for ATS matching.
2. **Be generous with HIGH weights** - When in doubt, mark as HIGH. Missing a keyword is worse than over-targeting.
3. **Think like a recruiter** - What would make them say "this candidate gets it"?
4. **Consider implicit requirements** - A "brand strategy" role implies cross-functional collaboration even if not stated.
5. **Be specific in themes** - "Growth mindset" is too vague. "Brand-Led Revenue Growth" is better.

Return ONLY the JSON object. No markdown formatting, no explanations before or after.`;
}

// Type guard to validate JD analyzer output structure
export function isValidJDAnalyzerOutput(data: unknown): data is JDAnalyzerOutput {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  // Check required top-level fields
  if (!obj.metadata || typeof obj.metadata !== 'object') return false;
  if (!Array.isArray(obj.sections)) return false;
  if (!Array.isArray(obj.themes)) return false;
  if (!Array.isArray(obj.sectionToResumeMapping)) return false;

  // Check metadata
  const metadata = obj.metadata as Record<string, unknown>;
  if (typeof metadata.company !== 'string') return false;
  if (typeof metadata.title !== 'string') return false;

  return true;
}

// Parse Claude's response into typed output
export function parseJDAnalyzerResponse(response: string): JDAnalyzerOutput {
  // Clean up response - remove markdown code blocks if present
  const cleaned = response
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  const parsed = JSON.parse(cleaned);

  if (!isValidJDAnalyzerOutput(parsed)) {
    throw new Error('Invalid JD analyzer output structure');
  }

  // Ensure arrays have defaults
  return {
    metadata: parsed.metadata,
    sections: parsed.sections || [],
    globalPhraseFrequency: parsed.globalPhraseFrequency || [],
    themes: parsed.themes || [],
    sectionToResumeMapping: parsed.sectionToResumeMapping || [],
    gaps: parsed.gaps || [],
  };
}
