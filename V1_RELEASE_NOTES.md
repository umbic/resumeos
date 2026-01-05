# ResumeOS V1 Release Notes

**Version:** 1.0.0  
**Release Date:** January 5, 2025  
**Status:** Functional but not production-ready  

---

## Executive Summary

ResumeOS V1 is a functional resume customization application that generates tailored resumes from a pre-written content database. Users paste a job description, the system analyzes it for themes and keywords, scores and selects the most relevant content from a tagged library, and uses Claude to rewrite the content to match JD terminology.

**The app works but the output is too generic.** The core architecture is sound, but the rewriting step doesn't sufficiently transform content to create resumes that feel tailored to specific opportunities. This is the primary focus for V2.

---

## What Works

### Core Generation Pipeline

| Feature | Status | Notes |
|---------|--------|-------|
| JD Analysis | ✅ Working | Extracts themes, keywords, industry signals |
| Content Scoring | ✅ Working | 3-level scoring (industry → function → theme) |
| Variant Selection | ✅ Working | Picks themed variants based on tag overlap |
| Conflict Enforcement | ✅ Working | CONFLICT_MAP prevents duplicate achievements |
| Claude Rewriting | ✅ Working | Reshapes language (but too conservatively) |
| Resume Assembly | ✅ Working | Combines all sections into final output |

### User Interface

| Feature | Status | Notes |
|---------|--------|-------|
| JD Input | ✅ Working | Paste job description, triggers analysis |
| Resume Preview | ✅ Working | Real-time preview of generated resume |
| Section Editing | ✅ Working | Click any section to edit manually |
| Variant Swapping | ✅ Working | View alternative versions of any content |
| Keyword Tracking | ✅ Working | Shows which JD keywords appear in resume |
| Gap Alerts | ✅ Working | Flags missing critical keywords |
| Session Management | ✅ Working | Create/switch between sessions |
| Resume Download | ✅ Working | Export as DOCX |
| Diagnostics Panel | ✅ Working | View scoring decisions and prompts |

### Scoring System

| Feature | Status | Notes |
|---------|--------|-------|
| Industry Tag Matching | ✅ Working | Direct match = 3pts, partial = 1pt |
| Function Tag Matching | ✅ Working | Direct match = 3pts, partial = 1pt |
| Theme Tag Matching | ✅ Working | Direct match = 2pts, partial = 1pt |
| Variant Selection | ✅ Working | Best theme score wins |
| Score Capping | ✅ Working | Industry/function capped at 9 |

---

## What Doesn't Work

### Chat/Refinement Feature

| Issue | Severity | Notes |
|-------|----------|-------|
| Chat interface non-functional | 🔴 Critical | Feature exists in UI but doesn't work properly |
| Refinement prompts fail | 🔴 Critical | Cannot iteratively improve sections via chat |

**Decision:** Deferred to future version. Too large to fix in V1 scope.

### Quality Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| Output too generic | 🔴 Critical | Resumes don't feel tailored to specific JDs |
| Rewriting too conservative | 🟡 Major | Claude preserves too much original language |
| Keyword insertion awkward | 🟡 Major | When keywords are added, placement feels forced |
| Scoring weights untuned | 🟡 Major | Relative weights may not reflect true importance |

### Minor Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| Quality scores inaccurate | 🟡 Minor | Scoring algorithm needs calibration |
| Some UI polish needed | 🟢 Minor | Various small UX improvements possible |

---

