# ResumeOS V2: Build Deterministic Scoring Engine

## Overview

Replace the current one-shot Claude generation with a two-step pipeline:
1. **Code-based selection** — Deterministic scoring selects content
2. **Claude rewriting** — LLM only reshapes language, doesn't select

This separates "what to include" (deterministic) from "how to say it" (creative).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: JD Analysis (Claude) — NO CHANGE                       │
│  Already works. Extracts industry, functions, themes, keywords  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Content Selection (NEW — Code, not LLM)                │
│                                                                 │
│  Input: JD analysis                                             │
│  Process:                                                       │
│    1. Score all base items by industry_tags overlap             │
│    2. Score by function_tags overlap                            │
│    3. Pick top 5 CH, top 4 P1, top 3 P2                        │
│    4. For each selected base, score variants by theme_tags      │
│    5. Pick best variant for each                                │
│    6. Enforce CONFLICT_MAP                                      │
│                                                                 │
│  Output: 12 selected content items with variant IDs             │
│  Properties: Deterministic, fast (<100ms), debuggable           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: Rewrite Only (Claude — SIMPLIFIED)                     │
│                                                                 │
│  Input:                                                         │
│    - JD keywords and priority themes                            │
│    - ONLY the 12 pre-selected content items                     │
│    - Quality rules (word limits, verb variety)                  │
│                                                                 │
│  Claude's task: Reshape language to match JD terminology        │
│  Claude does NOT select content — already done                  │
│                                                                 │
│  Output: Rewritten resume content                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## File 1: Create `src/lib/content-selector.ts`

This is the core scoring engine. Create this new file:

