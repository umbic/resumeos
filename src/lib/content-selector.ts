import { db } from './db';
import { contentItems } from '@/drizzle/schema';
import { CONFLICT_MAP } from './rules';
import { DiagnosticLogger } from './diagnostics';
import { lookupCompanyIndustry, CompanyIndustryInfo } from './company-lookup';

// Re-export for consumers
export type { CompanyIndustryInfo };

// Types
export interface JDRequirements {
  industry: string;
  industries: string[];      // e.g., ["financial-services", "B2B", "payments"]
  functions: string[];       // e.g., ["product-marketing", "demand-generation"]
  themes: string[];          // e.g., ["revenue-growth", "GTM", "team-leadership"]
  keywords: string[];        // e.g., ["funnel", "pipeline", "enablement"]
  companyInfo?: CompanyIndustryInfo;  // Industry info from company lookup
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

export interface OverviewItem {
  id: string;
  position: number;
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
  overviews: OverviewItem[];  // All 6 position overviews
  debug: {
    jdRequirements: JDRequirements;
    allScores: { id: string; industry: number; function: number; theme: number; total: number }[];
    blockedByConflict: string[];
  };
}

/**
 * Infer industries from ATS keywords
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function inferIndustriesFromKeywords(keywords: any[]): string[] {
  const industries: string[] = [];

  const keywordMap: Record<string, string[]> = {
    'technology': ['technology'],
    'software': ['technology', 'software'],
    'saas': ['technology', 'SaaS', 'B2B'],
    'enterprise': ['B2B', 'enterprise-software'],
    'fintech': ['financial-services', 'fintech', 'technology'],
    'banking': ['financial-services', 'banking'],
    'payments': ['financial-services', 'payments'],
    'healthcare': ['healthcare'],
    'pharma': ['healthcare', 'pharma'],
    'retail': ['retail', 'consumer'],
    'e-commerce': ['e-commerce', 'retail', 'technology'],
    'cpg': ['CPG', 'consumer'],
    'consumer': ['consumer'],
    'b2b': ['B2B'],
    'b2c': ['B2C', 'consumer'],
  };

  for (const kw of keywords) {
    const keyword = (typeof kw === 'string' ? kw : kw.keyword || '').toLowerCase();

    for (const [term, tags] of Object.entries(keywordMap)) {
      if (keyword.includes(term)) {
        industries.push(...tags);
      }
    }
  }

  return industries;
}

/**
 * Extract JD requirements from EnhancedJDAnalysis
 * Now includes company lookup for industry detection
 */
export async function extractJDRequirements(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jdAnalysis: any,
  diagnostics?: DiagnosticLogger
): Promise<JDRequirements> {
  const eventId = diagnostics?.startEvent('content_selection', 'extract_requirements');

  // Normalize industry to array of tags
  const industryStr = (jdAnalysis.industry || '').toLowerCase();
  let industries: string[] = [];

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

  // If industries still empty, look up the company
  let companyInfo: CompanyIndustryInfo | undefined;

  if (industries.length === 0 && jdAnalysis.target_company) {
    diagnostics?.logDecision(eventId!,
      'Industry empty, looking up company',
      `Searching for: ${jdAnalysis.target_company}`,
      { company: jdAnalysis.target_company }
    );

    try {
      companyInfo = await lookupCompanyIndustry(jdAnalysis.target_company);

      diagnostics?.logDecision(eventId!,
        'Company lookup complete',
        `Found: ${companyInfo.industryCategory} (${companyInfo.confidence} confidence)`,
        companyInfo
      );

      // Add industries from company lookup
      if (companyInfo.industries.length > 0) {
        industries.push(...companyInfo.industries);
      }

      // Add B2B/B2C if detected
      if (companyInfo.isB2B && !industries.includes('B2B')) {
        industries.push('B2B');
      }
      if (companyInfo.isB2C && !industries.includes('B2C')) {
        industries.push('B2C');
      }

    } catch (error) {
      diagnostics?.logDecision(eventId!,
        'Company lookup failed',
        error instanceof Error ? error.message : 'Unknown error',
        { error }
      );
    }
  }

  // Also check keywords for industry signals
  const keywordIndustries = inferIndustriesFromKeywords(jdAnalysis.ats_keywords || []);
  industries.push(...keywordIndustries);

  // Deduplicate
  industries = Array.from(new Set(industries));

  diagnostics?.logDecision(eventId!,
    'Final industries extracted',
    `Found ${industries.length} industries: ${industries.join(', ')}`,
    { industries }
  );

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
      words.forEach((w: string) => {
        if (w.length > 3 && !themes.includes(w)) themes.push(w);
      });
    }
  }

  // Extract keywords
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const keywords: string[] = (jdAnalysis.ats_keywords || []).map((k: any) =>
    typeof k === 'string' ? k.toLowerCase() : (k.keyword || '').toLowerCase()
  );

  diagnostics?.completeEvent(eventId!);

  return {
    industry: jdAnalysis.industry || companyInfo?.industryCategory || '',
    industries,
    functions: Array.from(new Set(functions.map(f => f.toLowerCase()))),
    themes: Array.from(new Set(themes)),
    keywords: Array.from(new Set(keywords)),
    companyInfo,
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
  _baseId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variants: any[],
  jdThemes: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): { variantId: string | null; variantLabel: string | null; themeScore: number; content: any } {

  if (!variants || variants.length === 0) {
    return { variantId: null, variantLabel: null, themeScore: 0, content: null };
  }

  let bestVariant = variants[0];
  let bestScore = scoreTheme(variants[0].themeTags || [], jdThemes);

  for (const variant of variants.slice(1)) {
    const score = scoreTheme(variant.themeTags || [], jdThemes);
    if (score > bestScore) {
      bestScore = score;
      bestVariant = variant;
    }
  }

  return {
    variantId: bestVariant.id,
    variantLabel: bestVariant.variantLabel,
    themeScore: bestScore,
    content: bestVariant,
  };
}

