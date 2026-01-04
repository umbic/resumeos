# Session 5: Quality Gate System

> **Time**: 45 minutes
> **Scope**: Create automated quality checks that run after generation
> **Builds on**: Sessions 1-4

---

## Context

The quality gate runs automatically after one-shot generation. It checks:
- Bullet length (≤40 words)
- Verb repetition (none within position, ≤2x resume)
- Phrase repetition (≤2x resume)
- Jargon patterns (no compound noun soup)

Issues are flagged with severity (error/warning) and auto-fixed when possible.

---

## Task 1: Create Quality Check Logic

**File**: `src/lib/quality-check.ts`

```typescript
import { GeneratedResume, QualityScore, QualityIssue } from '@/types';

// Common action verbs to track
const ACTION_VERBS = [
  'led', 'built', 'drove', 'developed', 'created', 'designed', 'launched',
  'transformed', 'architected', 'pioneered', 'established', 'delivered',
  'scaled', 'accelerated', 'managed', 'directed', 'orchestrated', 'spearheaded',
  'implemented', 'executed', 'negotiated', 'cultivated', 'optimized'
];

// Jargon patterns to flag
const JARGON_PATTERNS = [
  /B2B\s+\w+\s+partner/i,
  /enterprise\s+\w+\s+platform\s+\w+/i,
  /\w+\s+technology\s+\w+\s+brand/i,
  /strategic\s+\w+\s+\w+\s+initiative/i,
];

export function runQualityCheck(resume: GeneratedResume): QualityScore {
  const issues: QualityIssue[] = [];
  
  // Check summary
  issues.push(...checkSummary(resume.summary));
  
  // Check career highlights
  resume.career_highlights.forEach((highlight, index) => {
    issues.push(...checkHighlight(highlight, index + 1));
  });
  
  // Check positions
  resume.positions.forEach(position => {
    issues.push(...checkOverview(position.overview, position.number));
    
    position.bullets?.forEach((bullet, index) => {
      issues.push(...checkBullet(bullet, position.number, index + 1));
    });
  });
  
  // Check verb repetition across resume
  issues.push(...checkVerbRepetition(resume));
  
  // Check phrase repetition across resume
  issues.push(...checkPhraseRepetition(resume));
  
  // Calculate scores
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  
  const overall = calculateGrade(errorCount, warningCount);
  const keywordCoverage = calculateKeywordCoverage(resume);
  const themeAlignment = calculateThemeAlignment(resume);
  
  return {
    overall,
    keyword_coverage: keywordCoverage,
    theme_alignment: themeAlignment,
    issues,
  };
}

function checkSummary(summary: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  
  // Check sentence count (should be 3-4)
  const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 5) {
    issues.push({
      type: 'bullet_length',
      severity: 'warning',
      location: 'summary',
      message: `Summary has ${sentences.length} sentences (target: 3-4)`,
    });
  }
  
  // Check for jargon
  issues.push(...checkJargon(summary, 'summary'));
  
  return issues;
}

function checkHighlight(highlight: string, index: number): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const location = `highlight_${index}`;
  
  // Check word count
  const wordCount = highlight.split(/\s+/).length;
  if (wordCount > 50) {
    issues.push({
      type: 'bullet_length',
      severity: 'warning',
      location,
      message: `Highlight ${index} has ${wordCount} words (consider trimming)`,
    });
  }
  
  // Check for jargon
  issues.push(...checkJargon(highlight, location));
  
  return issues;
}

function checkOverview(overview: string, positionNumber: number): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const location = `position_${positionNumber}_overview`;
  
  // Check for jargon
  issues.push(...checkJargon(overview, location));
  
  return issues;
}

function checkBullet(
  bullet: string, 
  positionNumber: number, 
  bulletNumber: number
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const location = `position_${positionNumber}_bullet_${bulletNumber}`;
  
  // Check word count (HARD LIMIT: 40)
  const wordCount = bullet.split(/\s+/).length;
  if (wordCount > 40) {
    issues.push({
      type: 'bullet_length',
      severity: 'error',
      location,
      message: `Bullet has ${wordCount} words (limit: 40)`,
    });
  } else if (wordCount > 35) {
    issues.push({
      type: 'bullet_length',
      severity: 'warning',
      location,
      message: `Bullet has ${wordCount} words (approaching limit)`,
    });
  }
  
  // Check for jargon
  issues.push(...checkJargon(bullet, location));
  
  return issues;
}

function checkJargon(text: string, location: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  
  for (const pattern of JARGON_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      issues.push({
        type: 'jargon',
        severity: 'warning',
        location,
        message: `Jargon detected: "${match[0]}"`,
      });
    }
  }
  
  return issues;
}

function checkVerbRepetition(resume: GeneratedResume): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const verbUsage: Record<string, string[]> = {};
  
  // Extract all text sections
  const sections = [
    { text: resume.summary, location: 'summary' },
    ...resume.career_highlights.map((h, i) => ({ 
      text: h, 
      location: `highlight_${i + 1}` 
    })),
    ...resume.positions.flatMap(p => [
      { text: p.overview, location: `position_${p.number}_overview` },
      ...(p.bullets || []).map((b, i) => ({ 
        text: b, 
        location: `position_${p.number}_bullet_${i + 1}` 
      })),
    ]),
  ];
  
  // Track verb usage
  for (const { text, location } of sections) {
    const words = text.toLowerCase().split(/\s+/);
    const firstWord = words[0]?.replace(/[^a-z]/g, '');
    
    for (const verb of ACTION_VERBS) {
      if (firstWord === verb || text.toLowerCase().includes(` ${verb} `)) {
        if (!verbUsage[verb]) {
          verbUsage[verb] = [];
        }
        verbUsage[verb].push(location);
      }
    }
  }
  
  // Check for violations
  for (const [verb, locations] of Object.entries(verbUsage)) {
    // Check within-position repetition
    const positionGroups: Record<string, string[]> = {};
    for (const loc of locations) {
      const posMatch = loc.match(/position_(\d+)/);
      if (posMatch) {
        const posKey = `position_${posMatch[1]}`;
        if (!positionGroups[posKey]) {
          positionGroups[posKey] = [];
        }
        positionGroups[posKey].push(loc);
      }
    }
    
    for (const [position, locs] of Object.entries(positionGroups)) {
      if (locs.length > 1) {
        issues.push({
          type: 'verb_repetition',
          severity: 'error',
          location: position,
          message: `"${verb}" used ${locs.length}x within same position: ${locs.join(', ')}`,
        });
      }
    }
    
    // Check resume-wide repetition (>2x)
    if (locations.length > 2) {
      issues.push({
        type: 'verb_repetition',
        severity: 'warning',
        location: 'resume',
        message: `"${verb}" used ${locations.length}x total (max: 2): ${locations.join(', ')}`,
      });
    }
  }
  
  return issues;
}

function checkPhraseRepetition(resume: GeneratedResume): QualityIssue[] {
  const issues: QualityIssue[] = [];
  
  // Common phrases to track
  const phrasesToTrack = [
    'strategic storytelling',
    'executive narratives',
    'gtm alignment',
    'go-to-market',
    'cross-functional',
    'brand transformation',
    'enterprise buyer',
    'measurable impact',
    'business value',
  ];
  
  // Combine all text
  const allText = [
    resume.summary,
    ...resume.career_highlights,
    ...resume.positions.flatMap(p => [
      p.overview,
      ...(p.bullets || []),
    ]),
  ].join(' ').toLowerCase();
  
  for (const phrase of phrasesToTrack) {
    const regex = new RegExp(phrase, 'gi');
    const matches = allText.match(regex);
    
    if (matches && matches.length > 2) {
      issues.push({
        type: 'phrase_repetition',
        severity: 'warning',
        location: 'resume',
        message: `"${phrase}" used ${matches.length}x (max: 2)`,
      });
    }
  }
  
  return issues;
}

function calculateGrade(errors: number, warnings: number): QualityScore['overall'] {
  if (errors === 0 && warnings === 0) return 'A';
  if (errors === 0 && warnings <= 2) return 'A';
  if (errors === 0 && warnings <= 4) return 'B';
  if (errors <= 1 && warnings <= 4) return 'B';
  if (errors <= 2 && warnings <= 6) return 'C';
  if (errors <= 4) return 'D';
  return 'F';
}

function calculateKeywordCoverage(resume: GeneratedResume): number {
  // This would compare to JD keywords — simplified version
  const addressed = resume.themes_addressed?.length || 0;
  const total = addressed + (resume.themes_not_addressed?.length || 0);
  
  if (total === 0) return 100;
  return Math.round((addressed / total) * 100);
}

function calculateThemeAlignment(resume: GeneratedResume): number {
  // Based on themes addressed
  const addressed = resume.themes_addressed?.length || 0;
  const notAddressed = resume.themes_not_addressed?.length || 0;
  const total = addressed + notAddressed;
  
  if (total === 0) return 100;
  return Math.round((addressed / total) * 100);
}
```