```typescript
import { db } from './db';
import { contentItems } from '@/drizzle/schema';
import { CONFLICT_MAP } from './rules';
import { eq, like, or, and, sql } from 'drizzle-orm';

// Types
export interface JDRequirements {
  industry: string;
  industries: string[];      // e.g., ["financial-services", "B2B", "payments"]
  functions: string[];       // e.g., ["product-marketing", "demand-generation"]
  themes: string[];          // e.g., ["revenue-growth", "GTM", "team-leadership"]
  keywords: string[];        // e.g., ["funnel", "pipeline", "enablement"]
}

export interface ScoredItem {
  id: string;
  baseId: string;
  variantId: string | null;
  variantLabel: string | null;
  industryScore: number;
  functionScore: number;
  themeScore: number;
  totalScore: number;
  content: string;
  contentShort: string | null;
  contentMedium: string | null;
  contentLong: string | null;
}

export interface SelectionResult {
  summary: ScoredItem | null;
  careerHighlights: ScoredItem[];
  position1Bullets: ScoredItem[];
  position2Bullets: ScoredItem[];
  debug: {
    jdRequirements: JDRequirements;
    allScores: { id: string; industry: number; function: number; theme: number; total: number }[];
    blockedByConflict: string[];
  };
}

/**
 * Extract JD requirements from EnhancedJDAnalysis
 */
export function extractJDRequirements(jdAnalysis: any): JDRequirements {
  // Normalize industry to array of tags
  const industryStr = (jdAnalysis.industry || '').toLowerCase();
  const industries: string[] = [];
  
  // Map common industry terms to tags
  if (industryStr.includes('financial') || industryStr.includes('banking') || industryStr.includes('payment')) {
    industries.push('financial-services', 'banking', 'payments');
  }
  if (industryStr.includes('health') || industryStr.includes('pharma')) {
    industries.push('healthcare', 'pharma');
  }
  if (industryStr.includes('tech') || industryStr.includes('software') || industryStr.includes('saas')) {
    industries.push('technology', 'enterprise-software');
  }
  if (industryStr.includes('consumer') || industryStr.includes('retail') || industryStr.includes('cpg')) {
    industries.push('consumer', 'retail', 'CPG');
  }
  if (industryStr.includes('consulting') || industryStr.includes('professional')) {
    industries.push('professional-services', 'consulting');
  }
  
  // Always check for B2B/B2C signals
  if (industryStr.includes('b2b') || industryStr.includes('enterprise')) {
    industries.push('B2B');
  }
  if (industryStr.includes('b2c') || industryStr.includes('consumer')) {
    industries.push('B2C', 'consumer');
  }
  
  // Extract functions from role_functions or target_title
  const functions: string[] = jdAnalysis.role_functions || [];
  const title = (jdAnalysis.target_title || '').toLowerCase();
  
  // Infer functions from title if not provided
  if (title.includes('product marketing') || title.includes('product marketer')) {
    if (!functions.includes('product-marketing')) functions.push('product-marketing');
  }
  if (title.includes('brand')) {
    if (!functions.includes('brand-strategy')) functions.push('brand-strategy');
  }
  if (title.includes('growth') || title.includes('demand')) {
    if (!functions.includes('demand-generation')) functions.push('demand-generation');
    if (!functions.includes('growth-strategy')) functions.push('growth-strategy');
  }
  if (title.includes('gtm') || title.includes('go-to-market')) {
    if (!functions.includes('go-to-market')) functions.push('go-to-market');
  }
  
  // Extract themes from priority_themes
  const themes: string[] = [];
  const priorityThemes = jdAnalysis.priority_themes || [];
  for (const t of priorityThemes) {
    const themeName = typeof t === 'string' ? t : t.theme;
    if (themeName) {
      // Normalize theme to tag format
      const normalized = themeName.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      themes.push(normalized);
      
      // Also add component words for partial matching
      const words = themeName.toLowerCase().split(/\s+/);
      words.forEach(w => {
        if (w.length > 3 && !themes.includes(w)) themes.push(w);
      });
    }
  }
  
  // Extract keywords
  const keywords: string[] = (jdAnalysis.ats_keywords || []).map((k: any) => 
    typeof k === 'string' ? k.toLowerCase() : (k.keyword || '').toLowerCase()
  );
  
  return {
    industry: jdAnalysis.industry || '',
    industries: [...new Set(industries)],
    functions: [...new Set(functions.map(f => f.toLowerCase()))],
    themes: [...new Set(themes)],
    keywords: [...new Set(keywords)],
  };
}

/**
 * Score industry match (Level 1)
 * Direct match = 3, Related match = 1
 */
function scoreIndustry(itemTags: string[], jdIndustries: string[]): number {
  if (!itemTags || itemTags.length === 0) return 0;
  
  const normalizedItem = itemTags.map(t => t.toLowerCase());
  const normalizedJD = jdIndustries.map(t => t.toLowerCase());
  
  let score = 0;
  for (const jdTag of normalizedJD) {
    if (normalizedItem.includes(jdTag)) {
      score += 3; // Direct match
    } else {
      // Check for partial/related matches
      for (const itemTag of normalizedItem) {
        if (itemTag.includes(jdTag) || jdTag.includes(itemTag)) {
          score += 1;
          break;
        }
      }
    }
  }
  
  return Math.min(score, 9); // Cap at 9 to prevent runaway scores
}

/**
 * Score function match (Level 2)
 * Direct match = 3, Related match = 1
 */
function scoreFunction(itemTags: string[], jdFunctions: string[]): number {
  if (!itemTags || itemTags.length === 0) return 0;
  
  const normalizedItem = itemTags.map(t => t.toLowerCase());
  const normalizedJD = jdFunctions.map(t => t.toLowerCase());
  
  let score = 0;
  for (const jdFunc of normalizedJD) {
    if (normalizedItem.includes(jdFunc)) {
      score += 3; // Direct match
    } else {
      // Check for related functions
      for (const itemFunc of normalizedItem) {
        if (itemFunc.includes(jdFunc) || jdFunc.includes(itemFunc)) {
          score += 1;
          break;
        }
      }
    }
  }
  
  return Math.min(score, 9); // Cap at 9
}

/**
 * Score theme match (Level 3) — for variant selection
 * Direct match = 2, Partial match = 1
 */
function scoreTheme(itemTags: string[], jdThemes: string[]): number {
  if (!itemTags || itemTags.length === 0) return 0;
  
  const normalizedItem = itemTags.map(t => t.toLowerCase());
  const normalizedJD = jdThemes.map(t => t.toLowerCase());
  
  let score = 0;
  for (const jdTheme of normalizedJD) {
    if (normalizedItem.includes(jdTheme)) {
      score += 2; // Direct match
    } else {
      // Check for partial matches
      for (const itemTheme of normalizedItem) {
        if (itemTheme.includes(jdTheme) || jdTheme.includes(itemTheme)) {
          score += 1;
          break;
        }
      }
    }
  }
  
  return score;
}

/**
 * Select best variant for a base item
 */
function selectBestVariant(
  baseId: string,
  variants: any[],
  jdThemes: string[]
): { variantId: string | null; variantLabel: string | null; themeScore: number; content: any } {
  
  if (!variants || variants.length === 0) {
    return { variantId: null, variantLabel: null, themeScore: 0, content: null };
  }
  
  let bestVariant = variants[0];
  let bestScore = scoreTheme(variants[0].theme_tags || [], jdThemes);
  
  for (const variant of variants.slice(1)) {
    const score = scoreTheme(variant.theme_tags || [], jdThemes);
    if (score > bestScore) {
      bestScore = score;
      bestVariant = variant;
    }
  }
  
  return {
    variantId: bestVariant.id,
    variantLabel: bestVariant.variant_label,
    themeScore: bestScore,
    content: bestVariant,
  };
}

/**
 * Main selection function
 */
export async function selectContent(jdAnalysis: any): Promise<SelectionResult> {
  const jd = extractJDRequirements(jdAnalysis);
  const debug = {
    jdRequirements: jd,
    allScores: [] as any[],
    blockedByConflict: [] as string[],
  };
  
  // Fetch all content
  const allContent = await db.select().from(contentItems);
  
  // Separate base items and variants
  const baseItems = allContent.filter(item => !item.base_id);
  const variants = allContent.filter(item => item.base_id);
  
  // Group variants by base_id
  const variantsByBase = new Map<string, typeof variants>();
  for (const variant of variants) {
    const existing = variantsByBase.get(variant.base_id!) || [];
    existing.push(variant);
    variantsByBase.set(variant.base_id!, existing);
  }
  
  // Score all Career Highlight base items
  const chBases = baseItems.filter(item => item.id.startsWith('CH-'));
  const scoredCH: ScoredItem[] = [];
  
  for (const ch of chBases) {
    const industryScore = scoreIndustry(ch.industry_tags as string[] || [], jd.industries);
    const functionScore = scoreFunction(ch.function_tags as string[] || [], jd.functions);
    
    // Get best variant
    const chVariants = variantsByBase.get(ch.id) || [];
    const { variantId, variantLabel, themeScore, content: variantContent } = selectBestVariant(
      ch.id,
      chVariants,
      jd.themes
    );
    
    const totalScore = industryScore + functionScore + themeScore;
    const finalContent = variantContent || ch;
    
    scoredCH.push({
      id: variantId || ch.id,
      baseId: ch.id,
      variantId,
      variantLabel,
      industryScore,
      functionScore,
      themeScore,
      totalScore,
      content: finalContent.content_long || finalContent.content_medium || '',
      contentShort: finalContent.content_short,
      contentMedium: finalContent.content_medium,
      contentLong: finalContent.content_long,
    });
    
    debug.allScores.push({
      id: ch.id,
      selectedVariant: variantId,
      industry: industryScore,
      function: functionScore,
      theme: themeScore,
      total: totalScore,
    });
  }
  
  // Sort by total score (descending) and select top 5
  scoredCH.sort((a, b) => b.totalScore - a.totalScore);
  const selectedCH = scoredCH.slice(0, 5);
  
  // Track used base IDs and get blocked IDs from conflicts
  const usedBaseIds = new Set(selectedCH.map(ch => ch.baseId));
  const blockedIds = new Set<string>();
  
  for (const baseId of usedBaseIds) {
    const conflicts = CONFLICT_MAP[baseId as keyof typeof CONFLICT_MAP] || [];
    conflicts.forEach(id => {
      blockedIds.add(id);
      debug.blockedByConflict.push(`${baseId} blocks ${id}`);
    });
  }
  
  // Score P1 bullets (excluding blocked)
  const p1Bases = baseItems.filter(item => 
    item.id.startsWith('P1-B') && !blockedIds.has(item.id)
  );
  const scoredP1: ScoredItem[] = [];
  
  for (const p1 of p1Bases) {
    const industryScore = scoreIndustry(p1.industry_tags as string[] || [], jd.industries);
    const functionScore = scoreFunction(p1.function_tags as string[] || [], jd.functions);
    
    const p1Variants = variantsByBase.get(p1.id) || [];
    const { variantId, variantLabel, themeScore, content: variantContent } = selectBestVariant(
      p1.id,
      p1Variants,
      jd.themes
    );
    
    const totalScore = industryScore + functionScore + themeScore;
    const finalContent = variantContent || p1;
    
    scoredP1.push({
      id: variantId || p1.id,
      baseId: p1.id,
      variantId,
      variantLabel,
      industryScore,
      functionScore,
      themeScore,
      totalScore,
      content: finalContent.content_long || finalContent.content_medium || '',
      contentShort: finalContent.content_short,
      contentMedium: finalContent.content_medium,
      contentLong: finalContent.content_long,
    });
  }
  
  scoredP1.sort((a, b) => b.totalScore - a.totalScore);
  const selectedP1 = scoredP1.slice(0, 4);
  
  // Score P2 bullets (excluding blocked)
  const p2Bases = baseItems.filter(item => 
    item.id.startsWith('P2-B') && !blockedIds.has(item.id)
  );
  const scoredP2: ScoredItem[] = [];
  
  for (const p2 of p2Bases) {
    const industryScore = scoreIndustry(p2.industry_tags as string[] || [], jd.industries);
    const functionScore = scoreFunction(p2.function_tags as string[] || [], jd.functions);
    
    const p2Variants = variantsByBase.get(p2.id) || [];
    const { variantId, variantLabel, themeScore, content: variantContent } = selectBestVariant(
      p2.id,
      p2Variants,
      jd.themes
    );
    
    const totalScore = industryScore + functionScore + themeScore;
    const finalContent = variantContent || p2;
    
    scoredP2.push({
      id: variantId || p2.id,
      baseId: p2.id,
      variantId,
      variantLabel,
      industryScore,
      functionScore,
      themeScore,
      totalScore,
      content: finalContent.content_long || finalContent.content_medium || '',
      contentShort: finalContent.content_short,
      contentMedium: finalContent.content_medium,
      contentLong: finalContent.content_long,
    });
  }
  
  scoredP2.sort((a, b) => b.totalScore - a.totalScore);
  const selectedP2 = scoredP2.slice(0, 3);
  
  // Select best summary (score by function match)
  const summaries = baseItems.filter(item => item.id.startsWith('SUM-'));
  let bestSummary: ScoredItem | null = null;
  let bestSummaryScore = -1;
  
  for (const sum of summaries) {
    const functionScore = scoreFunction(sum.function_tags as string[] || [], jd.functions);
    if (functionScore > bestSummaryScore) {
      bestSummaryScore = functionScore;
      bestSummary = {
        id: sum.id,
        baseId: sum.id,
        variantId: null,
        variantLabel: null,
        industryScore: 0,
        functionScore,
        themeScore: 0,
        totalScore: functionScore,
        content: sum.content_long || sum.content_medium || '',
        contentShort: sum.content_short,
        contentMedium: sum.content_medium,
        contentLong: sum.content_long,
      };
    }
  }
  
  return {
    summary: bestSummary,
    careerHighlights: selectedCH,
    position1Bullets: selectedP1,
    position2Bullets: selectedP2,
    debug,
  };
}
```

