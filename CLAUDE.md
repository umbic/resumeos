# CLAUDE.md - ResumeOS

## Project Overview

**ResumeOS** is a conversational resume customization app. Users paste a job description, and the system guides them through building a tailored resume section by section, using semantic search to find the most relevant content from a pre-built database.

**Key Principle**: The system ONLY selects and reframes existing content—it never fabricates new achievements, metrics, or experiences.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 14 (App Router) |
| Database | Vercel Postgres with pgvector |
| ORM | Drizzle ORM |
| Embeddings | OpenAI text-embedding-3-small |
| LLM | Anthropic Claude (claude-sonnet-4-20250514) |
| UI | React + Tailwind CSS + shadcn/ui |
| State | Zustand |
| File Generation | docx library |

## File Structure

```
src/
├── app/
│   ├── page.tsx                    # Main ResumeBuilder UI
│   ├── layout.tsx
│   └── api/
│       ├── analyze-jd/route.ts     # JD analysis + session creation
│       ├── search-content/route.ts # Semantic search with rules
│       ├── generate-section/route.ts # Claude content generation
│       ├── approve-section/route.ts  # Save + conflict tracking
│       └── export-docx/route.ts    # DOCX generation
├── components/
│   ├── resume/
│   │   ├── ChatPanel.tsx           # Left panel conversation
│   │   ├── PreviewPanel.tsx        # Right panel resume preview
│   │   ├── ProgressBar.tsx         # 8-step progress indicator
│   │   └── ResumeBuilder.tsx       # Main orchestrator
│   └── ui/                         # shadcn/ui components
├── lib/
│   ├── db.ts                       # Database connection
│   ├── openai.ts                   # Embedding client
│   ├── claude.ts                   # Claude API client
│   ├── rules.ts                    # Conflict map, format rules, branding
│   ├── store.ts                    # Zustand state management
│   ├── docx-export.ts              # DOCX generation with styles
│   └── utils.ts
├── drizzle/
│   └── schema.ts                   # Database schema
├── data/
│   └── content-database.json       # All resume content
└── scripts/
    └── seed-database.ts            # Database seeding script
```

## Commands

```bash
# Development
npm run dev

# Build
npm run build

# Database seeding (run after deploying to Vercel with Postgres)
npm run db:seed

# Generate Drizzle migrations
npm run db:generate
```

## Environment Variables

Required in `.env.local`:

```
POSTGRES_URL=            # Vercel Postgres connection string
OPENAI_API_KEY=          # For embeddings
ANTHROPIC_API_KEY=       # For Claude
```

## 8-Step User Flow

1. **Format Selection** → Long or Short format
2. **JD Analysis** → Paste JD, system extracts keywords/themes
3. **Header** → Confirm name + extracted title
4. **Summary** → Generate and refine summary
5. **Career Highlights** → Select and tailor 5 highlights
6. **Position 1** → Overview + 4 bullets (Long) or overview only (Short)
7. **Position 2** → Overview + 3 bullets (Long) or overview only (Short)
8. **Positions 3-6** → Overviews only, review as group

## Rules Engine

### Conflict Rules (Deduplication)
When an item is used, its conflicts get blocked to prevent duplicate metrics:

```javascript
const CONFLICT_MAP = {
  "CH-01": ["P1-B02"],  // Deloitte practice
  "CH-02": ["P2-B08"],  // NWSL metrics
  // ... etc
};
```

### Branding Rules
If applying to competitors (McKinsey, BCG, etc.), use generic versions that hide competitor names.

### Format Rules
- **Long**: Full overview + 4 bullets for P1, 3 for P2
- **Short**: Overviews only, no bullets

## Deployment Steps

1. Push to GitHub
2. Connect to Vercel
3. Add Vercel Postgres database
4. Add environment variables (POSTGRES_URL, OPENAI_API_KEY, ANTHROPIC_API_KEY)
5. Deploy
6. Run seed script: `npm run db:seed`

## Content Database

The content database (`src/data/content-database.json`) contains:
- **8 Thematic Summaries** (SUM-B2B, SUM-FS, SUM-TECH, SUM-CON, SUM-CE, SUM-PM, SUM-BS, SUM-PG)
- 11 Career Highlights
- 10 Position 1 Bullets
- 9 Position 2 Bullets
- 3 Position 3 Bullets
- 2 Position 4 Bullets
- 2 Position 5 Bullets
- 1 Position 6 Bullet
- 6 Position Overviews

The variants database (`src/data/variants.json`) contains:
- 21 Base items with industry/function metadata
- 76 CH and bullet variants with theme tags
- **16 Overview variants** (8 for P1, 8 for P2 - one per theme)

## 3-Level Scoring System

Content selection uses a 3-level scoring system based on JD analysis:

| Level | Tags | Purpose |
|-------|------|---------|
| Industry | `industryTags` | Match sector (B2B, financial-services, technology, consumer, etc.) |
| Function | `functionTags` | Match role type (brand-strategy, product-marketing, GTM, etc.) |
| Theme | `themeTags` | Match specific skills/approaches (acquisition, creative-excellence, etc.) |

