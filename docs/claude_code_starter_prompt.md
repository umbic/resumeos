# ResumeOS - Claude Code Starter Prompt

## Project Overview

Build a conversational resume customization app called **ResumeOS**. The user pastes a job description, and the system guides them through building a tailored resume section by section, using semantic search to find the most relevant content from a pre-built database.

**Key Principle**: The system ONLY selects and reframes existing content—it never fabricates new achievements, metrics, or experiences.

---

## Technical Requirements

### Stack
- **Framework**: Next.js 14 (App Router)
- **UI**: React + Tailwind CSS + shadcn/ui
- **Database**: Vercel Postgres with pgvector extension
- **ORM**: Drizzle ORM
- **Embeddings**: OpenAI text-embedding-3-small
- **LLM**: Anthropic Claude (via Vercel AI SDK)
- **File Generation**: docx library
- **Deployment**: Vercel

### Environment Variables Needed
```
POSTGRES_URL=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
BLOB_READ_WRITE_TOKEN=
```

---

## Core Architecture

### Two-Panel UI Layout
```
┌─────────────────────────────────────────────────────────────┐
│                        HEADER                                │
├─────────────────────────────┬───────────────────────────────┤
│                             │                               │
│      CHAT PANEL             │      PREVIEW PANEL            │
│      (Left 40%)             │      (Right 60%)              │
│                             │                               │
│  - Conversational UI        │  - Live resume preview        │
│  - Claude responses         │  - Updates as sections        │
│  - User input               │    are approved               │
│                             │  - Styled like final doc      │
│                             │                               │
├─────────────────────────────┴───────────────────────────────┤
│  PROGRESS BAR: [1]─[2]─[3]─[4]─[5]─[6]─[7]─[8]              │
│                                          [Approve & Continue]│
└─────────────────────────────────────────────────────────────┘
```

### 8-Step User Flow

1. **Format Selection** → Long or Short format
2. **JD Analysis** → Paste JD, system extracts keywords/themes
3. **Header** → Confirm name + extracted title
4. **Summary** → Generate and refine summary
5. **Career Highlights** → Select and tailor 5 highlights
6. **Position 1** → Overview + 4 bullets (Long) or overview only (Short)
7. **Position 2** → Overview + 3 bullets (Long) or overview only (Short)
8. **Positions 3-6** → Overviews only, review as group

Each step: System drafts → User reviews → Iterate → Approve → Next

---

## Database Schema

### Enable pgvector
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### content_items table
```sql
CREATE TABLE content_items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,                     -- "summary", "career_highlight", "bullet", "overview"
  position INTEGER,                       -- 1-6 for position-specific, NULL otherwise
  
  content_short TEXT,
  content_medium TEXT,
  content_long TEXT,
  content_generic TEXT,
  
  brand_tags TEXT[],
  category_tags TEXT[],
  function_tags TEXT[],
  outcome_tags TEXT[],
  exclusive_metrics TEXT[],
  
  embedding VECTOR(1536),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX content_embedding_idx ON content_items 
USING hnsw (embedding vector_cosine_ops);
```

### conflict_rules table
```sql
CREATE TABLE conflict_rules (
  id SERIAL PRIMARY KEY,
  item_id TEXT NOT NULL,
  conflicts_with TEXT[] NOT NULL,
  reason TEXT
);
```

### sessions table
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_description TEXT,
  target_title TEXT,
  target_company TEXT,
  industry TEXT,
  jd_embedding VECTOR(1536),
  
  used_content_ids TEXT[] DEFAULT '{}',
  blocked_content_ids TEXT[] DEFAULT '{}',
  
  approved_header JSONB,
  approved_summary TEXT,
  approved_highlights TEXT[],
  approved_positions JSONB,
  
  format TEXT DEFAULT 'long',
  branding_mode TEXT DEFAULT 'branded',
  current_step INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Rules Engine (CRITICAL)

### Layer 1: Position Locks
Content can ONLY appear in its designated section:

| ID Pattern | Allowed In |
|------------|------------|
| `SUM-*` | Summary section only |
| `CH-*` | Career Highlights (or as P1/P2 bullet if not used in highlights) |
| `P1-B*` | Position 1 bullets only |
| `P2-B*` | Position 2 bullets only |
| `P3-B*` | Position 3 bullets only |
| `P4-B*` | Position 4 bullets only |
| `P5-B*` | Position 5 bullets only |
| `P6-B*` | Position 6 bullets only |
| `OV-P*` | Position overviews only |

### Layer 2: Conflict Rules (Deduplication)
When an item is used, its conflicts get blocked:

