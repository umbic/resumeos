# Implementation Plan: Thematic Summaries & Overview Variants

## Confirmed Data Architecture

| File | Location | Contents |
|------|----------|----------|
| `content-database.json` | `src/data/` | 20 summaries, 6 overviews, CHs, bullets |
| `variants.json` | `src/data/` | base_items (metadata) + variants (CH/bullet variants only) |

**Data Flow:** JSON files → `seed-database.ts` → Vercel Postgres

- Seed script DELETEs all content_items then re-inserts from JSON
- `overview_variants` key does NOT exist yet in variants.json - must be added
- Seed script must be updated to process new `overview_variants` array

---

## Problem Statement

Currently, summaries and overviews don't get the same scoring treatment as Career Highlights and Bullets:

| Content Type | Current Scoring | Should Be |
|--------------|-----------------|-----------|
| Career Highlights | industry + function + theme | ✅ Correct |
| P1/P2 Bullets | industry + function + theme | ✅ Correct |
| **Summaries** | function only | ❌ Need full scoring |
| **Overviews** | none (just fetched by position) | ❌ Need full scoring |

This means a Financial Services JD might get a generic summary and mismatched overviews.

## Solution

1. Replace 20 existing summaries with 8 thematic summaries (with proper tags)
2. Add 16 overview variants (8 for P1, 8 for P2) with proper tags
3. Update `content-selector.ts` to apply full 3-level scoring to summaries and overviews
4. No new "set" mechanism needed - similar tags = coordinated selection

---

## Phase 1: Audit Current State

Before making changes, confirm:

```bash
# 1. How many summaries exist and what are their IDs?
cat src/data/content-database.json | jq '.items[] | select(.type == "summary") | .id'

# 2. How are overviews structured?
cat src/data/content-database.json | jq '.items[] | select(.type == "overview")'

# 3. Current summary selection logic
grep -A 30 "Select best summary" src/lib/content-selector.ts

# 4. Current overview selection logic
grep -A 20 "Select all 6 position overviews" src/lib/content-selector.ts

# 5. What tags do existing summaries have?
cat src/data/content-database.json | jq '.items[] | select(.type == "summary") | {id, functionTags, industryTags}'

# 6. Check rewrite prompt - does it handle summaries and overviews?
cat src/lib/prompts/rewrite-only.ts
```

### Prompt Verification (Critical)

Before proceeding, confirm the rewrite prompt in `rewrite-only.ts`:

1. **Does it include summaries in the rewrite task?** Look for where `selection.summary` is used
2. **Does it include overviews in the rewrite task?** Look for where `selection.overviews` is used
3. **Are there any hardcoded content IDs?** (e.g., specific SUM-* or OV-* references that would break)
4. **Does the output format expect summary and overviews?** Check the JSON structure Claude returns

If the prompt receives content dynamically and rewrites whatever is passed, **no prompt changes needed**. The better-matched content is just better starting material.

If you find hardcoded IDs or missing sections, flag them before proceeding.

Report back what you find before proceeding.

---

## Phase 2: Update JSON Files

### 2a. Replace Summaries in `src/data/content-database.json`

Find the existing 20 summaries (IDs like SUM-BR-01, SUM-CA-01, SUM-B2B-01, SUM-GE-01, etc.) and delete them all. Then add these 8 new summaries in their place:

