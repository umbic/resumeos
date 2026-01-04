# Session 4: Gap Detection + Recommendations

> **Time**: 45 minutes
> **Scope**: Detect gaps between JD themes and generated resume, surface recommendations
> **Builds on**: Sessions 1-3

---

## Context

After one-shot generation, the system checks if priority themes were addressed. If not, it surfaces 1-3 recommendations for gaps that could be addressed by reframing existing content.

Key principle: **Only surface gaps that are actionable.** Don't show "you don't have AI experience" — show "your pharma work could be reframed as 'trust messaging for regulated industries' to address the AI safety theme."

---

## Task 1: Create Gap Detection Logic

**File**: `src/lib/gap-detection.ts`

```typescript
import { sql } from '@vercel/postgres';
import { 
  Gap, 
  GapRecommendation, 
  EnhancedJDAnalysis, 
  GeneratedResume 
} from '@/types';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export async function detectGaps(
  jdAnalysis: EnhancedJDAnalysis,
  generatedResume: GeneratedResume
): Promise<Gap[]> {
  const gaps: Gap[] = [];
  
  // Check priority themes only (not secondary)
  for (const theme of jdAnalysis.priority_themes) {
    const isAddressed = generatedResume.themes_addressed.some(
      t => t.toLowerCase().includes(theme.theme.toLowerCase()) ||
           theme.theme.toLowerCase().includes(t.toLowerCase())
    );
    
    if (!isAddressed) {
      // This is a gap — check if it's addressable
      const recommendation = await findReframingOpportunity(theme.theme, generatedResume);
      
      gaps.push({
        id: `gap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        theme: theme.theme,
        severity: 'critical', // Priority themes are always critical
        reason: `JD emphasizes "${theme.theme}" but resume doesn't address it.`,
        recommendation,
        status: 'open',
      });
    }
  }
  
  // Limit to top 3 most important gaps
  return gaps.slice(0, 3);
}