```javascript
const CONFLICT_MAP = {
  "CH-01": ["P1-B02"],
  "CH-02": ["P2-B08"],
  "CH-03": ["P1-B04"],
  "CH-04": ["P1-B09"],
  "CH-05": ["P2-B09"],
  "CH-06": ["P1-B08"],
  "CH-07": ["P1-B05"],
  "CH-08": ["P1-B07"],
  "CH-09": ["P1-B03"],
  "CH-10": ["P4-B01", "P4-B02"],
};
```

### Layer 3: Semantic Search
After applying hard filters, rank by cosine similarity to JD:

```sql
SELECT id, content_long, 1 - (embedding <=> $jd_embedding) as similarity
FROM content_items
WHERE type = 'career_highlight'
  AND id NOT IN (SELECT unnest($blocked_ids))
ORDER BY embedding <=> $jd_embedding
LIMIT 5;
```

### Layer 4: Format Rules
```javascript
const FORMAT_RULES = {
  long: {
    career_highlights: { count: 5, version: "medium" },
    position_1: { bullets: 4, version: "long" },
    position_2: { bullets: 3, version: "long" },
    positions_3_6: { bullets: 0 }
  },
  short: {
    career_highlights: { count: 5, version: "short" },
    position_1: { bullets: 0 },
    position_2: { bullets: 0 },
    positions_3_6: { bullets: 0 }
  }
};
```

### Layer 5: Branding Rules
```javascript
const COMPETITOR_MAP = {
  "McKinsey": ["Deloitte"],
  "BCG": ["Deloitte"],
  "Bain": ["Deloitte"],
  "Accenture": ["Deloitte"],
  // ... etc
};

// If targetCompany matches a key, use content_generic for items with those brand_tags
```

---

## API Routes

### POST /api/analyze-jd
- Input: `{ jobDescription: string }`
- Process: Claude extracts title, keywords, themes, industry, company
- Process: OpenAI generates embedding for JD
- Process: Create session
- Output: `{ sessionId, analysis: { targetTitle, keywords, themes, industry, ... } }`

### POST /api/search-content
- Input: `{ sessionId, contentType, position?, limit }`
- Process: Get session's JD embedding and blocked IDs
- Process: Query with hard filters + semantic ranking
- Output: `{ results: [{ id, content, similarity, brandTags }] }`

### POST /api/generate-section
- Input: `{ sessionId, sectionType, contentIds, instructions? }`
- Process: Get content items by IDs
- Process: Claude tailors content to JD context
- Output: `{ draft: string, contentUsed: string[] }`

### POST /api/approve-section
- Input: `{ sessionId, sectionType, content, contentIds }`
- Process: Update session with approved content
- Process: Add IDs to used_content_ids
- Process: Calculate and add conflicts to blocked_content_ids
- Output: `{ success: true, nextStep: number }`

### POST /api/export-docx
- Input: `{ sessionId }`
- Process: Build .docx with all approved sections
- Output: `{ downloadUrl: string }`

---

## DOCX Export Specifications

### Page Setup
- Size: A4 (8.27" x 11.69")
- Margins: 0.75" all sides

### Fonts
- Headings: Aptos Display (fallback: Calibri)
- Body: Aptos (fallback: Calibri)

### Styles
| Element | Size | Bold | Before | After |
|---------|------|------|--------|-------|
| Name | 16pt | Yes | - | - |
| Job Title | 12pt | No | - | - |
| Contact | 11pt | No | - | 9pt |
| Section Header | 12pt | Yes | 9pt | 3pt |
| Position Title | 11pt | Yes | 6pt | - |
| Company | 11pt | No | - | 3pt |
| Body | 11pt | No | 6pt | 6pt |
| Bullets | 11pt | No | 3pt | 7.2pt |

### Career Highlight Format
Each highlight has: **Bold hook phrase:** Regular supporting text

---

## Content Database

The content database (unified_content_database_v4.md) contains:
- 20 Summaries (5 each: BR, CA, B2B, GE categories)
- 11 Career Highlights (with short/medium/long versions)
- Position bullets (P1: 10, P2: 9, P3: 3, P4: 2, P5: 2, P6: 1)
- Position overviews (6 total)

Each item has:
- Multiple content versions (short, medium, long, generic)
- Brand tags (for competitor filtering)
- Category/function/outcome tags (for semantic context)
- Exclusive metrics (for deduplication reference)

### Seeding Script
Create a script that:
1. Reads the content database JSON
2. For each item, generates an OpenAI embedding from concatenated content + tags
3. Inserts into content_items table
4. Inserts conflict rules into conflict_rules table