```json
{
  "id": "SUM-B2B",
  "type": "summary",
  "contentLong": "Umberto helps complex organizations figure out what their brand actually means - and then make it work harder. Over 15 years, he's partnered with enterprise leaders navigating messy realities: post-merger identity crises, product portfolios that don't cohere, and growth ambitions that outpace the story. His work spans the Fortune 500 - companies like General Electric, American Express, and UBS - where brand decisions involve dozens of stakeholders, competing priorities, and executives who need to see the business case before they'll move. He's learned that in enterprise environments, the best brand strategy is the one that gets buy-in. That means building frameworks CFOs can defend, narratives product teams can rally around, and platforms that scale across business units without losing coherence. At Deloitte Digital, he built the brand practice by proving that strategic clarity drives alignment - and alignment drives growth.",
  "industryTags": ["B2B", "enterprise", "professional-services", "technology"],
  "functionTags": ["brand-strategy", "executive-advisory", "transformation"],
  "themeTags": ["complex-organizations", "stakeholder-management", "enterprise-scale"],
  "brandTags": ["Deloitte"],
  "categoryTags": ["B2B", "enterprise"]
},
{
  "id": "SUM-FS",
  "type": "summary",
  "contentLong": "Umberto builds brands for financial services companies navigating a fundamental shift: from product-led positioning to customer-centric differentiation. Over 15 years, he's partnered with institutions like American Express, Capital One, New York Life, Synovus, and UBS to develop brand strategies that resonate in categories where trust is everything and switching costs are high. He understands the unique constraints of regulated industries - the compliance reviews, the legal sign-offs, the stakeholder complexity - and has learned to build brand platforms that survive them intact. His work includes repositioning regional banks for growth, developing wealth management brands that speak to next-generation clients, and creating brand architectures that unify acquisitions without losing what made them valuable. At Deloitte Digital, he established deep expertise in financial services by leading engagements that connected brand strategy to the metrics that matter: customer acquisition, deposit growth, and share of wallet.",
  "industryTags": ["financial-services", "banking", "wealth-management", "insurance"],
  "functionTags": ["brand-strategy", "brand-architecture", "client-advisory"],
  "themeTags": ["regulated-industries", "trust", "customer-acquisition"],
  "brandTags": ["Deloitte", "American Express", "Capital One", "New York Life", "Synovus", "UBS"],
  "categoryTags": ["financial-services"]
},
{
  "id": "SUM-TECH",
  "type": "summary",
  "contentLong": "Umberto builds brands for technology companies at inflection points - the moments when product-market fit demands a story that scales. Over 15 years, he's partnered with tech leaders navigating the transition from feature competition to category definition, helping them articulate what they stand for beyond what they build. His work spans enterprise software, consumer platforms, and emerging tech - including pioneering AI-powered brand solutions that accelerated speed-to-market while reducing production costs. He's learned that technology brands face a unique challenge: translating complex capabilities into human terms without dumbing them down. The best tech brands don't just explain what the product does - they capture why it matters and who it's for. At Deloitte Digital, he built expertise in technology brand strategy by helping clients scale from startup to category leader, developing brand platforms that supported major funding rounds and drove measurable acquisition growth.",
  "industryTags": ["technology", "SaaS", "enterprise-software", "platforms"],
  "functionTags": ["brand-strategy", "product-marketing", "growth-strategy"],
  "themeTags": ["category-definition", "innovation", "AI", "digital-transformation"],
  "brandTags": ["Deloitte"],
  "categoryTags": ["technology"]
},
{
  "id": "SUM-CON",
  "type": "summary",
  "contentLong": "Umberto builds brands that consumers actually notice - and remember. Over 15 years, he's partnered with consumer companies navigating the hardest challenge in marketing: breaking through in categories where attention is scarce and loyalty is fragile. His work spans CPG giants like Walmart and Pfizer, challenger brands redefining their categories, and cultural institutions like the National Women's Soccer League. He's led campaigns recognized by Cannes Lions, The Webby Awards, and AdAge - but the awards matter less than what earned them: work that connected brand strategy to cultural relevance. He's learned that consumer brands win by understanding not just what people buy, but why they care. That means building brand platforms rooted in genuine insight, creative work that respects the audience, and activation strategies that meet consumers where they actually are. At Deloitte Digital, he built the brand practice by delivering consumer engagements that drove measurable results - including repositioning a challenger footwear brand as a category leader.",
  "industryTags": ["consumer", "CPG", "retail", "DTC", "sports-entertainment"],
  "functionTags": ["brand-strategy", "integrated-campaign", "creative-strategy"],
  "themeTags": ["cultural-relevance", "consumer-insight", "brand-building"],
  "brandTags": ["Deloitte", "Walmart", "Pfizer", "NWSL"],
  "categoryTags": ["consumer"]
},
{
  "id": "SUM-CE",
  "type": "summary",
  "contentLong": "Umberto builds brands that break through. Over 15 years, he's led creative work for companies like Pfizer, American Express, General Electric, and the National Women's Soccer League - campaigns recognized by Cannes Lions, The Webby Awards, AdAge, and The Healthcare Marketing Awards. But he's never believed that awards are the goal. The goal is work that moves people: brand stories that make complex companies feel human, campaigns that turn business strategy into cultural conversation, creative platforms that give teams something worth making. He's learned that creative excellence requires more than good taste - it requires strategic clarity. The best creative work comes from teams who understand exactly what the brand stands for and who it's for. At Deloitte Digital, he built a brand practice that consistently delivers both: strategy that inspires creative teams and creative work that delivers business results. His portfolio includes brand platforms that earned Cannes Grand Prix recognition and storytelling innovations that reached #1 on iTunes.",
  "industryTags": ["consumer", "healthcare", "B2B", "technology"],
  "functionTags": ["creative-strategy", "brand-storytelling", "integrated-campaign"],
  "themeTags": ["creative-excellence", "campaigns", "awards", "storytelling"],
  "brandTags": ["Deloitte", "Pfizer", "American Express", "GE", "NWSL"],
  "categoryTags": ["creative"]
},
{
  "id": "SUM-PM",
  "type": "summary",
  "contentLong": "Umberto builds the strategic foundation that makes products succeed in market. Over 15 years, he's led positioning and go-to-market work for companies ranging from Fortune 500 enterprises to high-growth disruptors - helping them articulate what makes their product different, why it matters, and how to tell that story at every stage of the buyer journey. His work spans complex B2B portfolios, consumer product launches, and technology platforms scaling into new markets. He's learned that great product marketing starts before the campaign - it starts with positioning that sales teams can actually use, messaging that survives contact with real customers, and competitive differentiation that holds up under scrutiny. At Deloitte Digital, he built expertise in product marketing by developing frameworks that connect brand positioning to pipeline performance. His engagements have driven measurable results: increased qualified opportunities, improved acquisition rates, and go-to-market strategies that helped clients scale from Series B to category leadership.",
  "industryTags": ["B2B", "technology", "SaaS", "enterprise-software"],
  "functionTags": ["product-marketing", "positioning", "GTM", "sales-enablement"],
  "themeTags": ["go-to-market", "launches", "pipeline", "competitive-differentiation"],
  "brandTags": ["Deloitte"],
  "categoryTags": ["product-marketing"]
},
{
  "id": "SUM-BS",
  "type": "summary",
  "contentLong": "Umberto defines what brands stand for - and builds the systems that make it stick. Over 15 years, he's led brand strategy for companies navigating moments that demand clarity: post-merger integrations, portfolio simplifications, market repositionings, and growth inflections that outpace the current story. His work spans Fortune 500 enterprises like General Electric, American Express, and Pfizer, as well as challenger brands redefining their categories. He's developed brand architectures that unify sprawling portfolios, positioning platforms that differentiate in crowded markets, and identity systems that scale across business units and geographies. He's learned that brand strategy only matters if it gets adopted. That means building frameworks executives can defend, creative teams can execute, and organizations can sustain. At Deloitte Digital, he established brand strategy as a practice area by proving that positioning clarity drives business outcomes - improved brand relevance, stronger differentiation, and revenue growth for clients who invested in getting the foundation right.",
  "industryTags": ["professional-services", "B2B", "consumer", "healthcare"],
  "functionTags": ["brand-strategy", "brand-architecture", "positioning"],
  "themeTags": ["brand-architecture", "messaging", "identity-systems", "transformation"],
  "brandTags": ["Deloitte", "GE", "American Express", "Pfizer"],
  "categoryTags": ["brand-strategy"]
},
{
  "id": "SUM-PG",
  "type": "summary",
  "contentLong": "Umberto connects brand strategy to growth outcomes. Over 15 years, he's led engagements that prove brand investment drives measurable results - not someday, but in the metrics that matter now: customer acquisition, conversion rates, retention, and lifetime value. His work spans Fortune 500 enterprises optimizing marketing efficiency and growth-stage companies scaling acquisition engines. He's developed brand platforms that improved CAC by connecting positioning to performance, led campaigns that drove significant attendance and acquisition growth, and built AI-powered solutions that reduced production costs while accelerating speed-to-market. He's learned that brand and performance aren't opposing forces - they're multipliers. The best growth marketing is built on positioning that resonates, creative that converts, and measurement systems that connect brand investment to pipeline. At Deloitte Digital, he built the brand practice by delivering engagements with clear performance outcomes: improved customer acquisition, stronger favorability, and brand strategies that CFOs could see reflected in the numbers.",
  "industryTags": ["B2B", "technology", "consumer", "financial-services"],
  "functionTags": ["growth-marketing", "performance-marketing", "demand-generation"],
  "themeTags": ["acquisition", "conversion", "metrics", "ROI", "pipeline"],
  "brandTags": ["Deloitte"],
  "categoryTags": ["performance", "growth"]
}
```