## Architecture Overview

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. JD Input                                                │
│     User pastes job description                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  2. JD Analysis (Claude)                                    │
│     - Extract target title/company                          │
│     - Identify priority themes (with evidence)              │
│     - Extract ATS keywords                                  │
│     - Detect industry signals                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Content Selection (Deterministic Code)                  │
│     - Score all items by industry_tags overlap              │
│     - Score by function_tags overlap                        │
│     - For each base item, select best variant by theme_tags │
│     - Enforce CONFLICT_MAP                                  │
│     - Output: 1 summary, 5 CH, 4 P1 bullets, 3 P2 bullets   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  4. Rewrite (Claude)                                        │
│     - Receives pre-selected content                         │
│     - Reshapes language to match JD terminology             │
│     - Applies quality rules (word limits, verb variety)     │
│     - Does NOT select content (already done)                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  5. Quality Check & Assembly                                │
│     - Run quality checks                                    │
│     - Auto-fix critical issues                              │
│     - Detect gaps (missing themes)                          │
│     - Assemble final resume                                 │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

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
| Deployment | Vercel |

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/content-selector.ts` | Deterministic scoring engine |
| `src/lib/prompts/rewrite-only.ts` | Claude rewriting prompt |
| `src/lib/claude.ts` | Claude API calls, generateResumeV2() |
| `src/lib/diagnostics.ts` | Logging system |
| `src/lib/rules.ts` | CONFLICT_MAP, branding rules, positions |
| `src/lib/gap-detection.ts` | Theme gap detection |
| `src/lib/quality-check.ts` | Quality scoring |
| `src/data/content-database.json` | Base content (summaries, overviews, bullets) |
| `src/data/variants.json` | Themed variants + base item metadata |
| `scripts/seed-database.ts` | Database seeding from JSON |

---

## Content Library State

### Summary

| Metric | Count |
|--------|-------|
| Total Summaries | 20 |
| Categories | BR (Brand), CA (Creative/Awards), B2B, GE (General/Enterprise) |
| Variants | None (summaries have no variants) |
| Scoring | Function tags only (not industry or theme) |

### Career Highlights

| Metric | Count |
|--------|-------|
| Base Items | 11 |
| Total Variants | 46 |
| Variants per Base | 2-6 |
| Tag Coverage | Industry: 100%, Function: 100%, Theme: 100% |

### Position Bullets

| Position | Base Items | Variants |
|----------|------------|----------|
| P1 (Deloitte Digital - SVP) | 10 | 9 |
| P2 (Deloitte Digital - Sr. Director) | 9 | 21 |
| P3-P6 | Various | None |

### Overviews

| Metric | Count |
|--------|-------|
| Total Overviews | 6 (one per position) |
| Variants | None |
| Scoring | None (just fetched by position) |

### Position Structure

| ID | Company | Title | Dates |
|----|---------|-------|-------|
| P1 | Deloitte Digital | SVP Brand Strategy / Head of Practice | May 2021 - Present |
| P2 | Deloitte Digital | Sr. Director of Brand Strategy | Apr 2018 - May 2021 |
| P3 | Omnicom Media Group | VP of Innovation | May 2016 - Apr 2018 |
| P4 | OMD Worldwide | Head of Media Innovation | Apr 2015 - May 2016 |
| P5 | Straightline International | Senior Brand Strategist | Jul 2014 - Apr 2015 |
| P6 | Berlin Cameron | Brand Strategist | Jun 2011 - Jul 2014 |

### Tagging Taxonomy

**Industry Tags:**
- professional-services, consulting, B2B, financial-services, healthcare
- technology, consumer, retail, DTC, sports-entertainment, media

**Function Tags:**
- brand-strategy, product-marketing, demand-generation, growth-strategy
- creative-strategy, integrated-campaign, executive-advisory
- brand-architecture, positioning, GTM, sales-enablement

**Theme Tags:**
- team-leadership, cross-functional, mentorship
- revenue-growth, business-development, scale
- innovation, transformation, AI, digital-transformation
- creative-excellence, brand-storytelling, campaigns

---

## Database Schema

### content_items Table

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (PK) | e.g., "CH-01", "CH-01-V2", "SUM-BR-01" |
| type | TEXT | "summary", "career_highlight", "bullet", "overview" |
| position | INTEGER | 1-6 for position-specific, NULL otherwise |
| content_short | TEXT | Short version (~20 words) |
| content_medium | TEXT | Medium version (~30 words) |
| content_long | TEXT | Long version (~40 words) |
| content_generic | TEXT | Debranded version |
| brand_tags | JSONB | Client names that can be included |
| category_tags | JSONB | Content categories |
| function_tags | JSONB | Job function alignment |
| outcome_tags | JSONB | Achievement types |
| industry_tags | JSONB | Industry alignment |
| exclusive_metrics | JSONB | Metrics unique to this item |
| base_id | TEXT | Parent item ID (for variants) |
| variant_label | TEXT | e.g., "Team Leadership", "Revenue Growth" |
| theme_tags | JSONB | Theme alignment (for variants) |
| context | TEXT | Situation/challenge |
| method | TEXT | Approach taken |
| embedding | VECTOR(1536) | OpenAI embedding |

### sessions Table

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | Session identifier |
| job_description | TEXT | Raw JD text |
| target_title | TEXT | Extracted job title |
| target_company | TEXT | Extracted company name |
| jd_analysis | JSONB | Full analysis results |
| format | TEXT | "long" or "short" |
| branding_mode | TEXT | "branded" or "generic" |
| generated_resume | JSONB | Final resume content |
| gaps | JSONB | Detected theme gaps |
| quality_score | JSONB | Quality assessment |
| used_verbs | TEXT[] | Verbs used (for variety tracking) |
| generation_version | TEXT | "v1" or "v1.5" |
| created_at | TIMESTAMP | Session creation |
| updated_at | TIMESTAMP | Last modification |

### session_diagnostics Table

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL (PK) | Auto-increment |
| session_id | UUID | Foreign key to sessions |
| event_id | TEXT | Unique event identifier |
| step | TEXT | Pipeline step name |
| substep | TEXT | Specific substep |
| status | TEXT | "pending", "success", "failed" |
| started_at | TIMESTAMP | Event start |
| completed_at | TIMESTAMP | Event end |
| duration_ms | INTEGER | Execution time |
| decisions | JSONB | Decision log array |
| prompt_sent | TEXT | LLM prompt (if applicable) |
| tokens_sent | INTEGER | Input tokens |
| response_received | TEXT | LLM response |
| tokens_received | INTEGER | Output tokens |
| input_data | JSONB | Step input |
| output_data | JSONB | Step output |
| error_message | TEXT | Error details (if failed) |

---

## API Routes

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/analyze-jd | Analyze job description |
| POST | /api/generate-resume | Generate complete resume (V2 pipeline) |
| POST | /api/refine | Chat-based refinement (non-functional) |
| POST | /api/address-gap | Apply gap recommendation |
| POST | /api/skip-gap | Mark gap as skipped |
| GET | /api/content-bank | Fetch content items |
| GET | /api/diagnostics/[sessionId] | Fetch diagnostics data |
| POST | /api/export-docx | Generate DOCX download |

---

## Conflict Map

Certain content items cannot appear together because they describe the same achievement:

| Career Highlight | Blocks Position Bullet |
|------------------|------------------------|
| CH-01 (Deloitte Practice) | P1-B02 |
| CH-02 (NWSL) | P2-B04 |
| CH-03 (OOFOS) | P1-B04 |
| CH-04 (Deloitte Repositioning) | P1-B09 |
| CH-05 (AI Brand Solutions) | P2-B03 |
| CH-06 (Pfizer/GE) | P1-B06 |
| CH-07 (American Express) | P2-B01 |
| CH-08 (Wild Turkey) | P2-B02 |
| CH-09 (Energizer Holdings) | P2-B05 |
| CH-10 (MTN DEW) | P2-B07 |
| CH-11 (Synovus/TIAA) | P1-B08 |

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| POSTGRES_URL | Vercel Postgres connection string |
| OPENAI_API_KEY | For generating embeddings |
| ANTHROPIC_API_KEY | For Claude API calls |

---

## Known Limitations

### Architectural

1. **One-shot rewriting** - Claude receives all content at once, limiting its ability to deeply tailor each section
2. **No iterative refinement** - Chat feature non-functional, no way to progressively improve
3. **Limited context** - Claude doesn't have full picture of user's background, preferences, or positioning strategy
4. **Conservative rewriting** - Prompt encourages preservation over transformation

### Content

1. **Summaries not scored properly** - Only function tags used, not industry or theme
2. **Overviews not scored at all** - Just fetched by position number
3. **No summary variants** - 20 summaries but no themed variants
4. **No overview variants** - 6 overviews with no alternatives
5. **P3-P6 bullets have no variants** - Only P1 and P2 have themed variants

### UX

1. **No guided workflow** - User must understand system to use it effectively
2. **No positioning strategy input** - User can't express how they want to be positioned
3. **No preference persistence** - Each session starts fresh

---

## Metrics & Performance

### Generation Time

| Step | Typical Duration |
|------|------------------|
| JD Analysis | 3-5 seconds |
| Content Selection | <100ms |
| Claude Rewriting | 15-25 seconds |
| Quality Check | <500ms |
| **Total** | **20-30 seconds** |

### Token Usage

| Step | Input Tokens | Output Tokens |
|------|--------------|---------------|
| JD Analysis | ~2,000 | ~800 |
| Rewriting | ~3,000-4,000 | ~1,500-2,000 |

### Database

| Metric | Value |
|--------|-------|
| Total content_items | ~132 |
| Base items | ~56 |
| Variants | ~76 |
| Embedding dimensions | 1536 |

---

## V2 Roadmap (Planned)

### Primary Goal
Dramatically improve resume output quality by creating content at the intersection of factual accomplishments and JD requirements.

### Hypotheses to Explore

1. **Multi-agent pipeline** - Specialized agents for each task instead of one-shot generation
2. **Better context retrieval** - Semantic search, restructured databases, smarter context pulling
3. **Iterative workflow** - Step-through process vs one-shot; willing to wait longer for better output
4. **Resume co-pilot** - Claude Opus 4.5 with full access to information for interactive refinement

### Potential Architecture

```
JD Analyzer Agent
       ↓
