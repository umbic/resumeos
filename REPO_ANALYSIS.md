# REPO_ANALYSIS.md - ResumeOS Complete Codebase Analysis

> **Generated**: 2026-01-03
> **Purpose**: Multi-agent planning handoff document

---

## 1. FILE STRUCTURE

```
resumeos_26_app/
├── .claude/
│   └── settings.local.json          # Claude Code settings
├── .vercel/
│   ├── project.json                 # Vercel project config
│   └── README.txt
├── docs/
│   ├── claude_code_starter_prompt.md
│   ├── content_database_schema.md
│   ├── MASTER Resume _ALL Information.docx
│   ├── resume_system_design_v3.md   # System design doc
│   ├── Umberto_Castaldo_*.docx      # Reference resume
│   └── unified_content_database_v4.md
├── scripts/
│   └── seed-database.ts             # Seeds Postgres with content-database.json
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── analyze-jd/
│   │   │   │   └── route.ts         # JD analysis + session creation
│   │   │   ├── approve-section/
│   │   │   │   └── route.ts         # Save approved content + conflict tracking
│   │   │   ├── export-docx/
│   │   │   │   └── route.ts         # Generate Word document
│   │   │   ├── generate-section/
│   │   │   │   └── route.ts         # Claude content generation
│   │   │   ├── keyword-action/
│   │   │   │   └── route.ts         # Keyword add/skip/dismiss handling
│   │   │   └── search-content/
│   │   │       └── route.ts         # pgvector semantic search
│   │   ├── fonts/
│   │   │   ├── GeistMonoVF.woff
│   │   │   └── GeistVF.woff
│   │   ├── favicon.ico
│   │   ├── globals.css              # Tailwind + global styles
│   │   ├── layout.tsx               # Root layout
│   │   └── page.tsx                 # Main page (renders ResumeBuilder)
│   ├── components/
│   │   ├── resume/
│   │   │   ├── ChatPanel.tsx        # Left panel - conversation UI
│   │   │   ├── GapPrompt.tsx        # Keyword reconciliation UI
│   │   │   ├── KeywordsPanel.tsx    # Keywords sidebar panel
│   │   │   ├── PreviewPanel.tsx     # Right panel - resume preview
│   │   │   ├── ProgressBar.tsx      # 9-step progress indicator
│   │   │   ├── ResumeBuilder.tsx    # Main orchestrator (1034 lines)
│   │   │   └── index.ts             # Barrel export
│   │   └── ui/                      # shadcn/ui components
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── progress.tsx
│   │       ├── scroll-area.tsx
│   │       ├── separator.tsx
│   │       ├── switch.tsx
│   │       ├── tabs.tsx
│   │       └── textarea.tsx
│   ├── data/
│   │   └── content-database.json    # 84 resume content items
│   ├── drizzle/
│   │   ├── migrations/
│   │   │   └── 0000_volatile_gambit.sql
│   │   └── schema.ts                # Database schema (4 tables)
│   ├── lib/
│   │   ├── claude.ts                # All Claude API calls + prompts
│   │   ├── db.ts                    # Database connection
│   │   ├── docx-export.ts           # DOCX generation
│   │   ├── openai.ts                # Embeddings (text-embedding-3-small)
│   │   ├── render-highlights.tsx    # Mark tag rendering
│   │   ├── rules.ts                 # Business rules, conflicts, positions
│   │   ├── store.ts                 # Zustand state management
│   │   └── utils.ts                 # cn() helper
│   └── types/
│       └── index.ts                 # TypeScript type definitions
├── Configuration Files:
│   ├── .eslintrc.json
│   ├── .gitignore
│   ├── components.json              # shadcn/ui config
│   ├── drizzle.config.ts            # Drizzle ORM config
│   ├── next-env.d.ts
│   ├── next.config.ts
│   ├── package.json
│   ├── postcss.config.mjs
│   ├── tailwind.config.ts
│   └── tsconfig.json
├── Documentation:
│   ├── CLAUDE.md                    # Project instructions
│   ├── CONTENT_GENERATION_RULES.md  # Content generation rules (untracked)
│   ├── HANDOFF.md                   # Session handoff notes
│   ├── PROMPT_AUDIT_REQUEST.md      # Prompt audit request (untracked)
│   ├── PROMPT_AUDIT_RESULTS.md      # Prompt audit results (untracked)
│   └── README.md
└── Environment:
    └── .env.local                   # POSTGRES_URL, OPENAI_API_KEY, ANTHROPIC_API_KEY
```