---

## File 2: Create `src/lib/prompts/rewrite-only.ts`

This is the simplified Claude prompt that ONLY rewrites — no selection:

```typescript
import { ScoredItem, SelectionResult, JDRequirements } from '../content-selector';

export interface RewritePromptInput {
  jdRequirements: JDRequirements;
  priorityThemes: { theme: string; evidence?: string }[];
  atsKeywords: string[];
  selection: SelectionResult;
  targetTitle: string;
  targetCompany: string;
}

export function buildRewritePrompt(input: RewritePromptInput): string {
  const { jdRequirements, priorityThemes, atsKeywords, selection, targetTitle, targetCompany } = input;
  
  return `# Resume Rewriting Task

You are rewriting pre-selected resume content to match a job description's language and terminology.

## YOUR TASK
- Rewrite each content item to incorporate JD keywords naturally
- Maintain the core facts, metrics, and achievements — DO NOT invent
- Match the tone and terminology of the target role
- You are NOT selecting content — that's already done

## TARGET ROLE
- Title: ${targetTitle}
- Company: ${targetCompany}
- Industry: ${jdRequirements.industry}

## PRIORITY THEMES TO EMPHASIZE
${priorityThemes.map((t, i) => `${i + 1}. ${t.theme}${t.evidence ? ` — Evidence: "${t.evidence}"` : ''}`).join('\n')}

