# ResumeOS - Complete System Design v3

## Overview

A conversational resume customization system that uses **semantic search** to find the most relevant content from a pre-built database, constrained by **hard rules** to maintain resume integrity. Deployed on Vercel.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           VERCEL DEPLOYMENT                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Next.js 14 App (App Router)                                           │
│   ├── /app                    React UI (chat + preview panels)          │
│   ├── /api/analyze-jd         Claude: Extract themes, keywords          │
│   ├── /api/search-content     Semantic search + rules filtering         │
│   ├── /api/generate-section   Claude: Generate tailored content         │
│   └── /api/export-docx        Generate downloadable .docx               │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                           DATA LAYER                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Vercel Postgres + pgvector                                            │
│   ├── content_items           All bullets/highlights/summaries          │
│   │   └── embedding VECTOR(1536)   OpenAI embeddings for semantic search│
│   ├── conflict_rules          Deduplication mappings                    │
│   ├── sessions                Active resume-building sessions           │
│   └── learned_content         Memory layer (user refinements)           │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                           EXTERNAL APIs                                  │
├─────────────────────────────────────────────────────────────────────────┤
│   ├── OpenAI API              text-embedding-3-small (embeddings)       │
│   └── Anthropic Claude API    Content generation + JD analysis          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| UI | React + Tailwind CSS + shadcn/ui |
| Database | Vercel Postgres + pgvector extension |
| ORM | Drizzle ORM |
| Embeddings | OpenAI text-embedding-3-small |
| LLM | Anthropic Claude (via Vercel AI SDK) |
| File Generation | docx library (npm) |
| State Management | Zustand (client) + Vercel KV (server sessions) |
| Deployment | Vercel |

---

## Database Schema