---

## 2. ARCHITECTURE

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐│
│  │  ChatPanel   │  │ PreviewPanel │  │    ResumeBuilder       ││
│  │  (Left 40%)  │  │  (Right 60%) │  │    (Orchestrator)      ││
│  └──────────────┘  └──────────────┘  └────────────────────────┘│
│                           │                                      │
│                    ┌──────┴──────┐                              │
│                    │   Zustand   │                              │
│                    │   Store     │                              │
│                    └─────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API LAYER (Next.js)                        │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────────────┐ │
│  │ /analyze-jd  │  │ /generate-section│  │ /search-content   │ │
│  └──────────────┘  └─────────────────┘  └────────────────────┘ │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────────────┐ │
│  │/approve-section│ │ /keyword-action │  │   /export-docx    │ │
│  └──────────────┘  └─────────────────┘  └────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │   lib/claude.ts  │  │  lib/openai.ts   │  │  lib/rules.ts │ │
│  │   (Claude API)   │  │   (Embeddings)   │  │  (Business)   │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DATA LAYER                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │             Vercel Postgres + pgvector                    │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │  │
│  │  │content_items│ │  sessions   │ │ conflict_rules      │ │  │
│  │  │(84 items)   │ │ (user state)│ │ (deduplication)     │ │  │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Flow:
1. Format Selection (long/short)
         │
         ▼
2. Paste Job Description
         │
         ├──► /api/analyze-jd ──► Claude analyzes JD
         │         │               - Extracts strategic positioning
         │         │               - Extracts ATS keywords
         │         │               - Filters junior skills
         │         ▼
         │    OpenAI generates embedding
         │         │
         │         ▼
         │    Creates session in Postgres
         │
         ▼
3. Header Confirmation
         │
         ▼
4. Summary Generation
         │
         ├──► /api/search-content ──► pgvector similarity search
         │         │                  (finds top 5 summaries)
         │         ▼
         ├──► /api/generate-section ──► Claude generates summary
         │         │                    (from 5 options + keywords)
         │         ▼
         │    Gap reconciliation (if missing keywords)
         │         │
         │         ▼
         ├──► /api/keyword-action ──► User adds/skips/dismisses
         │                            (regenerates if adding)
         │
         ▼
5. Career Highlights
         │
         ├──► /api/search-content ──► pgvector finds top 8
         │         │
         │         ▼
         ├──► /api/generate-section ──► Claude tailors highlights
         │         │
         │         ▼
         ├──► /api/approve-section ──► Tracks conflicts
         │                             (blocks duplicate metrics)
         │
         ▼
6-8. Positions (1-6)
         │
         ├──► Same pattern: search → generate → approve
         │    - Position 1: overview + 4 bullets (if long)
         │    - Position 2: overview + 3 bullets (if long)
         │    - Positions 3-6: overviews only
         │
         ▼
9. Export
         │
         ├──► /api/export-docx ──► Generates DOCX
         │                         - Retrieves all approved content
         │                         - Applies styling
         │                         - Returns binary file
         ▼
    Download resume.docx