---

## Task 2: Create Auto-Fix Logic

**File**: `src/lib/quality-fix.ts`

```typescript
import { GeneratedResume, QualityIssue } from '@/types';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export async function autoFixIssues(
  resume: GeneratedResume,
  issues: QualityIssue[]
): Promise<{ resume: GeneratedResume; fixedIssues: QualityIssue[] }> {
  let fixedResume = { ...resume };
  const fixedIssues: QualityIssue[] = [];
  
  // Group issues by location for batch fixing
  const bulletLengthIssues = issues.filter(
    i => i.type === 'bullet_length' && i.severity === 'error'
  );
  
  // Fix overlong bullets
  for (const issue of bulletLengthIssues) {
    const match = issue.location.match(/position_(\d+)_bullet_(\d+)/);
    if (match) {
      const posNum = parseInt(match[1]);
      const bulletNum = parseInt(match[2]);
      
      const position = fixedResume.positions.find(p => p.number === posNum);
      if (position?.bullets) {
        const originalBullet = position.bullets[bulletNum - 1];
        const fixedBullet = await shortenBullet(originalBullet);
        
        fixedResume.positions = fixedResume.positions.map(p => {
          if (p.number !== posNum) return p;
          return {
            ...p,
            bullets: p.bullets?.map((b, i) => 
              i === bulletNum - 1 ? fixedBullet : b
            ),
          };
        });
        
        fixedIssues.push({ ...issue, autoFixed: true });
      }
    }
  }
  
  return { resume: fixedResume, fixedIssues };
}

async function shortenBullet(bullet: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Shorten this resume bullet to 40 words or less while preserving all metrics and key facts:

"${bullet}"

Rules:
- Keep all numbers and metrics exactly
- Keep the action verb at the start
- Cut filler words and phrases
- Combine ideas efficiently
- One sentence maximum

Return ONLY the shortened bullet, nothing else.`,
    }],
  });
  
  return response.content[0].type === 'text' 
    ? response.content[0].text.trim() 
    : bullet;
}
```

---

## Task 3: Integrate Quality Check into Generate Resume

**File**: `src/app/api/generate-resume/route.ts`

Add quality check after generation:

```typescript
import { runQualityCheck } from '@/lib/quality-check';
import { autoFixIssues } from '@/lib/quality-fix';