### 2b. Add Overview Variants to `src/data/variants.json`

Add a NEW `overview_variants` array to variants.json. This key does not exist yet - add it alongside the existing `base_items` and `variants` arrays.

The existing base overviews (OV-P1, OV-P2) are defined in content-database.json. These new variants reference them via `base_id`:

```json
{
  "overview_variants": [
    {
      "id": "OV-P1-B2B",
      "base_id": "OV-P1",
      "variant_label": "B2B / Enterprise",
      "position": 1,
      "content": "Leads Deloitte's brand strategy practice, advising Fortune 500 executives on how to turn brand from a marketing function into a growth lever. Built a team that works at the intersection of business strategy and creative excellence - the kind of work that shows up in board decks, not just campaign briefs. Helps enterprise clients connect brand investment to outcomes that matter across the C-suite: customer acquisition, retention, and lifetime value.",
      "industry_tags": ["B2B", "enterprise", "professional-services"],
      "function_tags": ["brand-strategy", "executive-advisory"],
      "theme_tags": ["complex-organizations", "stakeholder-management", "enterprise-scale"]
    },
    {
      "id": "OV-P1-FS",
      "base_id": "OV-P1",
      "variant_label": "Financial Services",
      "position": 1,
      "content": "Leads brand strategy practice with deep expertise across banking, wealth management, and insurance. Partners with C-suite executives to develop brand strategies that navigate regulatory complexity while driving customer acquisition and retention. Built a team that understands how financial services brands compete - on trust, on clarity, and on the ability to make complex products feel simple and relevant to customers.",
      "industry_tags": ["financial-services", "banking", "wealth-management", "insurance"],
      "function_tags": ["brand-strategy", "client-advisory"],
      "theme_tags": ["regulated-industries", "trust", "customer-acquisition"]
    },
    {
      "id": "OV-P1-TECH",
      "base_id": "OV-P1",
      "variant_label": "Technology",
      "position": 1,
      "content": "Leads brand strategy for technology clients navigating category definition and market expansion. Built a team that develops brand platforms alongside AI-powered solutions - helping tech CMOs connect brand investment to growth metrics. Works with clients ranging from enterprise software companies to consumer platforms, helping them translate product capabilities into market narratives that drive adoption.",
      "industry_tags": ["technology", "SaaS", "enterprise-software", "platforms"],
      "function_tags": ["brand-strategy", "product-marketing", "growth-strategy"],
      "theme_tags": ["category-definition", "innovation", "AI"]
    },
    {
      "id": "OV-P1-CON",
      "base_id": "OV-P1",
      "variant_label": "Consumer",
      "position": 1,
      "content": "Leads brand strategy for consumer clients across CPG, retail, and lifestyle categories. Built a team that delivers culturally relevant brand platforms and integrated campaigns - work recognized by Cannes Lions and The Webby Awards. Partners with CMOs to create brands that break through in attention-scarce categories, connecting strategic clarity to creative work that resonates.",
      "industry_tags": ["consumer", "CPG", "retail", "DTC"],
      "function_tags": ["brand-strategy", "integrated-campaign", "creative-strategy"],
      "theme_tags": ["cultural-relevance", "consumer-insight", "brand-building"]
    },
    {
      "id": "OV-P1-CE",
      "base_id": "OV-P1",
      "variant_label": "Creative Excellence",
      "position": 1,
      "content": "Leads a brand strategy practice that consistently delivers award-winning work alongside business results. Partners with CMOs to create campaigns that break through category noise - from brand platforms that earned Cannes Lions recognition to storytelling innovations that reached #1 on iTunes. Proves that creative excellence and commercial outcomes reinforce each other.",
      "industry_tags": ["consumer", "healthcare", "B2B"],
      "function_tags": ["creative-strategy", "brand-storytelling", "integrated-campaign"],
      "theme_tags": ["creative-excellence", "campaigns", "awards", "storytelling"]
    },
    {
      "id": "OV-P1-PM",
      "base_id": "OV-P1",
      "variant_label": "Product Marketing",
      "position": 1,
      "content": "Leads brand strategy practice with deep expertise in positioning and go-to-market strategy. Partners with CMOs and product leaders to develop messaging frameworks, competitive positioning, and launch strategies that drive pipeline. Built a team that understands how to translate differentiation into demand - creating work that sales teams actually use and buyers actually respond to.",
      "industry_tags": ["B2B", "technology", "SaaS"],
      "function_tags": ["product-marketing", "positioning", "GTM", "sales-enablement"],
      "theme_tags": ["go-to-market", "launches", "pipeline"]
    },
    {
      "id": "OV-P1-BS",
      "base_id": "OV-P1",
      "variant_label": "Brand Strategy",
      "position": 1,
      "content": "Leads Deloitte's brand strategy practice, advising Fortune 500 executives on positioning, brand architecture, and identity systems. Built a team that develops brand platforms connecting strategic clarity to business outcomes. Partners with clients navigating complexity - post-merger integrations, portfolio rationalization, market repositioning - to build brand foundations that scale.",
      "industry_tags": ["professional-services", "B2B", "consumer"],
      "function_tags": ["brand-strategy", "brand-architecture", "positioning"],
      "theme_tags": ["brand-architecture", "messaging", "identity-systems"]
    },
    {
      "id": "OV-P1-PG",
      "base_id": "OV-P1",
      "variant_label": "Performance / Growth",
      "position": 1,
      "content": "Leads brand strategy practice with a focus on connecting brand investment to growth outcomes. Partners with CMOs and growth leaders to develop brand platforms that drive acquisition, conversion, and retention. Built a team that speaks the language of performance marketing - connecting positioning work to the metrics that matter and proving brand's impact on pipeline.",
      "industry_tags": ["B2B", "technology", "consumer"],
      "function_tags": ["growth-marketing", "performance-marketing", "demand-generation"],
      "theme_tags": ["acquisition", "conversion", "metrics", "pipeline"]
    },
    {
      "id": "OV-P2-B2B",
      "base_id": "OV-P2",
      "variant_label": "B2B / Enterprise",
      "position": 2,
      "content": "Recruited to build a brand practice inside a consultancy that could hold its own with product leaders, finance teams, and CMOs alike. Developed frameworks that helped enterprise clients cut through complexity - simplifying sprawling portfolios, aligning fragmented teams, and giving executives a story they could defend to their boards.",
      "industry_tags": ["B2B", "enterprise", "professional-services"],
      "function_tags": ["brand-strategy", "executive-advisory"],
      "theme_tags": ["complex-organizations", "stakeholder-management", "enterprise-scale"]
    },
    {
      "id": "OV-P2-FS",
      "base_id": "OV-P2",
      "variant_label": "Financial Services",
      "position": 2,
      "content": "Recruited to establish a brand practice with credibility in the C-suite. Led strategic planning across financial services clients including regional banks, wealth managers, and insurance companies - developing brand architectures that balanced regulatory requirements with market differentiation. Built frameworks that helped financial brands measure brand investment against acquisition and retention outcomes.",
      "industry_tags": ["financial-services", "banking", "wealth-management", "insurance"],
      "function_tags": ["brand-strategy", "brand-architecture"],
      "theme_tags": ["regulated-industries", "trust", "customer-acquisition"]
    },
    {
      "id": "OV-P2-TECH",
      "base_id": "OV-P2",
      "variant_label": "Technology",
      "position": 2,
      "content": "Recruited to build a brand practice that could speak the language of product teams and growth marketers. Developed proprietary frameworks that position brand as a growth lever, not a cost center - helping technology clients translate complex capabilities into compelling market narratives. Pioneered AI-powered solutions that became a model for technology-enabled brand transformation.",
      "industry_tags": ["technology", "SaaS", "enterprise-software"],
      "function_tags": ["brand-strategy", "product-marketing", "growth-strategy"],
      "theme_tags": ["category-definition", "innovation", "AI"]
    },
    {
      "id": "OV-P2-CON",
      "base_id": "OV-P2",
      "variant_label": "Consumer",
      "position": 2,
      "content": "Recruited to build a brand practice that could deliver both strategic rigor and creative excellence for consumer clients. Developed the team's signature approach: strategy rooted in genuine consumer insight, creative work that respects the audience, and measurement frameworks that connect brand investment to business outcomes.",
      "industry_tags": ["consumer", "CPG", "retail", "DTC"],
      "function_tags": ["brand-strategy", "integrated-campaign", "creative-strategy"],
      "theme_tags": ["cultural-relevance", "consumer-insight", "brand-building"]
    },
    {
      "id": "OV-P2-CE",
      "base_id": "OV-P2",
      "variant_label": "Creative Excellence",
      "position": 2,
      "content": "Recruited to build a brand practice that married consulting rigor with agency-caliber creative thinking. Developed the team's signature approach: strategy work that gives creative teams something to create from, and gives executives confidence in where the brand is headed. Built a portfolio that earned recognition from Cannes Lions, The Webby Awards, and Healthcare Marketing Awards.",
      "industry_tags": ["consumer", "healthcare", "B2B"],
      "function_tags": ["creative-strategy", "brand-storytelling", "integrated-campaign"],
      "theme_tags": ["creative-excellence", "campaigns", "awards", "storytelling"]
    },
    {
      "id": "OV-P2-PM",
      "base_id": "OV-P2",
      "variant_label": "Product Marketing",
      "position": 2,
      "content": "Recruited to build a brand practice that could deliver positioning work with teeth - frameworks that sales teams actually use and messaging that survives contact with real buyers. Developed proprietary approaches that connect brand positioning to pipeline performance, helping clients translate differentiation into demand. Built repeatable playbooks for product launches and go-to-market activation.",
      "industry_tags": ["B2B", "technology", "SaaS"],
      "function_tags": ["product-marketing", "positioning", "GTM", "sales-enablement"],
      "theme_tags": ["go-to-market", "launches", "pipeline"]
    },
    {
      "id": "OV-P2-BS",
      "base_id": "OV-P2",
      "variant_label": "Brand Strategy",
      "position": 2,
      "content": "Recruited to establish a brand strategy practice that could deliver positioning work with consulting rigor and creative ambition. Developed proprietary frameworks for brand architecture, messaging systems, and identity governance - helping clients build brand foundations that scale. Created methodologies that became Deloitte's differentiated approach to brand strategy.",
      "industry_tags": ["professional-services", "B2B", "consumer"],
      "function_tags": ["brand-strategy", "brand-architecture", "positioning"],
      "theme_tags": ["brand-architecture", "messaging", "identity-systems"]
    },
    {
      "id": "OV-P2-PG",
      "base_id": "OV-P2",
      "variant_label": "Performance / Growth",
      "position": 2,
      "content": "Recruited to build a brand practice that could prove ROI. Developed measurement frameworks that connect brand investment to growth metrics - helping clients see brand strategy reflected in acquisition costs, conversion rates, and customer lifetime value. Built AI-powered solutions that established new standards for performance-driven brand transformation.",
      "industry_tags": ["B2B", "technology", "consumer"],
      "function_tags": ["growth-marketing", "performance-marketing", "demand-generation"],
      "theme_tags": ["acquisition", "conversion", "metrics", "pipeline"]
    }
  ]
}
```

