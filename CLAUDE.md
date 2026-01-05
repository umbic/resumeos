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