async function findReframingOpportunity(
  theme: string,
  resume: GeneratedResume
): Promise<GapRecommendation | undefined> {
  // Use Claude to identify if any existing content could be reframed
  const prompt = `You are analyzing a resume to find reframing opportunities.

## GAP THEME
The job description emphasizes: "${theme}"
But the resume doesn't explicitly address this.

## CURRENT RESUME CONTENT

### Summary
${resume.summary}

### Career Highlights
${resume.career_highlights.map((h, i) => `${i + 1}. ${h}`).join('\n')}

### Position 1 Overview
${resume.positions[0]?.overview}

### Position 2 Overview  
${resume.positions[1]?.overview}

## YOUR TASK

Is there existing content that could be REFRAMED to address "${theme}"?

Look for:
- Similar concepts described differently
- Adjacent experiences that imply this capability
- Results that demonstrate this skill without naming it

If you find a reframing opportunity, return JSON:
{
  "found": true,
  "affected_sections": ["summary", "position_1_overview"], // which sections to modify
  "suggestion": "Your pharma work (Position 1) demonstrates trust messaging for regulated industries. Reframe to emphasize compliance and safety narrative capabilities.",
  "specific_content": "The J&J pharma work and financial services data privacy experience"
}

If no reasonable reframing exists, return:
{
  "found": false,
  "reason": "No existing content maps to this theme"
}

Return ONLY valid JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const result = JSON.parse(text.trim());

    if (result.found) {
      return {
        affectedSections: result.affected_sections,
        suggestion: result.suggestion,
        contentToReframe: result.specific_content,
      };
    }
    
    return undefined;
  } catch (error) {
    console.error('Error finding reframing opportunity:', error);
    return undefined;
  }
}

export async function addressGap(
  sessionId: string,
  gapId: string,
  resume: GeneratedResume,
  gap: Gap
): Promise<GeneratedResume> {
  if (!gap.recommendation) {
    throw new Error('Gap has no recommendation to address');
  }

  // Generate targeted updates for affected sections
  const prompt = `You are updating specific sections of a resume to address a gap.

## GAP TO ADDRESS
Theme: ${gap.theme}
Suggestion: ${gap.recommendation.suggestion}
Sections to update: ${gap.recommendation.affectedSections.join(', ')}

## CURRENT CONTENT

${gap.recommendation.affectedSections.map(section => {
  if (section === 'summary') return `### Summary\n${resume.summary}`;
  if (section.includes('position')) {
    const posNum = parseInt(section.split('_')[1]);
    const pos = resume.positions.find(p => p.number === posNum);
    return `### Position ${posNum} Overview\n${pos?.overview}`;
  }
  return '';
}).join('\n\n')}

## YOUR TASK

Rewrite ONLY the affected sections to address "${gap.theme}".

Rules:
- Make minimal changes — don't rewrite entirely
- Integrate the theme naturally, don't force it
- Keep all metrics and facts unchanged
- Maximum 40 words per bullet
- Keep executive tone

Return JSON:
{
  "updated_sections": {
    "summary": "new summary text if affected",
    "position_1_overview": "new overview if affected"
  }
}

Only include sections you actually changed. Return ONLY valid JSON.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const updates = JSON.parse(text.trim());

  // Apply updates to resume
  let updatedResume = { ...resume };

  for (const [section, content] of Object.entries(updates.updated_sections)) {
    if (section === 'summary') {
      updatedResume.summary = content as string;
    } else if (section.startsWith('position_')) {
      const posNum = parseInt(section.split('_')[1]);
      updatedResume.positions = resume.positions.map(p => {
        if (p.number === posNum && section.includes('overview')) {
          return { ...p, overview: content as string };
        }
        return p;
      });
    }
  }

  // Mark theme as now addressed
  if (!updatedResume.themes_addressed.includes(gap.theme)) {
    updatedResume.themes_addressed = [...updatedResume.themes_addressed, gap.theme];
  }
  updatedResume.themes_not_addressed = updatedResume.themes_not_addressed.filter(
    t => t !== gap.theme
  );

  return updatedResume;
}
```

---

## Task 2: Create Address Gap API Route

**File**: `src/app/api/address-gap/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { addressGap } from '@/lib/gap-detection';
import { GeneratedResume, Gap } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, gapId } = await request.json();

    if (!sessionId || !gapId) {
      return NextResponse.json(
        { error: 'sessionId and gapId are required' },
        { status: 400 }
      );
    }

    // Get session
    const sessionResult = await sql`
      SELECT generated_resume, gaps
      FROM sessions
      WHERE id = ${sessionId}
    `;

    if (sessionResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const session = sessionResult.rows[0];
    const resume = session.generated_resume as GeneratedResume;
    const gaps = (session.gaps || []) as Gap[];

    // Find the specific gap
    const gap = gaps.find(g => g.id === gapId);
    if (!gap) {
      return NextResponse.json(
        { error: 'Gap not found' },
        { status: 404 }
      );
    }

    if (!gap.recommendation) {
      return NextResponse.json(
        { error: 'This gap has no recommendation to address' },
        { status: 400 }
      );
    }

    // Address the gap
    const updatedResume = await addressGap(sessionId, gapId, resume, gap);

    // Update gap status
    const updatedGaps = gaps.map(g => 
      g.id === gapId ? { ...g, status: 'addressed' as const } : g
    );

    // Save to database
    await sql`
      UPDATE sessions
      SET 
        generated_resume = ${JSON.stringify(updatedResume)}::jsonb,
        gaps = ${JSON.stringify(updatedGaps)}::jsonb,
        updated_at = NOW()
      WHERE id = ${sessionId}
    `;

    return NextResponse.json({
      success: true,
      resume: updatedResume,
      gaps: updatedGaps,
    });

  } catch (error) {
    console.error('Address gap error:', error);
    return NextResponse.json(
      { error: 'Failed to address gap', details: String(error) },
      { status: 500 }
    );
  }
}
```

---

## Task 3: Create Skip Gap API Route

**File**: `src/app/api/skip-gap/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { Gap } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, gapId } = await request.json();

    if (!sessionId || !gapId) {
      return NextResponse.json(
        { error: 'sessionId and gapId are required' },
        { status: 400 }
      );
    }

    // Get session
    const sessionResult = await sql`
      SELECT gaps FROM sessions WHERE id = ${sessionId}
    `;

    if (sessionResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const gaps = (sessionResult.rows[0].gaps || []) as Gap[];

    // Update gap status to skipped
    const updatedGaps = gaps.map(g => 
      g.id === gapId ? { ...g, status: 'skipped' as const } : g
    );

    await sql`
      UPDATE sessions
      SET 
        gaps = ${JSON.stringify(updatedGaps)}::jsonb,
        updated_at = NOW()
      WHERE id = ${sessionId}
    `;

    return NextResponse.json({
      success: true,
      gaps: updatedGaps,
    });

  } catch (error) {
    console.error('Skip gap error:', error);
    return NextResponse.json(
      { error: 'Failed to skip gap', details: String(error) },
      { status: 500 }
    );
  }
}
```

---

## Task 4: Integrate Gap Detection into Generate Resume

**File**: `src/app/api/generate-resume/route.ts`

Add gap detection after generation:

```typescript
import { detectGaps } from '@/lib/gap-detection';

