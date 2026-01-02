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
- 20 Summaries (5 each: BR, CA, B2B, GE categories)
- 11 Career Highlights
- 10 Position 1 Bullets
- 9 Position 2 Bullets
- 3 Position 3 Bullets
- 2 Position 4 Bullets
- 2 Position 5 Bullets
- 1 Position 6 Bullet
- 6 Position Overviews

Each item has embeddings for semantic search and multiple content versions (short, medium, long, generic).