---

## Phase 3: Update Content Selector

Modify `src/lib/content-selector.ts` to apply full 3-level scoring to summaries and overviews.

### 3a. Update Summary Selection

Replace the current summary selection (function-only scoring) with full scoring:

```typescript
// BEFORE (function only):
const summaries = baseItems.filter(item => item.id.startsWith('SUM-'));
let bestSummary = null;
let bestSummaryScore = -1;

for (const sum of summaries) {
  const functionScore = scoreFunction(sum.functionTags as string[] || [], jd.functions);
  if (functionScore > bestSummaryScore) {
    bestSummaryScore = functionScore;
    bestSummary = {...};
  }
}

// AFTER (full 3-level scoring):
const summaries = baseItems.filter(item => item.type === 'summary');
let bestSummary: ScoredItem | null = null;
let bestSummaryScore = -1;

for (const sum of summaries) {
  const industryScore = scoreIndustry(sum.industryTags as string[] || [], jd.industries);
  const functionScore = scoreFunction(sum.functionTags as string[] || [], jd.functions);
  const themeScore = scoreTheme(sum.themeTags as string[] || [], jd.themes);
  const totalScore = industryScore + functionScore + themeScore;

  diagnostics?.logDecision(summaryEventId!,
    `Score ${sum.id}`,
    `Industry: ${industryScore}, Function: ${functionScore}, Theme: ${themeScore}, Total: ${totalScore}`,
    { industryScore, functionScore, themeScore, totalScore }
  );

  if (totalScore > bestSummaryScore) {
    bestSummaryScore = totalScore;
    bestSummary = {
      id: sum.id,
      baseId: sum.id,
      variantId: null,
      variantLabel: null,
      industryScore,
      functionScore,
      themeScore,
      totalScore,
      content: sum.contentLong || sum.contentMedium || '',
      contentShort: sum.contentShort,
      contentMedium: sum.contentMedium,
      contentLong: sum.contentLong,
    };
  }
}

diagnostics?.logDecision(summaryEventId!,
  'Final summary selection',
  `Selected ${bestSummary?.id} with score ${bestSummaryScore}`,
  { selected: bestSummary?.id, score: bestSummaryScore }
);
```