### Table: content_items

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE content_items (
  id TEXT PRIMARY KEY,                    -- "CH-01", "P1-B05", "SUM-BR-02"
  type TEXT NOT NULL,                     -- "career_highlight", "bullet", "summary", "overview"
  position INTEGER,                       -- 1-6 for position-specific content, NULL otherwise
  
  -- Content versions (all pre-written)
  content_short TEXT,
  content_medium TEXT,
  content_long TEXT,
  content_generic TEXT,                   -- Unbranded version for competitor applications
  
  -- Metadata for hard filtering
  brand_tags TEXT[],                      -- ["Deloitte", "Amex"]
  category_tags TEXT[],                   -- ["Financial-Services-B2B", "Healthcare"]
  function_tags TEXT[],                   -- ["CRM-Development", "Brand-Repositioning"]
  outcome_tags TEXT[],                    -- ["Revenue-Growth", "Customer-Retention"]
  
  -- Deduplication
  exclusive_metrics TEXT[],               -- ["$40M", "35+ strategists"] - unique to this item
  
  -- Semantic search
  embedding VECTOR(1536),                 -- OpenAI embedding
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast similarity search
CREATE INDEX content_embedding_idx ON content_items 
USING hnsw (embedding vector_cosine_ops);
```

### Table: conflict_rules

```sql
CREATE TABLE conflict_rules (
  id SERIAL PRIMARY KEY,
  item_id TEXT NOT NULL,                  -- "CH-01"
  conflicts_with TEXT[] NOT NULL,         -- ["P1-B02"]
  reason TEXT                             -- "Same $40M practice metric"
);
```

### Table: sessions

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- JD Analysis
  job_description TEXT,
  target_title TEXT,
  target_company TEXT,
  industry TEXT,
  jd_embedding VECTOR(1536),
  
  -- Content selections (tracks what's been used)
  used_content_ids TEXT[] DEFAULT '{}',
  blocked_content_ids TEXT[] DEFAULT '{}',  -- From conflict rules
  
  -- Approved sections
  approved_header JSONB,
  approved_summary TEXT,
  approved_highlights TEXT[],              -- Array of content_ids
  approved_positions JSONB,                -- {1: {overview: "...", bullets: [...]}, ...}
  
  -- Settings
  format TEXT DEFAULT 'long',              -- "long" or "short"
  branding_mode TEXT DEFAULT 'branded',    -- "branded" or "generic"
  
  -- State
  current_step INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Table: learned_content

```sql
CREATE TABLE learned_content (
  id TEXT PRIMARY KEY,                    -- "P1-B08-luxury-v1"
  base_id TEXT NOT NULL,                  -- "P1-B08"
  type TEXT NOT NULL,
  context_tag TEXT,                       -- "luxury", "wealth", "tech"
  original_content TEXT,
  new_content TEXT,
  source_industry TEXT,
  times_reused INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Rules Engine

### Layer 1: HARD FILTERS (Applied as SQL WHERE clauses)

These are **non-negotiable constraints** applied BEFORE semantic ranking.

#### Position Locks
Content can ONLY appear in its designated section:

| Content ID Pattern | Allowed Section |
|-------------------|-----------------|
| `SUM-*` | Summary only |
| `CH-*` | Career Highlights OR Position bullets (not both in same resume) |
| `P1-B*` | Position 1 bullets only |
| `P2-B*` | Position 2 bullets only |
| `P3-B*` | Position 3 bullets only |
| `P4-B*` | Position 4 bullets only |
| `P5-B*` | Position 5 bullets only |
| `P6-B*` | Position 6 bullets only |
| `OV-P*` | Position overviews only |

#### Conflict Rules (Deduplication)
If item A is used, items in its conflict list are blocked:

```javascript
const CONFLICT_MAP = {
  "CH-01": ["P1-B02"],           // Deloitte practice - same $40M metric
  "CH-02": ["P2-B08"],           // NWSL - same 50% attendance metric
  "CH-03": ["P1-B04"],           // OOFOS - same 191% sales metric
  "CH-04": ["P1-B09"],           // Deloitte repositioning - same 43% lead gen
  "CH-05": ["P2-B09"],           // PfizerForAll - same $727M metric
  "CH-06": ["P1-B08"],           // LTK - same $2.8B to $5B metric
  "CH-07": ["P1-B05"],           // NYU Langone - same 1.6M appointments
  "CH-08": ["P1-B07"],           // Gateway - same 30K members
  "CH-09": ["P1-B03"],           // Amex CRM - same 5% retention
  "CH-10": ["P4-B01", "P4-B02"], // GE innovation - same awards
};
```

### Layer 2: SEMANTIC RANKING (Applied as SQL ORDER BY)

Within the filtered set, rank by cosine similarity to JD embedding:

```sql
SELECT * FROM content_items
WHERE type = 'bullet' 
  AND position = 1
  AND id NOT IN (SELECT unnest(blocked_content_ids) FROM sessions WHERE id = $session_id)
ORDER BY embedding <=> $jd_embedding
LIMIT 4;
```

### Layer 3: BUSINESS LOGIC (Applied in application code)

Additional rules applied after retrieval:

| Rule | Description |
|------|-------------|
| Max Career Highlights | Always exactly 5 |
| Max P1 Bullets | 4 (Long format) or 0 (Short format) |
| Max P2 Bullets | 3 (Long format) or 0 (Short format) |
| P3-P6 Bullets | Always 0 (overview only) |
| Branding Mode | If "generic", always use `content_generic` field |
| Version Selection | Use `content_short`, `content_medium`, or `content_long` based on format |

### Layer 4: BRANDING RULES

```javascript
const COMPETITOR_MAP = {
  // If applying to these companies, use generic versions for conflicting brands
  "McKinsey": ["Deloitte"],
  "BCG": ["Deloitte"],
  "Bain": ["Deloitte"],
  "Accenture": ["Deloitte"],
  "WPP": ["Omnicom"],
  "Publicis": ["Omnicom"],
  "IPG": ["Omnicom"],
  "Dentsu": ["Omnicom"],
};

// Always use generic for these (client confidentiality)
const ALWAYS_GENERIC = ["SAP"];
```

---

## Query Flow Example

**User applies for: VP Brand Strategy at Morgan Stanley**

```javascript
// 1. Embed the JD
const jdEmbedding = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: jobDescription
});

// 2. Store in session
await db.update(sessions)
  .set({ 
    jd_embedding: jdEmbedding,
    target_company: "Morgan Stanley",
    industry: "Financial Services"
  })
  .where(eq(sessions.id, sessionId));

// 3. Get best Career Highlights (semantic search + hard filters)
const highlights = await db.execute(sql`
  SELECT id, content_medium, 
         1 - (embedding <=> ${jdEmbedding}) as similarity
  FROM content_items
  WHERE type = 'career_highlight'
  ORDER BY embedding <=> ${jdEmbedding}
  LIMIT 5
`);

// 4. User approves → update session with used IDs
const usedIds = highlights.map(h => h.id);
const blockedIds = usedIds.flatMap(id => CONFLICT_MAP[id] || []);

await db.update(sessions)
  .set({
    used_content_ids: usedIds,
    blocked_content_ids: blockedIds,
    approved_highlights: usedIds
  })
  .where(eq(sessions.id, sessionId));

// 5. Get P1 bullets (respecting conflicts)
const p1Bullets = await db.execute(sql`
  SELECT id, content_long,
         1 - (embedding <=> ${jdEmbedding}) as similarity
  FROM content_items
  WHERE type = 'bullet'
    AND position = 1
    AND id NOT IN (${blockedIds.join(',')})
  ORDER BY embedding <=> ${jdEmbedding}
  LIMIT 4
`);
```

---

## Content Seeding

### One-Time Setup (Build Script)

Convert the unified content database to embeddings:

```javascript
// seed-database.js
import { openai } from './lib/openai';
import { db } from './lib/db';
import contentDatabase from './data/unified_content_database.json';

async function seedContent() {
  for (const item of contentDatabase.items) {
    // Create rich text for embedding (combine all versions + tags)
    const textToEmbed = [
      item.content_long,
      item.content_medium,
      item.function_tags?.join(' '),
      item.outcome_tags?.join(' '),
      item.category_tags?.join(' ')
    ].filter(Boolean).join(' ');
    
    // Generate embedding
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: textToEmbed
    });
    
    // Insert into database
    await db.insert(contentItems).values({
      id: item.id,
      type: item.type,
      position: item.position,
      content_short: item.content_short,
      content_medium: item.content_medium,
      content_long: item.content_long,
      content_generic: item.content_generic,
      brand_tags: item.brand_tags,
      category_tags: item.category_tags,
      function_tags: item.function_tags,
      outcome_tags: item.outcome_tags,
      exclusive_metrics: item.exclusive_metrics,
      embedding: response.data[0].embedding
    });
  }
  
  // Seed conflict rules
  for (const [itemId, conflictsWith] of Object.entries(CONFLICT_MAP)) {
    await db.insert(conflictRules).values({
      item_id: itemId,
      conflicts_with: conflictsWith
    });
  }
}
```

---

## API Routes

### POST /api/analyze-jd

**Input**: `{ jobDescription: string }`

**Process**:
1. Call Claude to extract: title, keywords, themes, industry, company
2. Generate embedding for JD
3. Create new session with analysis

**Output**:
```json
{
  "sessionId": "uuid",
  "analysis": {
    "targetTitle": "VP Brand Strategy",
    "targetCompany": "Morgan Stanley",
    "industry": "Financial Services",
    "keywords": ["brand strategy", "wealth management", ...],
    "themes": ["financial expertise", "creative leadership", ...],
    "recommendedBrandingMode": "branded",
    "reasoning": "No competitor conflicts detected"
  }
}
```

### POST /api/search-content

**Input**: 
```json
{
  "sessionId": "uuid",
  "contentType": "career_highlight" | "bullet" | "summary",
  "position": 1-6 | null,
  "limit": 5
}
```

**Process**:
1. Get session (includes JD embedding, used/blocked IDs)
2. Apply hard filters (type, position, not in blocked list)
3. Semantic rank by JD similarity
4. Return top N

**Output**:
```json
{
  "results": [
    {
      "id": "CH-09",
      "content": "Led CRM Strategy for Amex...",
      "similarity": 0.92,
      "brandTags": ["Amex"],
      "canUse": true
    },
    ...
  ]
}
```

### POST /api/generate-section

**Input**:
```json
{
  "sessionId": "uuid",
  "sectionType": "summary" | "highlight" | "overview" | "bullet",
  "contentIds": ["CH-09", "CH-04", ...],
  "instructions": "Emphasize wealth management experience"
}
```

**Process**:
1. Get selected content items
2. Get session context (JD analysis, approved sections)
3. Call Claude to tailor/generate section
4. Return draft

**Output**:
```json
{
  "draft": "Umberto is a brand strategist who...",
  "contentUsed": ["CH-09", "CH-04"]
}
```

### POST /api/approve-section

**Input**:
```json
{
  "sessionId": "uuid",
  "sectionType": "highlights",
  "content": "...",
  "contentIds": ["CH-09", "CH-04", "CH-10", "CH-01", "P1-B10"]
}
```

**Process**:
1. Update session with approved content
2. Add content IDs to `used_content_ids`
3. Calculate and add conflicts to `blocked_content_ids`
4. Advance `current_step`

### POST /api/export-docx

**Input**: `{ sessionId: "uuid" }`

**Process**:
1. Get all approved sections from session
2. Build .docx using docx library with exact formatting specs
3. Return file URL (Vercel Blob)

---

## User Flow (8 Steps)

### Step 0: Format Selection
- User chooses Long or Short format
- Creates session

### Step 1: JD Analysis
- User pastes JD
- System extracts title, keywords, themes
- User approves analysis

### Step 2: Header
- System generates header with extracted title
- User confirms or adjusts

### Step 3: Summary
- Semantic search for best-matching summaries
- Claude generates tailored summary
- User reviews/revises/approves

### Step 4: Career Highlights
- Semantic search for top 5 highlights
- Claude tailors language to JD
- User reviews/swaps/approves
- **System blocks conflicting bullets for later steps**

### Step 5: Position 1
- Semantic search for best P1 bullets (excluding blocked)
- Claude generates overview + tailors bullets
- User reviews/revises/approves

### Step 6: Position 2
- Same as Step 5, for P2
- 3 bullets max

### Step 7: Positions 3-6
- Overviews only (no bullets)
- Presented as group for efficiency

### Step 8: Final Assembly
- Combine all sections
- Add education
- Export as .docx

---

## DOCX Export Specifications

### Page Setup
```
Page size: A4 (8.27" x 11.69")
Margins: 0.75" all sides
```

### Typography
```
Major font (headings): Aptos Display
Minor font (body): Aptos
Fallback: Calibri
```

### Style Definitions

| Element | Font Size | Bold | Before | After | Other |
|---------|-----------|------|--------|-------|-------|
| Name | 16pt | Yes | - | - | - |
| Job Title | 12pt | No | - | - | - |
| Contact Info | 11pt | No | - | 9pt | - |
| Section Headers | 12pt | Yes | 9pt | 3pt | ALL CAPS |
| Position Title | 11pt | Yes | 6pt | - | - |
| Company Line | 11pt | No | - | 3pt | - |
| Body/Overview | 11pt | No | 6pt | 6pt | - |
| Bullets | 11pt | No | 3pt | 7.2pt | 0.25" indent |
| Career Highlight | 11pt | Mixed | 5pt | 3pt | First phrase bold |

### Career Highlight Format
```
**Bold hook phrase:** Regular supporting text with metrics...
```

---

## Memory Layer

### Capturing Refinements
When user provides feedback that creates a new version:

1. Detect if content changed from original
2. Prompt: "Save this version for future use?"
3. Store with context tag (industry, theme)

### Surfacing Learned Content
In future sessions with similar JD:

1. Check `learned_content` for matches
2. Show: "You have a 'Wealth' version from a similar role"
3. User chooses: learned version or original

### Storage
- `learned_content` table in Vercel Postgres
- Persists across all sessions
- Optional export/import as JSON

---

## Tailoring Rules

### ✅ ALLOWED
- Reorder content by relevance
- Emphasize different aspects of same achievement
- Use industry-specific language that matches the work
- Mirror JD terminology where authentic
- Select version (short/medium/long)
- Adjust title to match JD exactly

### ❌ FORBIDDEN
- Change metrics or numbers
- Add capabilities not in database
- Fabricate clients or industries
- Claim work not done
- Inflate scope or scale
- Use bullet from wrong position

---

## File Structure

```
resumeos/
├── app/
│   ├── page.tsx                    # Main UI (chat + preview)
│   ├── layout.tsx
│   └── api/
│       ├── analyze-jd/route.ts
│       ├── search-content/route.ts
│       ├── generate-section/route.ts
│       ├── approve-section/route.ts
│       └── export-docx/route.ts
├── components/
│   ├── ChatPanel.tsx
│   ├── PreviewPanel.tsx
│   ├── ProgressIndicator.tsx
│   └── ApproveButton.tsx
├── lib/
│   ├── db.ts                       # Drizzle + pgvector setup
│   ├── openai.ts                   # Embedding client
│   ├── claude.ts                   # Claude client
│   ├── rules.ts                    # Conflict map, format rules
│   └── docx-export.ts              # DOCX generation
├── data/
│   └── unified_content_database.json
├── scripts/
│   └── seed-database.ts            # One-time embedding + insert
├── drizzle/
│   └── schema.ts                   # Database schema
└── package.json
```

---

## Environment Variables

```env
# Database
POSTGRES_URL=

# OpenAI (embeddings)
OPENAI_API_KEY=

# Anthropic (generation)
ANTHROPIC_API_KEY=

# Vercel Blob (file storage)
BLOB_READ_WRITE_TOKEN=
```

---

## Deployment

1. Push to GitHub
2. Connect to Vercel
3. Add environment variables
4. Enable Vercel Postgres (with pgvector)
5. Run seed script: `npx tsx scripts/seed-database.ts`
6. Deploy

---

## Cost Estimate

| Service | Free Tier | Expected Usage | Cost |
|---------|-----------|----------------|------|
| Vercel Postgres | 256MB | ~10MB (80 items + embeddings) | Free |
| Vercel KV | 30MB | ~1MB (sessions) | Free |
| Vercel Blob | 1GB | ~50MB (DOCX files) | Free |
| OpenAI Embeddings | - | 1 JD per session (~$0.0001) | ~$0.001/resume |
| Claude API | - | ~5 calls per resume | ~$0.03/resume |

**Total**: ~$0.03 per resume generated