Scoring Agent
       ↓
Gap Analyzer Agent
       ↓
Positioning Agent
       ↓
Summary Writer Agent
       ↓
Career Highlights Writer Agent
       ↓
Position Overview Writer Agent
       ↓
Bullet Writer Agent
       ↓
ATS Formatter Agent
       ↓
Validator Agent
```

### Acceptable Tradeoffs
- Longer processing time (up to 5 minutes)
- Multi-step workflow requiring user interaction
- More complex architecture
- Higher API costs

---

## Deferred Features

| Feature | Reason | Priority for Future |
|---------|--------|---------------------|
| Chat refinement | Too complex for V1 scope | High (V2 co-pilot) |
| Thematic summary variants | Decided to implement in V2 | High |
| Thematic overview variants | Decided to implement in V2 | High |
| Full scoring for summaries | Blocked by above | High |
| Full scoring for overviews | Blocked by above | High |
| User preference persistence | V2 scope | Medium |
| Positioning strategy input | V2 scope | High |

---

## How to Restore V1

If you need to return to V1 state:

```bash
# Checkout the V1 tag
git checkout v1.0.0

# Or create a branch from V1
git checkout -b v1-hotfix v1.0.0

# Reseed database with V1 content
npm run db:seed
```

---

## Files in This Release

### Source Code
- Full Next.js application in `src/`
- Database schema in `src/drizzle/`
- Content library in `src/data/`
- Seed scripts in `scripts/`

### Documentation
- `CLAUDE.md` - AI assistant instructions
- `HANDOFF.md` - Session history and context
- `V1_RELEASE_NOTES.md` - This document
- `docs/` - Session implementation guides

### Configuration
- `package.json` - Dependencies and scripts
- `drizzle.config.ts` - Database configuration
- `next.config.js` - Next.js configuration
- `tailwind.config.js` - Styling configuration

---

## Contributors

- **Umberto Castaldo** - Product owner, content author, strategic direction
- **Claude (Anthropic)** - Development copilot, implementation via Claude Code

---

## Links

- **Repository:** https://github.com/umberto-castaldo/resumeos
- **Production:** https://resumeos.vercel.app
- **Tag:** v1.0.0

---

*Last updated: January 5, 2025*