// ... inside POST handler, after generating resume:

// Run quality check
let qualityScore = runQualityCheck(generatedResume);

// Auto-fix critical issues
let finalResume = generatedResume;
if (qualityScore.issues.some(i => i.severity === 'error')) {
  const { resume: fixedResume, fixedIssues } = await autoFixIssues(
    generatedResume, 
    qualityScore.issues
  );
  finalResume = fixedResume;
  
  // Re-run quality check after fixes
  qualityScore = runQualityCheck(finalResume);
  
  // Mark fixed issues
  qualityScore.issues = qualityScore.issues.map(issue => {
    const wasFixed = fixedIssues.some(
      f => f.location === issue.location && f.type === issue.type
    );
    return wasFixed ? { ...issue, autoFixed: true } : issue;
  });
}

// Detect gaps
const gaps = await detectGaps(jdAnalysis, finalResume);

// Store everything
await sql`
  UPDATE sessions
  SET 
    generated_resume = ${JSON.stringify(finalResume)}::jsonb,
    gaps = ${JSON.stringify(gaps)}::jsonb,
    quality_score = ${JSON.stringify(qualityScore)}::jsonb,
    used_verbs = ${finalResume.verbs_used || []},
    generation_version = 'v1.5',
    updated_at = NOW()
  WHERE id = ${sessionId}
`;