```

### Key Concepts

1. **Session State**: All user progress stored in `sessions` table with JSONB columns
2. **Semantic Search**: pgvector cosine distance between JD embedding and content embeddings
3. **Conflict Tracking**: When content is used, conflicting items are blocked (prevents duplicate metrics)
4. **Branding Mode**: Generic versions used when applying to competitors (hides Deloitte, Omnicom names)
5. **Format Rules**: Long format includes bullets, short format is overviews only
6. **Mark Tags**: Content wrapped in `<mark>` tags shows customizations in preview

---

## 3. API ROUTES

### `/api/analyze-jd` (POST)

**Purpose**: Analyzes job description, creates session, extracts keywords

**Request**:
```typescript
{ jobDescription: string }
```

**Response**:
```typescript
{
  sessionId: string,
  analysis: {
    strategic: {
      targetTitle: string,
      targetCompany: string,
      industry: string,
      positioningThemes: string[]
    },
    keywords: JDKeyword[],
    recommendedBrandingMode: 'branded' | 'generic',
    reasoning: string
  }
}
```

**Flow**:
1. Calls `analyzeJobDescription()` → Claude analyzes JD
2. Filters junior/tactical keywords via `filterExecutiveKeywords()`
3. Generates JD embedding via OpenAI
4. Determines branding mode based on target company
5. Creates session in Postgres

---

### `/api/search-content` (POST)

**Purpose**: Semantic search for resume content using pgvector

**Request**:
```typescript
{
  sessionId: string,
  contentType: 'summary' | 'career_highlight' | 'bullet' | 'overview',
  position?: number,
  limit?: number
}
```

**Response**:
```typescript
{
  results: Array<{
    id: string,
    type: string,
    position: number | null,
    content: string,
    contentShort: string,
    contentMedium: string,
    contentLong: string,
    contentGeneric: string,
    similarity: number,
    canUse: boolean,
    brandTags: string[],
    categoryTags: string[],
    functionTags: string[],
    outcomeTags: string[],
    exclusiveMetrics: string[]
  }>
}
```

**SQL Query**:
```sql
SELECT *, 1 - (embedding <=> jd_embedding) as similarity
FROM content_items
WHERE type = $contentType
  AND position = $position (if provided)
  AND id NOT IN (blocked_ids)
