# Session 3: One-Shot API Route

> **Time**: 45 minutes
> **Scope**: Create the API endpoint that generates a complete resume in one call
> **Builds on**: Session 1 (types) + Session 2 (prompt)

---

## Context

This route replaces the multiple generate-section calls with a single endpoint that produces the complete resume.

---

## Task 1: Create Generate Resume Route

**File**: `src/app/api/generate-resume/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { generateFullResume } from '@/lib/claude';
import { GeneratedResume, EnhancedJDAnalysis } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get session with JD analysis
    const sessionResult = await sql`
      SELECT 
        id,
        job_description,
        target_title,
        target_company,
        jd_analysis,
        format,
        branding_mode
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

    // Ensure JD has been analyzed
    if (!session.jd_analysis) {
      return NextResponse.json(
        { error: 'Job description must be analyzed first' },
        { status: 400 }
      );
    }

    const jdAnalysis = session.jd_analysis as EnhancedJDAnalysis;
    const format = (session.format || 'long') as 'long' | 'short';
    const brandingMode = (session.branding_mode || 'branded') as 'branded' | 'generic';

    // Generate complete resume
    const generatedResume = await generateFullResume({
      jdAnalysis,
      format,
      brandingMode,
      targetCompany: session.target_company || '',
    });

    // Store the generated resume
    await sql`
      UPDATE sessions
      SET 
        generated_resume = ${JSON.stringify(generatedResume)}::jsonb,
        used_verbs = ${generatedResume.verbs_used || []},
        generation_version = 'v1.5',
        updated_at = NOW()
      WHERE id = ${sessionId}
    `;

    return NextResponse.json({
      success: true,
      resume: generatedResume,
      themes_addressed: generatedResume.themes_addressed,
      themes_not_addressed: generatedResume.themes_not_addressed,
    });

  } catch (error) {
    console.error('Generate resume error:', error);
    return NextResponse.json(
      { error: 'Failed to generate resume', details: String(error) },
      { status: 500 }
    );
  }
}
```

---

## Task 2: Update Analyze JD Route for Enhanced Analysis

**File**: `src/app/api/analyze-jd/route.ts`

Modify to produce the enhanced JD analysis with theme ranking:

```typescript
// Update the Claude prompt for JD analysis to include theme ranking
const analysisPrompt = `Analyze this job description and extract structured information.

JOB DESCRIPTION:
${jobDescription}

Return JSON with this structure:
{
  "target_title": "exact job title",
  "target_company": "company name",
  "priority_themes": [
    {
      "theme": "theme name",
      "importance": "must_have",
      "jd_evidence": "quote from JD that shows this is critical"
    }
  ],
  "secondary_themes": [
    {
      "theme": "theme name", 
      "importance": "nice_to_have",
      "jd_evidence": "quote from JD"
    }
  ],
  "ats_keywords": ["keyword1", "keyword2", ...]
}

RULES FOR THEME RANKING:
- "must_have" themes appear in:
  - Job title
  - First 3 responsibilities
  - "Required" qualifications
  - Repeated multiple times
  
- "nice_to_have" themes appear in:
  - "Preferred" or "Nice to have" sections
  - Later in the responsibilities list
  - Mentioned only once

Extract 3-5 priority themes and 3-5 secondary themes.
Extract 10-15 ATS keywords (nouns and noun phrases).

Return ONLY valid JSON.`;
```

Add the theme-to-content mapping after analysis:

```typescript
// After getting the analysis, map themes to content
async function mapThemesToContent(
  analysis: EnhancedJDAnalysis
): Promise<ContentMapping[]> {
  const mappings: ContentMapping[] = [];
  
  for (const theme of [...analysis.priority_themes, ...analysis.secondary_themes]) {
    // Search content database for items that could address this theme
    const matchingContent = await sql`
      SELECT id, category_tags, function_tags, outcome_tags
      FROM content_items
      WHERE 
        ${theme.theme} = ANY(category_tags)
        OR ${theme.theme} = ANY(function_tags)
        OR ${theme.theme} = ANY(outcome_tags)
    `;
    
    if (matchingContent.rows.length > 0) {
      mappings.push({
        theme: theme.theme,
        content_ids: matchingContent.rows.map(r => r.id),
      });
    }
  }
  
  return mappings;
}
```

---

## Task 3: Create Refine Route (for chat refinements)

**File**: `src/app/api/refine/route.ts`

This handles post-generation refinements via chat:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import Anthropic from '@anthropic-ai/sdk';
import { GeneratedResume } from '@/types';

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const { 
      sessionId, 
      section, // 'summary' | 'highlight_1' | 'position_1_overview' | 'position_1_bullet_1' etc.
      instruction,
      conversationHistory = []
    } = await request.json();

    if (!sessionId || !section || !instruction) {
      return NextResponse.json(
        { error: 'sessionId, section, and instruction are required' },
        { status: 400 }
      );
    }

    // Get current resume
    const sessionResult = await sql`
      SELECT generated_resume, jd_analysis, used_verbs, used_phrases
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
    const usedVerbs = session.used_verbs || [];
    const usedPhrases = session.used_phrases || [];

    // Get current content for this section
    const currentContent = extractSectionContent(resume, section);

    // Build refinement prompt
    const prompt = buildRefinementPrompt({
      section,
      currentContent,
      instruction,
      conversationHistory,
      usedVerbs,
      usedPhrases,
      jdAnalysis: session.jd_analysis,
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        { role: 'user', content: prompt },
      ],
    });

    const refinedContent = response.content[0].type === 'text' 
      ? response.content[0].text.trim()
      : '';

    // Update the resume with refined content
    const updatedResume = updateSectionContent(resume, section, refinedContent);

    // Save back to database
    await sql`
      UPDATE sessions
      SET 
        generated_resume = ${JSON.stringify(updatedResume)}::jsonb,
        updated_at = NOW()
      WHERE id = ${sessionId}
    `;

    return NextResponse.json({
      success: true,
      section,
      refined_content: refinedContent,
      resume: updatedResume,
    });

  } catch (error) {
    console.error('Refine error:', error);
    return NextResponse.json(
      { error: 'Failed to refine content', details: String(error) },
      { status: 500 }
    );
  }
}