### 3b. Update Overview Selection

Replace position-based fetch with full scoring + variant selection:

```typescript
// BEFORE (no scoring, just fetch by position):
const overviewItems = baseItems.filter(item => item.id.startsWith('OV-P'));
const overviews: OverviewItem[] = [];

for (let pos = 1; pos <= 6; pos++) {
  const overview = overviewItems.find(item => item.position === pos);
  if (overview) {
    overviews.push({
      id: overview.id,
      position: pos,
      content: overview.contentLong || overview.contentMedium || overview.contentShort || '',
      ...
    });
  }
}

// AFTER (full scoring with variant selection for P1/P2):
const overviewBases = baseItems.filter(item => item.type === 'overview');
const overviewVariantsList = variants.filter(item => item.type === 'overview');

// Group overview variants by base_id
const overviewVariantsByBase = new Map<string, typeof variants>();
for (const variant of overviewVariantsList) {
  const existing = overviewVariantsByBase.get(variant.baseId!) || [];
  existing.push(variant);
  overviewVariantsByBase.set(variant.baseId!, existing);
}

const overviews: OverviewItem[] = [];

for (let pos = 1; pos <= 6; pos++) {
  const baseOverview = overviewBases.find(item => item.position === pos);
  if (!baseOverview) continue;

  // For P1 and P2, apply full scoring and variant selection
  if (pos <= 2) {
    const posVariants = overviewVariantsByBase.get(baseOverview.id) || [];

    if (posVariants.length > 0) {
      // Score each variant
      let bestVariant = posVariants[0];
      let bestScore = -1;

      for (const variant of posVariants) {
        const industryScore = scoreIndustry(variant.industryTags as string[] || [], jd.industries);
        const functionScore = scoreFunction(variant.functionTags as string[] || [], jd.functions);
        const themeScore = scoreTheme(variant.themeTags as string[] || [], jd.themes);
        const totalScore = industryScore + functionScore + themeScore;

        diagnostics?.logDecision(overviewEventId!,
          `Score P${pos} variant ${variant.id}`,
          `Industry: ${industryScore}, Function: ${functionScore}, Theme: ${themeScore}, Total: ${totalScore}`,
          { industryScore, functionScore, themeScore, totalScore }
        );

        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestVariant = variant;
        }
      }

      overviews.push({
        id: bestVariant.id,
        position: pos,
        content: bestVariant.contentLong || bestVariant.contentMedium || bestVariant.contentShort || '',
        contentShort: bestVariant.contentShort,
        contentMedium: bestVariant.contentMedium,
        contentLong: bestVariant.contentLong,
      });

      diagnostics?.logDecision(overviewEventId!,
        `Selected P${pos} overview`,
        `Using variant ${bestVariant.id} (${bestVariant.variantLabel}) with score ${bestScore}`,
        { variantId: bestVariant.id, score: bestScore }
      );

      continue;
    }
  }

  // For P3-P6 (or if no variants), use base overview
  overviews.push({
    id: baseOverview.id,
    position: pos,
    content: baseOverview.contentLong || baseOverview.contentMedium || baseOverview.contentShort || '',
    contentShort: baseOverview.contentShort,
    contentMedium: baseOverview.contentMedium,
    contentLong: baseOverview.contentLong,
  });
}
```