**Summary Selection**: Scores all 8 summaries using industry + function + theme, selects highest.

**Overview Selection**:
- P1/P2: Scores 8 variants each using industry + function + theme, selects best match
- P3-P6: Uses base overviews (no variants)

**CH/Bullet Selection**: Uses existing variant scoring system with theme tags.

## Diagnostics System

The app includes a comprehensive diagnostics system for debugging resume generation:

### Viewing Diagnostics
- **In-app panel**: Visible in the right panel after generation
- **Dedicated page**: Navigate to `/diagnostics/[sessionId]` for full-page view
- **Export**: Download full diagnostics as JSON

### What Gets Logged
- **JD Analysis**: Full prompt/response from Claude, extracted keywords/themes
- **Content Selection**: Every item scored with industry/function/theme breakdown
- **Variant Comparison**: All variants scored for each base item
- **Conflict Blocking**: Which items blocked due to metric conflicts
- **Rewrite**: Full prompt/response with token counts and cost
- **Final Assembly**: Selected content IDs and keyword coverage

### Key Files
- `src/lib/diagnostics.ts` - DiagnosticLogger class
- `src/components/diagnostics/DiagnosticsPanel.tsx` - In-app panel
- `src/app/diagnostics/[sessionId]/page.tsx` - Dedicated diagnostics page
- `src/app/api/diagnostics/[sessionId]/route.ts` - API endpoint

## V3 Architecture (In Development)

V3 replaces V2.1's abstract tag-based approach with **phrase-level JD analysis** and **explicit JD mapping**.

### Key Differences from V2.1

| Aspect | V2.1 | V3 |
|--------|------|-----|
| JD Analysis | Abstract tags (industry, function, theme) | Exact phrases with weights (HIGH/MEDIUM/LOW) |
| Content Selection | Tag matching score | Explicit JD phrase mapping |
| Coverage Tracking | None | Per-section with Strong/Partial/Gap |
| State Management | Session-level | Chat-to-chat accumulation |

### V3 Pipeline (6 Sequential Chats)

```
JD Analyzer → Summary → CH → P1 → P2 → P3-P6
     ↓           ↓       ↓    ↓     ↓
  phrases    anchors  state state  final
```

Each chat passes state downstream:
- `usedBaseIds` — prevents duplicate content
- `usedVerbs` — prevents verb repetition
- `usedMetrics` — prevents metric duplication
- `jdSectionsCovered` — tracks coverage gaps

### V3 File Structure

```
src/lib/v3/
├── types.ts              # ✅ All V3 types (469 lines)
├── validators.ts         # ✅ Output validation - 6 validators (455 lines)
├── voice-guide.ts        # ✅ Voice/formatting rules (97 lines)
├── prompts/
│   ├── index.ts          # ✅ Prompt exports
│   ├── jd-analyzer.ts    # ✅ JD analysis prompt
│   ├── summary-chat.ts   # ✅ Summary generation
│   ├── ch-chat.ts        # ✅ Career highlights
│   ├── p1-chat.ts        # ✅ Position 1
│   ├── p2-chat.ts        # ✅ Position 2
│   └── p3p6-chat.ts      # ✅ Positions 3-6
├── claude-client.ts      # ✅ Claude API wrapper (61 lines)
├── content-loader.ts     # ✅ Content source loader (290 lines)
├── orchestrator.ts       # ✅ Pipeline runner with retry (520 lines)
├── assembler.ts          # ✅ Resume assembly (120 lines)
├── docx-generator.ts     # ✅ DOCX output (210 lines)
├── coverage-report.ts    # ✅ JD coverage analysis (105 lines)
├── index.ts              # ✅ Main entry point (100 lines)
└── __tests__/
    └── validators.test.ts # ✅ 39 unit tests
```

### V3 Implementation Progress

| Session | Status | Deliverables |
|---------|--------|--------------|
| 1. Types + Validators | ✅ Done | types.ts, validators.ts, tests |
| 2. JD + Summary Prompts | ✅ Done | voice-guide.ts, jd-analyzer.ts, summary-chat.ts |
| 3. CH + P1 Prompts | ✅ Done | ch-chat.ts, p1-chat.ts |
| 4. P2 + P3-P6 Prompts | ✅ Done | p2-chat.ts, p3p6-chat.ts |
| 5. Orchestrator | ✅ Done | orchestrator.ts, content-loader.ts, claude-client.ts |
| 6. Assembler + DOCX | ✅ Done | assembler.ts, docx-generator.ts, coverage-report.ts, index.ts |
| 7. API Routes | ✅ Done | /api/v3/generate, /api/v3/generate/download |
| 8. UI + Deployment | ✅ Done | /v3 page, dashboard integration, Vercel deployment |

### V3 Live URLs

- **Dashboard**: https://resumeos.vercel.app/
- **V3 Generation**: https://resumeos.vercel.app/v3

### V3 Reference Documents

- `docs/RESUMEOS_V3_IMPLEMENTATION_FINAL.md` — Complete technical specification
- `docs/V3_IMPLEMENTATION_SESSIONS.md` — 8-session implementation plan