// ... inside POST handler, after generating resume:

// Detect gaps
const gaps = await detectGaps(jdAnalysis, generatedResume);

// Store both resume and gaps
await sql`
  UPDATE sessions
  SET 
    generated_resume = ${JSON.stringify(generatedResume)}::jsonb,
    gaps = ${JSON.stringify(gaps)}::jsonb,
    used_verbs = ${generatedResume.verbs_used || []},
    generation_version = 'v1.5',
    updated_at = NOW()
  WHERE id = ${sessionId}
`;

return NextResponse.json({
  success: true,
  resume: generatedResume,
  gaps,  // Include gaps in response
  themes_addressed: generatedResume.themes_addressed,
  themes_not_addressed: generatedResume.themes_not_addressed,
});
```

---

## Task 5: Create Gap Recommendations Component

**File**: `src/components/resume/GapRecommendations.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Gap } from '@/types';
import { AlertTriangle, Check, X, Loader2 } from 'lucide-react';

interface GapRecommendationsProps {
  gaps: Gap[];
  sessionId: string;
  onGapAddressed: (updatedGaps: Gap[]) => void;
  onResumeUpdated: (resume: any) => void;
}

export function GapRecommendations({ 
  gaps, 
  sessionId, 
  onGapAddressed,
  onResumeUpdated 
}: GapRecommendationsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  
  const openGaps = gaps.filter(g => g.status === 'open');
  
  if (openGaps.length === 0) {
    return null;
  }

  const handleAddress = async (gapId: string) => {
    setLoading(gapId);
    try {
      const response = await fetch('/api/address-gap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, gapId }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        onGapAddressed(data.gaps);
        onResumeUpdated(data.resume);
      }
    } catch (error) {
      console.error('Failed to address gap:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleSkip = async (gapId: string) => {
    setLoading(gapId);
    try {
      const response = await fetch('/api/skip-gap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, gapId }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        onGapAddressed(data.gaps);
      }
    } catch (error) {
      console.error('Failed to skip gap:', error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <h3 className="font-semibold text-amber-900">
          {openGaps.length} Gap{openGaps.length > 1 ? 's' : ''} Identified
        </h3>
      </div>
      
      <p className="text-sm text-amber-700 mb-4">
        These JD themes weren't addressed but could be with minor reframing.
      </p>
      
      <div className="space-y-4">
        {openGaps.map((gap) => (
          <div 
            key={gap.id} 
            className="bg-white border border-amber-200 rounded-md p-3"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="font-medium text-gray-900">{gap.theme}</span>
                <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                  gap.severity === 'critical' 
                    ? 'bg-red-100 text-red-700' 
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {gap.severity}
                </span>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-2">{gap.reason}</p>
            
            {gap.recommendation && (
              <div className="bg-blue-50 rounded p-2 mb-3">
                <p className="text-sm text-blue-800">
                  <strong>Suggestion:</strong> {gap.recommendation.suggestion}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Affects: {gap.recommendation.affectedSections.join(', ')}
                </p>
              </div>
            )}
            
            <div className="flex gap-2">
              {gap.recommendation && (
                <button
                  onClick={() => handleAddress(gap.id)}
                  disabled={loading === gap.id}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading === gap.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Address It
                </button>
              )}
              
              <button
                onClick={() => handleSkip(gap.id)}
                disabled={loading === gap.id}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Skip
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Commit

```bash
git add .
git commit -m "feat: add gap detection and recommendations system"
```

---

## Update HANDOFF.md

```markdown
## Session 4 Complete: Gap Detection + Recommendations

**What was done**:
- Created gap detection logic that identifies unaddressed priority themes
- Gap recommendations suggest specific reframing opportunities
- POST /api/address-gap regenerates affected sections with gap context
- POST /api/skip-gap marks gaps as skipped
- GapRecommendations component for UI

**Key files**:
- src/lib/gap-detection.ts
- src/app/api/address-gap/route.ts
- src/app/api/skip-gap/route.ts
- src/components/resume/GapRecommendations.tsx

**Gap logic**:
- Only priority themes checked (not secondary)
- Maximum 3 gaps surfaced
- Only gaps with reframing opportunities shown
- Uses Claude to identify reframing potential

**Next**: Session 5 — Quality Gate System
```

---

## Success Criteria

- [ ] detectGaps() returns gaps for unaddressed priority themes
- [ ] Only addressable gaps (with recommendations) surfaced
- [ ] POST /api/address-gap updates resume and marks gap addressed
- [ ] POST /api/skip-gap marks gap as skipped
- [ ] GapRecommendations component renders correctly
- [ ] Maximum 3 gaps returned