---

## Phase 4: Update Seed Script

Modify `scripts/seed-database.ts` to process the new `overview_variants` array.

### 4a. Import overview_variants

At the top where variantsDatabase is imported, the code already has:
```typescript
import variantsDatabase from '../src/data/variants.json';
```

This will automatically include the new `overview_variants` array once you add it to the JSON.

### 4b. Add function to seed overview variants

Add this new function (or extend the existing `seedVariants` function):

```typescript
async function seedOverviewVariants() {
  if (!variantsDatabase.overview_variants) {
    console.log('No overview_variants found, skipping...');
    return;
  }

  console.log(`\nSeeding ${variantsDatabase.overview_variants.length} overview variants...`);

  let count = 0;
  for (const variant of variantsDatabase.overview_variants) {
    const embeddingText = `${variant.content} | ${variant.industry_tags?.join(', ')} | ${variant.function_tags?.join(', ')} | ${variant.theme_tags?.join(', ')}`;
    const embedding = await generateEmbedding(embeddingText);

    await sql`
      INSERT INTO content_items (
        id, type, position,
        content_long,
        base_id, variant_label,
        industry_tags, function_tags, theme_tags,
        embedding
      ) VALUES (
        ${variant.id},
        'overview',
        ${variant.position},
        ${variant.content},
        ${variant.base_id},
        ${variant.variant_label},
        ${JSON.stringify(variant.industry_tags || [])},
        ${JSON.stringify(variant.function_tags || [])},
        ${JSON.stringify(variant.theme_tags || [])},
        ${JSON.stringify(embedding)}
      )
    `;
    count++;
    console.log(`  Seeded overview variant ${variant.id}`);
  }

  console.log(`Seeded ${count} overview variants!`);
}
```