ORDER BY embedding <=> jd_embedding
LIMIT $limit
```

---

### `/api/generate-section` (POST)

**Purpose**: Generates tailored resume content using Claude

**Request**:
```typescript
{
  sessionId: string,
  sectionType: 'summary' | 'career_highlight' | 'bullet' | 'overview' | 'position',
  contentIds?: string[],
  instructions?: string,
  currentContent?: { overview: string, bullets: string[] },
  conversationHistory?: Message[]
}
```

**Response**:
```typescript
{
  draft: string | { overview: string, bullets: string[] },
  contentUsed?: string[],
  missingKeywords: JDKeyword[],
  addressedKeywordIds: string[],
  canApprove: boolean
}
```

**Flow**:
1. Fetches session data including jd_analysis
2. Gets unaddressed keywords
3. For summary: fetches top 5 summaries → calls `generateSummary()`
4. For position refinement: calls `refinePositionContent()`
5. For other sections: calls `generateTailoredContent()`
6. Calls `detectAddressedKeywords()` to identify which keywords were addressed

---

### `/api/approve-section` (POST)

**Purpose**: Saves approved content and tracks conflicts

**Request**:
```typescript
{
  sessionId: string,
  sectionType: 'format' | 'header' | 'summary' | 'highlights' | 'position',
  content: string | object,
  contentIds?: string[],
  positionData?: PositionData
}
```

**Response**:
```typescript
{
  success: boolean,
  nextStep: number,
  blockedContentIds: string[]
}
```

**Flow**:
1. Gets current session state
2. Calculates new conflicts from `getAllConflicts(contentIds)`
3. Updates appropriate session column based on sectionType
4. Advances step counter

---

### `/api/keyword-action` (POST)

**Purpose**: Handles keyword gap reconciliation actions

**Request**:
```typescript
{
  sessionId: string,
  keywordId: string,
  action: 'add' | 'skip' | 'dismiss',
  userContext?: string,
  currentContent?: string,
  sectionType?: string
}
```

**Response**:
```typescript
{
  success: boolean,
  regeneratedContent: string | null,
  remainingKeywords: number,
  updatedKeyword: {
    id: string,
    status: KeywordStatus,
    sectionAddressed?: string,
    userContext?: string
  }
}
```

**Flow**:
1. For 'add': calls `regenerateWithKeyword()` → Claude regenerates content
2. For 'skip': marks keyword as 'skipped' (ask again later)
3. For 'dismiss': marks keyword as 'dismissed' (user doesn't have skill)
4. Updates jd_analysis in session

---

### `/api/export-docx` (POST)

**Purpose**: Generates styled Word document

**Request**:
```typescript
{ sessionId: string }
```

**Response**: Binary DOCX file

**Flow**:
1. Retrieves all approved content from session
2. Fetches highlight content items with correct versions
3. Builds positions data from approved_positions
4. Calls `generateResumeDocument()` → docx library
5. Returns binary file with Content-Disposition header

---

## 4. DATABASE SCHEMA

### Table: `content_items`

Stores the pre-built resume content library (84 items).

```sql
CREATE TABLE content_items (
  id TEXT PRIMARY KEY,                    -- "SUM-BR-01", "CH-01", "P1-B02", etc.
  type TEXT NOT NULL,                     -- "summary", "career_highlight", "bullet", "overview"
  position INTEGER,                       -- 1-6 for position-specific, NULL otherwise

  -- Content versions
  content_short TEXT,                     -- Short version (~1 sentence)
  content_medium TEXT,                    -- Medium version (~2 sentences)
  content_long TEXT,                      -- Long version (full detail)
  content_generic TEXT,                   -- Generic version (hides competitor names)

  -- Metadata tags (JSON arrays)
  brand_tags JSONB DEFAULT [],            -- ["Deloitte", "Omnicom", "LTK"]
  category_tags JSONB DEFAULT [],         -- ["brand-platform", "creative"]
  function_tags JSONB DEFAULT [],         -- ["brand-strategy", "campaign-development"]
  outcome_tags JSONB DEFAULT [],          -- ["revenue-growth", "brand-equity"]
  exclusive_metrics JSONB DEFAULT [],     -- ["$40M", "191%", "1.6M appointments"]

  -- pgvector embedding (stored as text, cast in queries)
  embedding TEXT,                         -- "[0.123, -0.456, ...]"

  created_at TIMESTAMP DEFAULT NOW()
);
```

**Content ID Patterns**:
- `SUM-BR-01` to `SUM-GE-05`: 20 summaries (BR=Brand, CA=Campaign, B2B, GE=General)
- `CH-01` to `CH-10`: 10 career highlights
- `P1-B01` to `P1-B10`: Position 1 bullets
- `P2-B01` to `P2-B09`: Position 2 bullets
- `OV-P1` to `OV-P6`: Position overviews

---

### Table: `sessions`

Stores user session state and approved resume content.

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- JD Analysis (legacy flat fields)
  job_description TEXT,
  target_title TEXT,
  target_company TEXT,
  industry TEXT,
  keywords JSONB DEFAULT [],              -- Simple string array (legacy)
  themes JSONB DEFAULT [],
  jd_embedding TEXT,                      -- pgvector embedding of JD

  -- Enhanced JD Analysis (new structured format)
  jd_analysis JSONB,                      -- Full JDAnalysis object with keywords

  -- Content tracking
  used_content_ids JSONB DEFAULT [],      -- IDs used in approved sections
  blocked_content_ids JSONB DEFAULT [],   -- IDs blocked due to conflicts

  -- Approved sections
  approved_header JSONB,                  -- { name, title, location, phone, email }
  approved_summary TEXT,
  approved_highlights JSONB DEFAULT [],   -- Array of content IDs
  approved_positions JSONB,               -- { 1: { title, company, location, dates, overview, bullets }, ... }

  -- Settings
  format TEXT DEFAULT 'long',             -- "long" or "short"
  branding_mode TEXT DEFAULT 'branded',   -- "branded" or "generic"

  -- State
  current_step INTEGER DEFAULT 0,         -- 0-8
  status TEXT DEFAULT 'active',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### Table: `conflict_rules`

Deduplication rules to prevent duplicate metrics.

```sql
CREATE TABLE conflict_rules (
  id SERIAL PRIMARY KEY,
  item_id TEXT NOT NULL,
  conflicts_with JSONB NOT NULL,          -- Array of conflicting content IDs
  reason TEXT                             -- Why they conflict
);
```

---

### Table: `learned_content`

Tracks new content learned during sessions (not currently used).

```sql
CREATE TABLE learned_content (
  id TEXT PRIMARY KEY,
  base_id TEXT NOT NULL,
  type TEXT NOT NULL,
  context_tag TEXT,
  original_content TEXT,
  new_content TEXT,
  source_industry TEXT,
  times_reused INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 5. CURRENT PROMPTS (VERBATIM)

### Prompt 1: `analyzeJobDescription()` in `lib/claude.ts`

**Model**: `claude-opus-4-5-20251101`
**Max Tokens**: 2048

```
Analyze this job description and extract TWO types of information:

---

## PART 1: STRATEGIC POSITIONING

1. **Target Job Title**: The exact title as it should appear on the resume header
2. **Target Company**: Company name
3. **Industry/Sector**: Primary industry (e.g., "Financial Services", "Healthcare", "Technology")
4. **Positioning Themes**: 3-5 strategic angles to emphasize throughout the resume. These are the "story" the resume should tell — not keywords, but narrative directions.

Example positioning themes:
- "Transformation leader who modernizes legacy brands"
- "Data-informed strategist who connects brand to revenue"
- "Cross-functional executive who aligns marketing with business goals"

---

## PART 2: ATS KEYWORD EXTRACTION

Extract keywords an ATS would scan for, filtered for **executive-level relevance**.

IMPORTANT FILTERING RULES:
- SKIP junior/tactical skills (Excel, PowerPoint, SQL, HTML, CSS, Google Analytics, etc.)
- SKIP tool-level proficiencies unless strategic (e.g., keep "Salesforce ecosystem strategy", skip "Salesforce admin")
- FOCUS on strategic, leadership, and domain expertise keywords
- This is for a senior executive resume — keywords should reflect VP/SVP/C-suite level work

### Categories to Extract:

**1. Hard Skills** (strategic/leadership abilities)
Examples: brand strategy, go-to-market planning, P&L management, executive communications, portfolio architecture, campaign strategy, customer segmentation, market positioning

**2. Soft Skills** (executive-level interpersonal skills)
Examples: executive presence, stakeholder management, cross-functional leadership, board communication, change management, team building

**3. Industry Terms** (sector-specific vocabulary)
Examples: wealth management, B2B, omnichannel, DTC, AUM, customer lifetime value, brand equity, retail banking

**4. Seniority Signals** (level indicators)
Examples: years of experience mentioned, level words like "senior", "director", "VP", "head of", team size expectations, budget/P&L responsibility

For each keyword, provide:
- **keyword**: Exact phrase from JD
- **category**: hard_skill | soft_skill | industry_term | seniority_signal
- **priority**: high | medium | low (based on frequency and placement in JD)
- **placement**: Where it appeared (title, requirements, responsibilities, nice-to-have)

---

## BRANDING RECOMMENDATION

Also determine if "generic" branding should be used (hide competitor names like Deloitte, Omnicom) if the target company is:
McKinsey, BCG, Bain, Accenture, EY, KPMG, PwC, WPP, Publicis, IPG, or Dentsu

---

## OUTPUT FORMAT

Return as JSON:

{
  "strategic": {
    "targetTitle": "Head of Brand Strategy",
    "targetCompany": "Morgan Stanley",
    "industry": "Financial Services - Wealth Management",
    "positioningThemes": [
      "Enterprise brand transformation leader",
      "Wealth/financial services domain expertise",
      "Cross-functional executive who partners with business leaders"
    ]
  },
  "keywords": [
    {
      "keyword": "brand strategy",
      "category": "hard_skill",
      "priority": "high",
      "placement": "title, requirements"
    },
    {
      "keyword": "wealth management",
      "category": "industry_term",
      "priority": "high",
      "placement": "throughout"
    }
  ],
  "recommendedBrandingMode": "branded",
  "reasoning": "Morgan Stanley is not a direct competitor to Deloitte or Omnicom agencies"
}

---

Job Description:
${jobDescription}

Return ONLY the JSON object, no other text.
```

---

### Prompt 2: `generateTailoredContent()` in `lib/claude.ts`

**Model**: `claude-opus-4-5-20251101`
**Max Tokens**: 1024

```
Tailor this resume content for a specific job application. You must preserve all facts from the original.

Target Role: ${jdAnalysis.strategic.targetTitle} at ${jdAnalysis.strategic.targetCompany}
Industry: ${jdAnalysis.strategic.industry}

**Positioning Themes** (story to tell):
${jdAnalysis.strategic.positioningThemes.map((t) => `- ${t}`).join('\n')}
${keywordSection}
ORIGINAL CONTENT (${sectionType}):
${originalContent}

${instructions ? `Additional Instructions: ${instructions}` : ''}

CRITICAL RULES - VIOLATIONS ARE UNACCEPTABLE:
1. NEVER change any metrics, numbers, or percentages
2. NEVER add industries, sectors, or client types not in the original
3. NEVER fabricate capabilities, experiences, or outcomes
4. NEVER inflate scope, scale, or impact beyond what's stated
5. If the target industry isn't mentioned in the original, do NOT add it

ALLOWED CUSTOMIZATIONS:
- Reorder emphasis within the sentence
- Use synonyms that don't change meaning (e.g., "led" → "spearheaded")
- Mirror JD terminology ONLY where it authentically maps to existing content
- Slight rephrasing that preserves all original claims
- Naturally incorporate ATS keywords where they genuinely apply

When you incorporate a JD keyword, wrap it in <mark> tags so we can highlight it.
Wrap other customized words/phrases in <mark> tags too. Only mark actual changes.

Example:
Original: "Led brand strategy initiatives across multiple sectors"
CORRECT: "Led <mark>brand transformation</mark> initiatives across multiple sectors"
WRONG: "Led brand strategy initiatives across <mark>financial services and payments</mark>" (invents industries)

Return ONLY the tailored content with <mark> tags inline.
```

---

### Prompt 3: `generateSummary()` in `lib/claude.ts`

**Model**: `claude-opus-4-5-20251101`
**Max Tokens**: 1024

```
Combine and tailor a professional summary for a resume using ONLY the source content provided.

Target Role: ${jdAnalysis.strategic.targetTitle} at ${jdAnalysis.strategic.targetCompany}
Industry: ${jdAnalysis.strategic.industry}

**Positioning Themes** (story to tell):
${jdAnalysis.strategic.positioningThemes.map((t) => `- ${t}`).join('\n')}
${keywordSection}
Format: ${format} (${format === 'long' ? '4-5 sentences' : '3-4 sentences'})

SOURCE CONTENT (use ONLY phrases, claims, and facts from these):

${summaryOptions.map((s, i) => `Option ${i + 1}:\n${s}`).join('\n\n')}

CRITICAL RULES - VIOLATIONS ARE UNACCEPTABLE:
1. NEVER invent industries, sectors, or domains not explicitly mentioned in the source content
2. NEVER add client types, company types, or verticals not in the source (e.g., don't add "payments technology" if not in source)
3. NEVER fabricate capabilities, experiences, or outcomes not stated in the source
4. You may ONLY reorder, combine, and slightly rephrase content from the source options
5. If the target industry isn't represented in the source content, use general business language instead of inventing specifics

ALLOWED CUSTOMIZATIONS:
- Reorder sentences to lead with most relevant capability
- Combine phrases from different source options
- Use synonyms (e.g., "organizations" → "enterprises")
- Mirror terminology from the JD that maps to existing source content
- Naturally incorporate ATS keywords where they genuinely apply to the source content

When you incorporate a JD keyword, wrap it in <mark> tags so we can highlight it.
Wrap other customized words/phrases in <mark> tags too. Only mark actual changes.

Return ONLY the summary text with <mark> tags inline.
```

---

### Prompt 4: `refinePositionContent()` in `lib/claude.ts`

**Model**: `claude-opus-4-5-20251101`
**Max Tokens**: 2048

```
You are helping refine position content on a resume based on user feedback.

Target Role: ${jdAnalysis.strategic.targetTitle} at ${jdAnalysis.strategic.targetCompany}
Industry: ${jdAnalysis.strategic.industry}
Key Themes: ${jdAnalysis.strategic.positioningThemes.join(', ')}
${keywordSection}
Current Overview:
${overview}

Current Bullets:
${bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}

CRITICAL RULES - VIOLATIONS ARE UNACCEPTABLE:
1. NEVER change any metrics, numbers, or percentages
2. NEVER add industries, sectors, or client types not already in the content
3. NEVER fabricate capabilities, experiences, or outcomes
4. NEVER inflate scope, scale, or impact beyond what's stated
5. If asked to add something not in the original content, politely explain you cannot invent facts

Apply the user's requested changes while maintaining all factual accuracy.
Also try to naturally incorporate ATS keywords where they genuinely apply.

Wrap customized words/phrases in <mark> tags. Preserve existing <mark> tags if that text remains customized.
When you incorporate a JD keyword, wrap it in <mark> tags so we can highlight it.

Return a JSON object with:
{
  "overview": "the updated overview text with <mark> tags",
  "bullets": ["bullet 1 with <mark>tags</mark>", "bullet 2", ...]
}

If the user's request only affects bullets, keep the overview the same.
If the user's request only affects the overview, keep the bullets the same.

Return ONLY the JSON object, no other text.
```

**Message Structure** (multi-turn):
```javascript
[
  { role: 'user', content: systemContext },
  { role: 'assistant', content: 'I understand. I will help you refine this position content...' },
  ...conversationHistory,
  { role: 'user', content: instructions }
]
```

---

### Prompt 5: `detectAddressedKeywords()` in `lib/claude.ts`

**Model**: `claude-opus-4-5-20251101`
**Max Tokens**: 1024

```
Analyze the following resume content and determine which of the provided keywords have been incorporated (either exactly or semantically).

RESUME CONTENT:
${content}

KEYWORDS TO CHECK:
${keywords.map((k) => `- ${k.id}: "${k.keyword}"`).join('\n')}

For each keyword, determine if it has been addressed in the content. A keyword is "addressed" if:
1. The exact phrase appears in the content, OR
2. A clear semantic equivalent appears (e.g., "P&L management" addressed by "managed a $40M P&L")

Return a JSON array of the keyword IDs that have been addressed:
["kw_001", "kw_003", ...]

If no keywords were addressed, return an empty array: []

Return ONLY the JSON array, no other text.
```

---

### Prompt 6: `regenerateWithKeyword()` in `lib/claude.ts`

**Model**: `claude-opus-4-5-20251101`
**Max Tokens**: 1024

```
The user wants to include a specific JD keyword in their resume content.

Keyword: "${keyword.keyword}"
User context: "${userContext}"

Current content:
${currentContent}

Target Role: ${jdAnalysis.strategic.targetTitle} at ${jdAnalysis.strategic.targetCompany}
Industry: ${jdAnalysis.strategic.industry}
Section: ${sectionType}

Reframe the content to naturally incorporate this keyword/concept, using the user's context.

CRITICAL RULES:
1. Integrate naturally — don't force it or keyword stuff
2. Maintain all existing metrics and facts
3. Mirror the JD terminology where authentic
4. NEVER change any numbers, percentages, or quantified outcomes
5. NEVER add industries or experiences not in the original content
6. Only add the keyword if the user's context provides a legitimate basis for it

Wrap the newly incorporated keyword in <mark> tags to highlight it.
Preserve any existing <mark> tags on other customizations.

Return ONLY the updated content with <mark> tags inline.
```

---

## 6. CURRENT STATE

### What's Working (Deployed to Production)

| Feature | Status | Notes |
|---------|--------|-------|
| Two-panel UI | ✅ Working | Chat (40%) + Preview (60%) |
| 8-step flow | ✅ Working | Format → JD → Header → Summary → Highlights → P1 → P2 → P3-6 → Export |
| JD Analysis | ✅ Working | Two-layer analysis (strategic + ATS keywords) |
| Junior skills filter | ✅ Working | Filters tactical keywords (Excel, PowerPoint, SQL, etc.) |
| Semantic search | ✅ Working | pgvector cosine distance |
| Content tailoring | ✅ Working | Claude reframes content with mark tags |
| Keyword incorporation | ✅ Working | Keywords incorporated in all sections |
| Gap reconciliation | ✅ Working | Add/skip/dismiss unaddressed keywords |
| Keywords Panel | ✅ Working | Shows keyword status by category |
| Customizations toggle | ✅ Working | Highlights marked content in preview |
| Conflict tracking | ✅ Working | Blocks duplicate metrics |
| Branding mode | ✅ Working | Generic versions for competitors |
| DOCX export | ✅ Working | Styled Word document |
| Position refinement | ✅ Working | Multi-turn conversation for edits |

### What's Not Built Yet

| Feature | Description |
|---------|-------------|
| User authentication | No login/accounts |
| Multiple resumes | One session at a time |
| Resume saving | Sessions expire, no persistence |
| Content editing | Can't edit content database from UI |
| Analytics | No tracking of keyword coverage |
| Mobile UI | Desktop-only layout |

### Known Issues / Bugs

| Issue | Severity | Notes |
|-------|----------|-------|
| None discovered | - | Feature just deployed, needs e2e testing |

### Half-Built / Incomplete

| Feature | Status | What's Done | What's Missing |
|---------|--------|-------------|----------------|
| `learned_content` table | Schema exists | Database table created | No UI or logic to use it |
| Position overviews | Partial | Fetched from DB | Not all positions have content |

### Technical Debt

1. **ResumeBuilder.tsx is 1034 lines** - Could be split into smaller hooks/components
2. **Raw SQL queries** - Some routes use string interpolation instead of parameterized queries
3. **Error handling** - Basic try/catch, no retry logic or user-friendly errors
4. **No tests** - Zero test coverage
5. **Type duplication** - Some types defined in multiple files

---

## 7. CONTENT DATABASE SUMMARY

### Item Counts

| Type | Count | ID Pattern |
|------|-------|------------|
| Summaries | 20 | SUM-BR-01 to SUM-GE-05 |
| Career Highlights | 10 | CH-01 to CH-10 |
| Position 1 Bullets | 10 | P1-B01 to P1-B10 |
| Position 2 Bullets | 9 | P2-B01 to P2-B09 |
| Position 3 Bullets | 3 | P3-B01 to P3-B03 |
| Position 4 Bullets | 2 | P4-B01 to P4-B02 |
| Position 5 Bullets | 2 | P5-B01 to P5-B02 |
| Position 6 Bullets | 1 | P6-B01 |
| Overviews | 6 | OV-P1 to OV-P6 |
| **TOTAL** | **84** | |

### Conflict Rules (Deduplication)

```
CH-01 ↔ P1-B02  (Both use $40M practice and 35+ strategists)
CH-02 ↔ P2-B08  (Both use NWSL 50% attendance and $60M media deal)
CH-03 ↔ P1-B04  (Both use OOFOS 191% sales and 54% acquisition)
CH-04 ↔ P1-B09  (Both use Deloitte 43% lead gen and 33% relevancy)
CH-05 ↔ P2-B09  (Both use PfizerForAll $727M revenue)
CH-06 ↔ P1-B08  (Both use LTK $2.8B to $5B scaling)
CH-07 ↔ P1-B05  (Both use NYU Langone 1.6M appointments)
CH-08 ↔ P1-B07  (Both use Gateway 30K members)
CH-09 ↔ P1-B03  (Both use Amex 5% retention and 12% cross-sell)
CH-10 ↔ P4-B01, P4-B02  (All use GE innovation and Cannes Grand Prix)
```

---

## 8. ENVIRONMENT & DEPLOYMENT

### Required Environment Variables

```bash
POSTGRES_URL=postgres://[user]:[pass]@[host]:[port]/[db]?sslmode=require
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### Commands

```bash
# Development
npm run dev                      # Start Next.js dev server

# Build
npm run build                    # Production build

# Database
npm run db:seed                  # Seed database with content-database.json
npm run db:generate              # Generate Drizzle migrations
npm run db:migrate               # Run migrations
npx dotenv -e .env.local -- npm run db:migrate  # With local env

# Deploy
git push origin main             # Auto-deploys to Vercel
```

### URLs

- **Production**: https://resumeos.vercel.app
- **GitHub**: https://github.com/umbic/resumeos

---

## 9. KEY FILES FOR MODIFICATION

| What You Want To Do | Files to Modify |
|---------------------|-----------------|
| Change prompts | `src/lib/claude.ts` |
| Add new API route | `src/app/api/[route]/route.ts` |
| Modify UI flow | `src/components/resume/ResumeBuilder.tsx` |
| Add content items | `src/data/content-database.json` → run `npm run db:seed` |
| Change conflict rules | `src/lib/rules.ts` (CONFLICT_MAP) |
| Change branding rules | `src/lib/rules.ts` (COMPETITOR_MAP) |
| Modify database schema | `src/drizzle/schema.ts` → run `npm run db:generate` |
| Change preview styling | `src/components/resume/PreviewPanel.tsx` |
| Change DOCX styling | `src/lib/docx-export.ts` |
| Modify state | `src/lib/store.ts` |
| Add new types | `src/types/index.ts` |

---

## 10. CRITICAL CONSTRAINTS

1. **NEVER fabricate content** - Only select and reframe existing database content
2. **NEVER change metrics** - Numbers, percentages, and stats must stay exactly as stored
3. **NEVER add industries not in source** - If "payments" isn't in content, don't add it
4. **Conflicts are bidirectional** - If CH-01 conflicts with P1-B02, both directions are blocked
5. **Generic versions hide competitor names** - Deloitte → "a Big Four professional services firm"
6. **Model is fixed** - All prompts use `claude-opus-4-5-20251101`
7. **Embeddings are precomputed** - Content embeddings are in the database, not generated at runtime