return NextResponse.json({
  success: true,
  resume: finalResume,
  gaps,
  quality_score: qualityScore,
  themes_addressed: finalResume.themes_addressed,
  themes_not_addressed: finalResume.themes_not_addressed,
});
```

---

## Task 4: Create Quality Indicator Component

**File**: `src/components/resume/QualityIndicator.tsx`

```typescript
'use client';

import { QualityScore } from '@/types';
import { CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface QualityIndicatorProps {
  score: QualityScore;
  showDetails?: boolean;
}

export function QualityIndicator({ score, showDetails = false }: QualityIndicatorProps) {
  const gradeColors: Record<string, string> = {
    'A': 'bg-green-100 text-green-800 border-green-300',
    'B': 'bg-blue-100 text-blue-800 border-blue-300',
    'C': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'D': 'bg-orange-100 text-orange-800 border-orange-300',
    'F': 'bg-red-100 text-red-800 border-red-300',
  };

  const errorCount = score.issues.filter(i => i.severity === 'error').length;
  const warningCount = score.issues.filter(i => i.severity === 'warning').length;

  return (
    <div className="space-y-3">
      {/* Grade Badge */}
      <div className="flex items-center gap-4">
        <div className={`px-4 py-2 rounded-lg border-2 ${gradeColors[score.overall]}`}>
          <span className="text-2xl font-bold">{score.overall}</span>
        </div>
        
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Keywords:</span>
            <span className="font-medium">{score.keyword_coverage}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Themes:</span>
            <span className="font-medium">{score.theme_alignment}%</span>
          </div>
        </div>
      </div>

      {/* Issue Summary */}
      {(errorCount > 0 || warningCount > 0) && (
        <div className="flex gap-3 text-sm">
          {errorCount > 0 && (
            <div className="flex items-center gap-1 text-red-600">
              <AlertCircle className="h-4 w-4" />
              {errorCount} error{errorCount > 1 ? 's' : ''}
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center gap-1 text-yellow-600">
              <AlertTriangle className="h-4 w-4" />
              {warningCount} warning{warningCount > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Issue Details */}
      {showDetails && score.issues.length > 0 && (
        <div className="mt-3 space-y-2">
          {score.issues.map((issue, index) => (
            <div
              key={index}
              className={`flex items-start gap-2 p-2 rounded text-sm ${
                issue.severity === 'error' 
                  ? 'bg-red-50 text-red-800' 
                  : 'bg-yellow-50 text-yellow-800'
              }`}
            >
              {issue.severity === 'error' ? (
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <span className="font-medium">{issue.location}:</span>{' '}
                {issue.message}
                {issue.autoFixed && (
                  <span className="ml-2 text-green-600 text-xs">(auto-fixed)</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All Clear */}
      {score.issues.length === 0 && (
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <CheckCircle className="h-4 w-4" />
          All quality checks passed
        </div>
      )}
    </div>
  );
}
```

---

## Commit

```bash
git add .
git commit -m "feat: add quality gate system with auto-fix"
```

---

## Update HANDOFF.md

```markdown
## Session 5 Complete: Quality Gate System

**What was done**:
- Created runQualityCheck() that validates generated resume
- Checks: bullet length, verb repetition, phrase repetition, jargon
- Created autoFixIssues() that fixes critical errors automatically
- Quality score calculated (A-F grade)
- QualityIndicator component shows score and issues

**Quality checks**:
- Bullet length: Error if >40 words, warning if >35
- Verb repetition: Error if same verb within position, warning if >2x resume
- Phrase repetition: Warning if common phrase >2x resume
- Jargon: Warning if compound noun patterns detected

**Auto-fix**:
- Only bullet length errors auto-fixed currently
- Uses Claude to shorten while preserving metrics

**Next**: Session 6 — UI Overhaul
```

---

## Success Criteria

- [ ] runQualityCheck() returns QualityScore with issues
- [ ] Bullet length violations detected correctly
- [ ] Verb repetition detected (within position and resume-wide)
- [ ] Phrase repetition detected
- [ ] Auto-fix shortens overlong bullets
- [ ] Quality grade calculated correctly
- [ ] QualityIndicator component renders issues