### 4c. Call the new function in main()

In the `main()` function, add after the existing variant seeding:

```typescript
await seedOverviewVariants();
```

### 4d. Ensure new summaries have proper tags

The existing seed logic for content-database.json items should already handle the new summary format since we're including `industryTags`, `functionTags`, and `themeTags` in the JSON. Verify the seed function maps these fields correctly to the database columns.

---

## Phase 5: Test

After implementing:

```bash
# 1. Re-seed the database
npm run db:seed

# 2. Verify new summaries exist
# In Drizzle Studio or psql:
SELECT id, type, industry_tags, function_tags, theme_tags 
FROM content_items 
WHERE type = 'summary';
# Should see 8 rows: SUM-B2B, SUM-FS, SUM-TECH, SUM-CON, SUM-CE, SUM-PM, SUM-BS, SUM-PG

# 3. Verify overview variants exist
SELECT id, base_id, variant_label, position 
FROM content_items 
WHERE type = 'overview' AND base_id IS NOT NULL;
# Should see 16 rows (8 for P1, 8 for P2)

# 4. Test with a Financial Services JD
# - Summary should be SUM-FS
# - P1 overview should be OV-P1-FS
# - P2 overview should be OV-P2-FS

# 5. Check diagnostics for scoring decisions
# Look for "Score SUM-FS" and "Score P1 variant OV-P1-FS" in logs
```