## KEYWORDS TO INCORPORATE (naturally, not forced)
${atsKeywords.slice(0, 15).join(', ')}

---

## CONTENT TO REWRITE

### SUMMARY
Original:
${selection.summary?.content || 'No summary selected'}

Rewrite this summary to emphasize the priority themes and incorporate keywords naturally.

---

### CAREER HIGHLIGHTS (5)
${selection.careerHighlights.map((ch, i) => `
#### Career Highlight ${i + 1} [${ch.id}]
${ch.variantLabel ? `Variant: ${ch.variantLabel}` : 'Base content'}
Original:
${ch.content}
`).join('\n')}

For each Career Highlight:
- Keep the **bold hook** format: **Hook phrase**: Supporting detail with metrics
- Preserve all metrics exactly (dollar amounts, percentages, numbers)
- Incorporate JD terminology where natural
- Target: 40-55 words each

---

### POSITION 1 BULLETS (4)
${selection.position1Bullets.map((b, i) => `
#### P1 Bullet ${i + 1} [${b.id}]
Original:
${b.content}
`).join('\n')}

For each bullet:
- Start with strong action verb
- Preserve all metrics exactly
- Target: ≤40 words each

---

### POSITION 2 BULLETS (3)
${selection.position2Bullets.map((b, i) => `
#### P2 Bullet ${i + 1} [${b.id}]
Original:
${b.content}
`).join('\n')}