function extractSectionContent(resume: GeneratedResume, section: string): string {
  if (section === 'summary') {
    return resume.summary;
  }
  
  if (section.startsWith('highlight_')) {
    const index = parseInt(section.split('_')[1]) - 1;
    return resume.career_highlights[index] || '';
  }
  
  if (section.startsWith('position_')) {
    const parts = section.split('_');
    const posNum = parseInt(parts[1]);
    const position = resume.positions.find(p => p.number === posNum);
    
    if (!position) return '';
    
    if (parts[2] === 'overview') {
      return position.overview;
    }
    
    if (parts[2] === 'bullet') {
      const bulletIndex = parseInt(parts[3]) - 1;
      return position.bullets?.[bulletIndex] || '';
    }
  }
  
  return '';
}

function updateSectionContent(
  resume: GeneratedResume, 
  section: string, 
  newContent: string
): GeneratedResume {
  const updated = { ...resume };
  
  if (section === 'summary') {
    updated.summary = newContent;
  } else if (section.startsWith('highlight_')) {
    const index = parseInt(section.split('_')[1]) - 1;
    updated.career_highlights = [...resume.career_highlights];
    updated.career_highlights[index] = newContent;
  } else if (section.startsWith('position_')) {
    const parts = section.split('_');
    const posNum = parseInt(parts[1]);
    
    updated.positions = resume.positions.map(p => {
      if (p.number !== posNum) return p;
      
      const updatedPos = { ...p };
      
      if (parts[2] === 'overview') {
        updatedPos.overview = newContent;
      } else if (parts[2] === 'bullet' && updatedPos.bullets) {
        const bulletIndex = parseInt(parts[3]) - 1;
        updatedPos.bullets = [...updatedPos.bullets];
        updatedPos.bullets[bulletIndex] = newContent;
      }
      
      return updatedPos;
    });
  }
  
  return updated;
}

function buildRefinementPrompt(input: {
  section: string;
  currentContent: string;
  instruction: string;
  conversationHistory: Array<{ role: string; content: string }>;
  usedVerbs: string[];
  usedPhrases: string[];
  jdAnalysis: any;
}): string {
  return `You are refining a section of an executive resume.

## CURRENT CONTENT
${input.currentContent}

## USER INSTRUCTION
${input.instruction}

## CONVERSATION HISTORY
${input.conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}

## RULES (Still Apply)
- Maximum 40 words for bullets
- Preserve all metrics and facts
- Don't use these verbs (already used): ${input.usedVerbs.join(', ')}
- Don't use these phrases more than 2x: ${input.usedPhrases.join(', ')}
- Keep language executive-level, not robotic

## JD CONTEXT
Target: ${input.jdAnalysis?.target_title} at ${input.jdAnalysis?.target_company}
Priority themes: ${input.jdAnalysis?.priority_themes?.map((t: any) => t.theme).join(', ')}

Return ONLY the refined content. No explanation, no markdown, just the text.`;
}
```

---

## Commit

```bash
git add .
git commit -m "feat: add one-shot generate-resume and refine API routes"
```

---

## Update HANDOFF.md

```markdown
## Session 3 Complete: One-Shot API Route

**What was done**:
- Created POST /api/generate-resume — single call generates complete resume
- Enhanced /api/analyze-jd — now produces priority/secondary theme ranking
- Created POST /api/refine — handles chat-based refinements

**API Changes**:
- NEW: /api/generate-resume
- NEW: /api/refine  
- MODIFIED: /api/analyze-jd (enhanced output)
- OLD: /api/generate-section (still works for backward compat)

**Next**: Session 4 — Gap Detection + Recommendations
```

---

## Success Criteria

- [ ] POST /api/generate-resume returns complete resume JSON
- [ ] Resume includes all 6 positions with correct structure
- [ ] themes_addressed and themes_not_addressed populated
- [ ] POST /api/refine can update any section
- [ ] Existing V1 routes still work

---

## Test Locally

```bash
# Start dev server
npm run dev

# Test generate-resume (need a session with analyzed JD first)
curl -X POST http://localhost:3000/api/generate-resume \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "your-session-id"}'
```