---

## Expected Results

After implementation:

| JD Type | Expected Summary | Expected P1 Overview | Expected P2 Overview |
|---------|------------------|----------------------|----------------------|
| Financial Services | SUM-FS | OV-P1-FS | OV-P2-FS |
| B2B Enterprise | SUM-B2B | OV-P1-B2B | OV-P2-B2B |
| Technology/SaaS | SUM-TECH | OV-P1-TECH | OV-P2-TECH |
| Consumer/CPG | SUM-CON | OV-P1-CON | OV-P2-CON |
| Product Marketing | SUM-PM | OV-P1-PM | OV-P2-PM |
| Brand Strategy | SUM-BS | OV-P1-BS | OV-P2-BS |
| Creative/Campaigns | SUM-CE | OV-P1-CE | OV-P2-CE |
| Growth/Performance | SUM-PG | OV-P1-PG | OV-P2-PG |

Coordination happens naturally because items with similar tags score high for the same JDs.

---

## Commit Message

```
feat: add thematic summaries and overview variants with full scoring

- Replace 20 generic summaries with 8 thematic summaries (B2B, FS, Tech, Consumer, CE, PM, BS, PG)
- Add 16 overview variants (8 for P1, 8 for P2) with industry/function/theme tags
- Update content-selector to apply full 3-level scoring to summaries (was function-only)
- Update content-selector to score and select overview variants for P1/P2 (was no scoring)
- Coordination achieved through similar tags, no new "set" mechanism needed
```