---

## QUALITY RULES
1. **Metrics are sacred** — Never change numbers, percentages, or dollar amounts
2. **No verb repetition** — Don't use the same action verb twice in the resume
3. **No jargon soup** — Avoid compound noun chains like "B2B enterprise platform ecosystem"
4. **Hook format** — Career Highlights must use **Bold hook**: Supporting text
5. **Word limits** — Career Highlights: 40-55 words, Bullets: ≤40 words

---

## OUTPUT FORMAT

Return JSON in this exact structure:

\`\`\`json
{
  "summary": "Rewritten summary text",
  "career_highlights": [
    {
      "id": "CH-XX-VX",
      "content": "**Bold hook**: Rewritten supporting text with preserved metrics"
    }
  ],
  "position1_bullets": [
    {
      "id": "P1-BXX",
      "content": "Rewritten bullet text"
    }
  ],
  "position2_bullets": [
    {
      "id": "P2-BXX", 
      "content": "Rewritten bullet text"
    }
  ],
  "keywords_used": ["keyword1", "keyword2"],
  "verbs_used": ["Built", "Led", "Drove"]
}
\`\`\`
`;
}

export function parseRewriteResponse(response: string): any {
  // Extract JSON from response
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1]);
  }
  
  // Try parsing as raw JSON
  const cleanResponse = response.trim();
  if (cleanResponse.startsWith('{')) {
    return JSON.parse(cleanResponse);
  }
  
  throw new Error('Could not parse rewrite response as JSON');
}
```

---

## File 3: Update `src/lib/claude.ts`

Add a new function for the rewrite step. Add this function:

```typescript
import { buildRewritePrompt, parseRewriteResponse } from './prompts/rewrite-only';
import { selectContent, SelectionResult, extractJDRequirements } from './content-selector';

/**
 * NEW: Two-step generation with code-based selection
 */