/**
 * Main selection function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function selectContent(jdAnalysis: any, diagnostics?: DiagnosticLogger): Promise<SelectionResult> {
  const jd = await extractJDRequirements(jdAnalysis, diagnostics);
  const debug = {
    jdRequirements: jd,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allScores: [] as any[],
    blockedByConflict: [] as string[],
  };

  // Start main content selection event
  const mainEventId = diagnostics?.startEvent('content_selection', 'initialize');
  diagnostics?.logInput(mainEventId!, {
    rawAnalysis: jdAnalysis,
    extractedRequirements: jd,
  });

  // Fetch all content
  const allContent = await db.select().from(contentItems);

  // Separate base items and variants
  const baseItems = allContent.filter(item => !item.baseId);
  const variants = allContent.filter(item => item.baseId);

  // Group variants by base_id
  const variantsByBase = new Map<string, typeof variants>();
  for (const variant of variants) {
    const existing = variantsByBase.get(variant.baseId!) || [];
    existing.push(variant);
    variantsByBase.set(variant.baseId!, existing);
  }

  // Score all Career Highlight base items
  const chBases = baseItems.filter(item => item.id.startsWith('CH-'));
  const scoredCH: ScoredItem[] = [];

  // Start CH scoring event
  const chEventId = diagnostics?.startEvent('content_selection', 'scoring_career_highlights');

  for (const ch of chBases) {
    const industryScore = scoreIndustry(ch.industryTags as string[] || [], jd.industries);
    const functionScore = scoreFunction(ch.functionTags as string[] || [], jd.functions);

    // Get best variant
    const chVariants = variantsByBase.get(ch.id) || [];
    const { variantId, variantLabel, themeScore, content: variantContent } = selectBestVariant(
      ch.id,
      chVariants,
      jd.themes
    );

    const totalScore = industryScore + functionScore + themeScore;
    const finalContent = variantContent || ch;

    // Log each scoring decision
    diagnostics?.logDecision(chEventId!,
      `Score ${ch.id}`,
      `Industry: ${industryScore} (tags: ${(ch.industryTags as string[] || []).join(', ') || 'none'}), Function: ${functionScore} (tags: ${(ch.functionTags as string[] || []).join(', ') || 'none'}), Theme: ${themeScore}`,
      { industryScore, functionScore, themeScore, totalScore, itemTags: { industry: ch.industryTags, function: ch.functionTags } }
    );

    if (variantId) {
      diagnostics?.logDecision(chEventId!,
        `Select variant ${variantId} for ${ch.id}`,
        `Theme score: ${themeScore}, Label: ${variantLabel}`,
        { variantId, themeScore, variantLabel }
      );
    }

    scoredCH.push({
      id: variantId || ch.id,
      baseId: ch.id,
      variantId,
      variantLabel,
      industryScore,
      functionScore,
      themeScore,
      totalScore,
      content: finalContent.contentLong || finalContent.contentMedium || '',
      contentShort: finalContent.contentShort,
      contentMedium: finalContent.contentMedium,
      contentLong: finalContent.contentLong,
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

  // Log final CH selection
  diagnostics?.logDecision(chEventId!,
    'Final CH selection',
    `Top 5 by score: ${selectedCH.map(c => `${c.id}(${c.totalScore})`).join(', ')}`,
    { selected: selectedCH.map(c => ({ id: c.id, baseId: c.baseId, score: c.totalScore })) }
  );
  diagnostics?.completeEvent(chEventId!);

  // Track used base IDs and get blocked IDs from conflicts
  const usedBaseIds = Array.from(new Set(selectedCH.map(ch => ch.baseId)));
  const blockedIds = new Set<string>();

  // Start conflict tracking event
  const conflictEventId = diagnostics?.startEvent('content_selection', 'conflict_blocking');

  for (const baseId of usedBaseIds) {
    const conflicts = CONFLICT_MAP[baseId as keyof typeof CONFLICT_MAP] || [];
    if (conflicts.length > 0) {
      diagnostics?.logDecision(conflictEventId!,
        `Block conflicts for ${baseId}`,
        `Blocking: ${conflicts.join(', ')}`,
        { baseId, blocked: conflicts }
      );
    }
    conflicts.forEach((id: string) => {
      blockedIds.add(id);
      debug.blockedByConflict.push(`${baseId} blocks ${id}`);
    });
  }
  diagnostics?.completeEvent(conflictEventId!, { blockedIds: Array.from(blockedIds) });

  // Score P1 bullets (excluding blocked)
  const p1Bases = baseItems.filter(item =>
    item.id.startsWith('P1-B') && !blockedIds.has(item.id)
  );
  const scoredP1: ScoredItem[] = [];

  // Start P1 scoring event
  const p1EventId = diagnostics?.startEvent('content_selection', 'scoring_p1_bullets');

  for (const p1 of p1Bases) {
    const industryScore = scoreIndustry(p1.industryTags as string[] || [], jd.industries);
    const functionScore = scoreFunction(p1.functionTags as string[] || [], jd.functions);

    const p1Variants = variantsByBase.get(p1.id) || [];
    const { variantId, variantLabel, themeScore, content: variantContent } = selectBestVariant(
      p1.id,
      p1Variants,
      jd.themes
    );

    const totalScore = industryScore + functionScore + themeScore;
    const finalContent = variantContent || p1;

    diagnostics?.logDecision(p1EventId!,
      `Score ${p1.id}`,
      `Industry: ${industryScore}, Function: ${functionScore}, Theme: ${themeScore}, Total: ${totalScore}`,
      { industryScore, functionScore, themeScore, totalScore }
    );

    scoredP1.push({
      id: variantId || p1.id,
      baseId: p1.id,
      variantId,
      variantLabel,
      industryScore,
      functionScore,
      themeScore,
      totalScore,
      content: finalContent.contentLong || finalContent.contentMedium || '',
      contentShort: finalContent.contentShort,
      contentMedium: finalContent.contentMedium,
      contentLong: finalContent.contentLong,
    });
  }

  scoredP1.sort((a, b) => b.totalScore - a.totalScore);
  const selectedP1 = scoredP1.slice(0, 4);

  diagnostics?.logDecision(p1EventId!,
    'Final P1 selection',
    `Top 4: ${selectedP1.map(p => `${p.id}(${p.totalScore})`).join(', ')}`,
    { selected: selectedP1.map(p => ({ id: p.id, score: p.totalScore })) }
  );
  diagnostics?.completeEvent(p1EventId!);

  // Score P2 bullets (excluding blocked)
  const p2Bases = baseItems.filter(item =>
    item.id.startsWith('P2-B') && !blockedIds.has(item.id)
  );
  const scoredP2: ScoredItem[] = [];

  // Start P2 scoring event
  const p2EventId = diagnostics?.startEvent('content_selection', 'scoring_p2_bullets');

  for (const p2 of p2Bases) {
    const industryScore = scoreIndustry(p2.industryTags as string[] || [], jd.industries);
    const functionScore = scoreFunction(p2.functionTags as string[] || [], jd.functions);

    const p2Variants = variantsByBase.get(p2.id) || [];
    const { variantId, variantLabel, themeScore, content: variantContent } = selectBestVariant(
      p2.id,
      p2Variants,
      jd.themes
    );

    const totalScore = industryScore + functionScore + themeScore;
    const finalContent = variantContent || p2;

    diagnostics?.logDecision(p2EventId!,
      `Score ${p2.id}`,
      `Industry: ${industryScore}, Function: ${functionScore}, Theme: ${themeScore}, Total: ${totalScore}`,
      { industryScore, functionScore, themeScore, totalScore }
    );

    scoredP2.push({
      id: variantId || p2.id,
      baseId: p2.id,
      variantId,
      variantLabel,
      industryScore,
      functionScore,
      themeScore,
      totalScore,
      content: finalContent.contentLong || finalContent.contentMedium || '',
      contentShort: finalContent.contentShort,
      contentMedium: finalContent.contentMedium,
      contentLong: finalContent.contentLong,
    });
  }

  scoredP2.sort((a, b) => b.totalScore - a.totalScore);
  const selectedP2 = scoredP2.slice(0, 3);

  diagnostics?.logDecision(p2EventId!,
    'Final P2 selection',
    `Top 3: ${selectedP2.map(p => `${p.id}(${p.totalScore})`).join(', ')}`,
    { selected: selectedP2.map(p => ({ id: p.id, score: p.totalScore })) }
  );
  diagnostics?.completeEvent(p2EventId!);

  // Select best summary (score by function match)
  const summaries = baseItems.filter(item => item.id.startsWith('SUM-'));
  let bestSummary: ScoredItem | null = null;
  let bestSummaryScore = -1;

  for (const sum of summaries) {
    const functionScore = scoreFunction(sum.functionTags as string[] || [], jd.functions);
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
        content: sum.contentLong || sum.contentMedium || '',
        contentShort: sum.contentShort,
        contentMedium: sum.contentMedium,
        contentLong: sum.contentLong,
      };
    }
  }

  // Select all 6 position overviews (they're not scored, just fetched by position)
  const overviewItems = baseItems.filter(item => item.id.startsWith('OV-P'));
  const overviews: OverviewItem[] = [];

  for (let pos = 1; pos <= 6; pos++) {
    const overview = overviewItems.find(item => item.position === pos);
    if (overview) {
      overviews.push({
        id: overview.id,
        position: pos,
        content: overview.contentLong || overview.contentMedium || overview.contentShort || '',
        contentShort: overview.contentShort,
        contentMedium: overview.contentMedium,
        contentLong: overview.contentLong,
      });
    }
  }

  // Complete main content selection event
  diagnostics?.completeEvent(mainEventId!, {
    summary: bestSummary?.id,
    careerHighlights: selectedCH.map(c => c.id),
    position1Bullets: selectedP1.map(p => p.id),
    position2Bullets: selectedP2.map(p => p.id),
    overviews: overviews.map(o => o.id),
  });

  return {
    summary: bestSummary,
    careerHighlights: selectedCH,
    position1Bullets: selectedP1,
    position2Bullets: selectedP2,
    overviews,
    debug,
  };
}