---

## Key Files to Create

```
resumeos/
├── app/
│   ├── page.tsx                    # Main two-panel UI
│   ├── layout.tsx
│   └── api/
│       ├── analyze-jd/route.ts
│       ├── search-content/route.ts
│       ├── generate-section/route.ts
│       ├── approve-section/route.ts
│       └── export-docx/route.ts
├── components/
│   ├── ChatPanel.tsx               # Left panel with conversation
│   ├── PreviewPanel.tsx            # Right panel with live resume
│   ├── ProgressBar.tsx             # Step indicator
│   ├── MessageBubble.tsx           # Chat message component
│   └── ApproveButton.tsx           # "Approve & Continue" button
├── lib/
│   ├── db.ts                       # Drizzle setup with pgvector
│   ├── openai.ts                   # Embedding client
│   ├── claude.ts                   # Claude client via Vercel AI SDK
│   ├── rules.ts                    # Conflict map, format rules, branding rules
│   ├── search.ts                   # Semantic search with filters
│   └── docx-export.ts              # DOCX generation with styles
├── drizzle/
│   ├── schema.ts                   # Database schema
│   └── migrations/
├── scripts/
│   └── seed-database.ts            # One-time content + embedding seeding
├── data/
│   └── content-database.json       # Source content (convert from .md)
└── types/
    └── index.ts                    # TypeScript types
```

---

## Implementation Notes

### Semantic Search Flow
```typescript
async function searchContent(sessionId: string, type: string, position?: number, limit = 5) {
  const session = await getSession(sessionId);
  
  const results = await db.execute(sql`
    SELECT 
      id, 
      content_short, 
      content_medium, 
      content_long,
      content_generic,
      brand_tags,
      1 - (embedding <=> ${session.jd_embedding}) as similarity
    FROM content_items
    WHERE type = ${type}
      ${position ? sql`AND position = ${position}` : sql``}
      AND id NOT IN (${session.blocked_content_ids})
    ORDER BY embedding <=> ${session.jd_embedding}
    LIMIT ${limit}
  `);
  
  return results;
}
```

### Conflict Handling
```typescript
async function approveContent(sessionId: string, contentIds: string[]) {
  // Get all conflicts for newly approved content
  const newBlocks = contentIds.flatMap(id => CONFLICT_MAP[id] || []);
  
  await db.update(sessions)
    .set({
      used_content_ids: sql`array_cat(used_content_ids, ${contentIds})`,
      blocked_content_ids: sql`array_cat(blocked_content_ids, ${newBlocks})`
    })
    .where(eq(sessions.id, sessionId));
}
```

### Claude Prompts

**For JD Analysis:**
```
Analyze this job description and extract:
1. Target job title (exactly as it should appear on resume)
2. Target company name
3. Industry/sector
4. Key skills and keywords (for ATS)
5. Positioning themes (strategic angles to emphasize)
6. Any competitor concerns (is this a Deloitte/McKinsey/etc competitor?)

Job Description:
{jd}
```

**For Content Tailoring:**
```
You are helping tailor resume content for a specific job application.

JD Analysis:
{analysis}

Original Content:
{content}

Instructions:
Reframe this content to emphasize aspects most relevant to the target role.
You may:
- Reorder emphasis
- Use industry-specific language that matches the JD
- Mirror JD terminology where authentic

You may NOT:
- Change any metrics or numbers
- Add capabilities not present in the original
- Fabricate clients or experiences
- Inflate scope or scale

Return only the tailored content, no explanation.
```

---

## Deployment Steps

1. Create GitHub repo
2. Connect to Vercel
3. Add Vercel Postgres database
4. Enable pgvector extension in Postgres
5. Add environment variables
6. Run database migrations
7. Run seed script
8. Deploy

---

## Reference Documents

The following files contain the complete specifications:
- `resume_system_design_v3.md` - Full system architecture
- `content_database_schema.md` - JSON schema for content
- `unified_content_database_v4.md` - Actual content data
- `Umberto_Castaldo_Head_of_Brand___Creative_Strategy__Wealth_Marketing.docx` - DOCX formatting reference

---

## Success Criteria

1. User can paste any JD and get relevant content suggestions
2. Semantic search surfaces the most relevant bullets/highlights
3. Position locks prevent bullets from wrong positions appearing
4. Conflict rules prevent duplicate metrics across sections
5. Branding rules hide competitor brands when appropriate
6. Export produces properly formatted .docx
7. Complete resume generation in under 10 minutes of interaction