export async function generateResumeV2(jdAnalysis: any): Promise<{
  resume: any;
  selection: SelectionResult;
}> {
  // Step 1: Code-based selection (deterministic)
  console.log('[V2] Starting content selection...');
  const selection = await selectContent(jdAnalysis);
  console.log('[V2] Selection complete:', {
    ch: selection.careerHighlights.map(c => c.id),
    p1: selection.position1Bullets.map(p => p.id),
    p2: selection.position2Bullets.map(p => p.id),
  });
  
  // Step 2: Claude rewriting (creative)
  const jdRequirements = extractJDRequirements(jdAnalysis);
  
  const priorityThemes = (jdAnalysis.priority_themes || []).map((t: any) => ({
    theme: typeof t === 'string' ? t : t.theme,
    evidence: typeof t === 'object' ? t.jd_evidence : undefined,
  }));
  
  const atsKeywords = (jdAnalysis.ats_keywords || []).map((k: any) =>
    typeof k === 'string' ? k : k.keyword
  );
  
  const prompt = buildRewritePrompt({
    jdRequirements,
    priorityThemes,
    atsKeywords,
    selection,
    targetTitle: jdAnalysis.target_title || '',
    targetCompany: jdAnalysis.target_company || '',
  });
  
  console.log('[V2] Sending rewrite prompt to Claude...');
  
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });
  
  const responseText = response.content[0].type === 'text' 
    ? response.content[0].text 
    : '';
  
  const rewritten = parseRewriteResponse(responseText);
  
  // Build final resume structure
  const resume = {
    summary: rewritten.summary,
    career_highlights: rewritten.career_highlights.map((ch: any, i: number) => ({
      id: ch.id,
      base_id: selection.careerHighlights[i]?.baseId,
      variant_label: selection.careerHighlights[i]?.variantLabel,
      content: ch.content,
    })),
    positions: [
      {
        position: 1,
        bullets: rewritten.position1_bullets.map((b: any, i: number) => ({
          id: b.id,
          base_id: selection.position1Bullets[i]?.baseId,
          content: b.content,
        })),
      },
      {
        position: 2,
        bullets: rewritten.position2_bullets.map((b: any, i: number) => ({
          id: b.id,
          base_id: selection.position2Bullets[i]?.baseId,
          content: b.content,
        })),
      },
    ],
    content_ids_used: [
      selection.summary?.id,
      ...selection.careerHighlights.map(c => c.id),
      ...selection.position1Bullets.map(p => p.id),
      ...selection.position2Bullets.map(p => p.id),
    ].filter(Boolean),
    keywords_used: rewritten.keywords_used || [],
    verbs_used: rewritten.verbs_used || [],
    selection_debug: selection.debug,
  };
  
  return { resume, selection };
}
```

---

## File 4: Update `src/app/api/generate-resume/route.ts`

Modify the route to use the new V2 generation:

Find the section that calls `generateFullResume()` and replace it with:

```typescript
import { generateResumeV2 } from '@/lib/claude';

// In the POST handler, replace the generateFullResume call:

// OLD:
// const result = await generateFullResume(enhancedAnalysis);

// NEW:
const { resume, selection } = await generateResumeV2(enhancedAnalysis);

console.log('[generate-resume] V2 selection debug:', selection.debug);

// The rest of the handler can stay mostly the same,
// just use `resume` instead of `result`
```

---

## Testing

After implementing, test with the Mastercard JD:

1. **Check selection debug output** in Vercel logs:
   - Should see CH-04-V3 (Demand Generation), CH-05-V2 (Product Marketing), CH-09-V4 (Revenue Growth) selected
   - Should see financial-services, B2B in jdRequirements.industries
   - Should see product-marketing, demand-generation in jdRequirements.functions

2. **Check keyword coverage**:
   - Should improve from 6% to 30%+ 
   - Should see GTM, demand generation, funnel language in output

3. **Check no conflicts**:
   - If CH-01 selected, P1-B02 should NOT appear
   - Debug output shows what was blocked

---

## Rollback Plan

Keep the old `generateFullResume()` function intact. If V2 has issues, you can switch back by changing one line in the route handler.

---

## Success Criteria

| Metric | Before | Target |
|--------|--------|--------|
| Keyword coverage | 6% | >30% |
| Variant IDs selected | 0% | 100% |
| Conflict violations | Unknown | 0 |
| Selection determinism | No | Yes |
| Debug visibility | None | Full scoring log |
