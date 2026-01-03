# ResumeOS V2 — Multi-Agent Architecture

> **Author**: Claude (Planning Agent)
> **Date**: January 3, 2026
> **Status**: Architecture Proposal
> **Estimated Effort**: 4-6 weeks

---

## Executive Summary

V1 works. The architecture is solid. The problems are:
1. **Prompt quality** — No verb tracking, keyword stuffing, stateless conversations
2. **Single-agent bottleneck** — One Claude call tries to do everything
3. **No learning** — `learned_content` table exists but unused

V2 introduces a **multi-agent system** where specialized agents handle distinct tasks, coordinated by an orchestrator. This improves output quality, enables parallel processing, and creates a foundation for continuous learning.

---

## Part 1: The Multi-Agent Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE                                 │
│                  (Chat Panel + Preview Panel + Keywords)                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATOR AGENT                                │
│                                                                          │
│  • Manages conversation state         • Routes to specialists            │
│  • Tracks verb usage across resume    • Enforces content integrity       │
│  • Maintains keyword coverage map     • Decides when to proceed          │
│                                                                          │
│  Model: Sonnet 4.5 (fast, capable orchestration)                        │
└─────────────────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ JD ANALYST  │ │  CONTENT    │ │  QUALITY    │ │  KEYWORD    │
│   AGENT     │ │  SELECTOR   │ │  REVIEWER   │ │  INTEGRATOR │
│             │ │   AGENT     │ │   AGENT     │ │    AGENT    │
│ • Strategic │ │ • Semantic  │ │ • Verb check│ │ • Gap find  │
│   themes    │ │   search    │ │ • Fact check│ │ • Natural   │
│ • Keywords  │ │ • Rule      │ │ • Readabil- │ │   integrate │
│ • Industry  │ │   enforce   │ │   ity score │ │ • Density   │
│   signals   │ │ • Rank/pick │ │ • Tone      │ │   control   │
│             │ │             │ │             │ │             │
│ Opus 4.5    │ │ Sonnet 4.5  │ │ Haiku 4.5   │ │ Sonnet 4.5  │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
         │              │              │              │
         └──────────────┴──────────────┴──────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         GENERATION AGENT                                 │
│                                                                          │
│  • Receives: selected content + context + constraints                   │
│  • Produces: tailored content with <mark> tags                          │
│  • Follows: CONTENT_GENERATION_RULES.md strictly                        │
│                                                                          │
│  Model: Opus 4.5 (highest quality for final output)                     │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     DATA LAYER (Unchanged)                               │
│                                                                          │
│  Vercel Postgres + pgvector | content_items | sessions | conflict_rules │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Part 2: Agent Specifications

### Agent 1: Orchestrator

**Purpose**: Manages the overall flow, maintains state, routes to specialists

**Responsibilities**:
- Receive user input and determine intent
- Maintain conversation history across entire session
- Track verb usage globally (prevent "Spearheaded" 5x)
- Track keyword coverage (which keywords addressed where)
- Decide when content is ready vs needs more work
- Route tasks to appropriate specialist agents

**State Managed**:
```typescript
interface OrchestratorState {
  conversationHistory: Message[];
  verbTracker: {
    usedVerbs: Map<string, string[]>;  // verb → [positions used]
    availableVerbs: string[];
  };
  keywordTracker: {
    addressed: Map<string, string>;    // keywordId → sectionAddressed
    pending: string[];
    dismissed: string[];
  };
  currentSection: string;
  sectionAttempts: number;
  qualityGate: 'pending' | 'passed' | 'needs_revision';
}
```

**Model**: Sonnet 4.5 (fast routing decisions, good orchestration)

---

### Agent 2: JD Analyst

**Purpose**: Deep analysis of job descriptions

**Enhancements over V1**:
1. **Skill Mapping**: Maps JD requirements to Umbi's existing content
2. **Gap Identification**: Flags requirements with no matching content
3. **Competitor Detection**: More sophisticated brand detection
4. **Priority Weighting**: Scores keywords by importance (title > requirements > nice-to-have)

**Output**:
```typescript
interface JDAnalysis {
  strategic: {
    targetTitle: string;
    targetCompany: string;
    industry: string;
    positioningThemes: string[];
    narrativeArc: string;  // NEW: The "story" the resume should tell
  };
  keywords: {
    id: string;
    keyword: string;
    category: 'hard_skill' | 'soft_skill' | 'industry_term' | 'seniority';
    priority: number;        // 1-10 score instead of high/medium/low
    matchingContent: string[]; // NEW: Content IDs that can address this
    suggestedSection: string;  // NEW: Where to place it
  }[];
  gaps: {
    keyword: string;
    severity: 'critical' | 'moderate' | 'minor';
    workaround: string | null;  // Can we reframe existing content?
  }[];
  brandingMode: 'branded' | 'generic';
}
```

**Model**: Opus 4.5 (deep analysis requires strongest reasoning)

---

### Agent 3: Content Selector

**Purpose**: Find and rank the best content for each section

**Responsibilities**:
1. Query pgvector for semantically relevant content
2. Apply hard rules (position locks, conflicts, branding)
3. Rank by multiple factors:
   - Semantic similarity to JD
   - Keyword coverage potential
   - Diversity (don't pick 5 similar items)
4. Return ranked candidates with reasoning

**Enhancements**:
- Multi-factor ranking instead of just cosine similarity
- Explain WHY each item was selected
- Pre-compute keyword coverage for each candidate

**Model**: Sonnet 4.5 (fast, good at ranking)

---

### Agent 4: Quality Reviewer

**Purpose**: Validate generated content before approval

**Checks**:
1. **Verb Diversity**: No repeats in section, max 2x in resume
2. **Fact Integrity**: No metrics changed, no industries added
3. **Keyword Density**: Summary 8-12, bullets 1-2 each
4. **Readability**: Natural flow, not keyword-stuffed
5. **Tone**: Executive voice, not robotic

**Output**:
```typescript
interface QualityReport {
  passed: boolean;
  score: number;  // 0-100
  issues: {
    type: 'verb_repeat' | 'fact_change' | 'keyword_stuffing' | 'tone';
    severity: 'blocker' | 'warning';
    description: string;
    suggestion: string;
  }[];
  improvements: string[];  // Suggested refinements
}
```

**Model**: Haiku 4.5 (fast, cheap, good for checklist validation)

---

### Agent 5: Keyword Integrator

**Purpose**: Naturally incorporate missing keywords

**Responsibilities**:
1. Identify unaddressed high-priority keywords
2. Find natural insertion points in existing content
3. Suggest translations (user's language → JD terminology)
4. Maintain density limits

**Key Insight**: This agent TRANSLATES, not STUFFS.

**Example**:
```
JD Keyword: "customer-centric transformation"
User's Original: "shifted CRM approach to focus on retention"
Integrated: "Led customer-centric transformation of CRM, shifting focus to retention"
```

**Model**: Sonnet 4.5 (needs good language modeling)

---

### Agent 6: Generation Agent

**Purpose**: Produce the final tailored content

**Input**: Receives everything from other agents:
- Selected content items
- JD analysis
- Verb tracker state
- Keyword targets
- Quality requirements

**Output**: Polished content with <mark> tags

**Key Difference from V1**: This agent has FULL CONTEXT from all other agents, not just a single prompt trying to do everything.

**Model**: Opus 4.5 (final output quality is paramount)

---

## Part 3: Agent Communication Protocol

### Message Passing

Agents communicate through structured messages:

```typescript
interface AgentMessage {
  from: AgentType;
  to: AgentType;
  type: 'request' | 'response' | 'feedback';
  payload: {
    task: string;
    context: Record<string, unknown>;
    constraints: string[];
  };
  metadata: {
    timestamp: number;
    sessionId: string;
    traceId: string;  // For debugging agent chains
  };
}
```

### Orchestration Flow Example: Generate Summary

```
1. USER: "Generate my summary"
         │
         ▼
2. ORCHESTRATOR: 
   - Checks state (step 4, summary generation)
   - Retrieves JD analysis
   - Sends to CONTENT SELECTOR
         │
         ▼
3. CONTENT SELECTOR:
   - Queries pgvector for top 8 summaries
   - Applies rules (conflicts, branding)
   - Ranks by multi-factor score
   - Returns top 5 with reasoning
         │
         ▼
4. ORCHESTRATOR:
   - Receives 5 candidates
   - Gets current verb tracker state
   - Gets unaddressed keywords
   - Packages context for GENERATION AGENT
         │
         ▼
5. GENERATION AGENT:
   - Receives: 5 summaries + JD analysis + keywords + verb constraints
   - Produces: Draft summary with <mark> tags
         │
         ▼
6. ORCHESTRATOR:
   - Sends draft to QUALITY REVIEWER
         │
         ▼
7. QUALITY REVIEWER:
   - Runs all checks
   - Returns: { passed: true, score: 87, issues: [], improvements: [...] }
         │
         ▼
8. ORCHESTRATOR:
   - If passed: Present to user
   - If failed: Send feedback to GENERATION AGENT, retry (max 3x)
         │
         ▼
9. USER sees draft, can approve or request changes
```

---

## Part 4: Implementation Strategy

### Phase 1: Foundation (Week 1-2)

**Goal**: Refactor to support multi-agent without breaking V1

| Task | Description |
|------|-------------|
| Create agent interfaces | TypeScript interfaces for all agents |
| Build Orchestrator | State management, routing logic |
| Implement message passing | Structured communication between agents |
| Add verb tracking | Global tracker in orchestrator |
| Update session schema | Store verb tracker, enhanced keyword state |

**Deliverables**:
- `src/lib/agents/types.ts` — Agent interfaces
- `src/lib/agents/orchestrator.ts` — Orchestrator implementation
- `src/lib/agents/message-bus.ts` — Agent communication

### Phase 2: Specialist Agents (Week 3-4)

**Goal**: Implement each specialist agent

| Task | Description |
|------|-------------|
| JD Analyst Agent | Enhanced analysis with skill mapping |
| Content Selector Agent | Multi-factor ranking |
| Quality Reviewer Agent | Validation checks |
| Keyword Integrator Agent | Natural integration logic |
| Generation Agent | Full-context generation |

**Deliverables**:
- `src/lib/agents/jd-analyst.ts`
- `src/lib/agents/content-selector.ts`
- `src/lib/agents/quality-reviewer.ts`
- `src/lib/agents/keyword-integrator.ts`
- `src/lib/agents/generator.ts`

### Phase 3: Integration (Week 5)

**Goal**: Wire everything together

| Task | Description |
|------|-------------|
| Update API routes | Use orchestrator instead of direct Claude calls |
| Update UI | Show agent activity (optional) |
| End-to-end testing | Full flow with all agents |
| Performance tuning | Optimize agent calls, caching |

### Phase 4: Learning System (Week 6)

**Goal**: Enable the system to improve over time

| Task | Description |
|------|-------------|
| Implement learned_content | Store user refinements |
| Feedback loop | Track which generations users approve |
| Content evolution | Suggest new content based on patterns |

---

## Part 5: Technical Decisions

### Model Selection Rationale

| Agent | Model | Why |
|-------|-------|-----|
| Orchestrator | Sonnet 4.5 | Fast decisions, good at routing, cheaper |
| JD Analyst | Opus 4.5 | Deep strategic analysis needs best reasoning |
| Content Selector | Sonnet 4.5 | Ranking is straightforward, needs speed |
| Quality Reviewer | Haiku 4.5 | Checklist validation, high volume, cheap |
| Keyword Integrator | Sonnet 4.5 | Language manipulation, moderate complexity |
| Generator | Opus 4.5 | Final output quality is paramount |

**Cost Optimization**: Haiku for validation saves ~3x vs using Opus everywhere.

### Parallelism Opportunities

Some agents can run in parallel:
- JD Analyst + Content Selector initial query (both need JD embedding)
- Quality Reviewer can check multiple sections simultaneously
- Keyword gap detection runs parallel to generation

### Error Handling

```typescript
interface AgentError {
  agent: AgentType;
  error: string;
  recoverable: boolean;
  fallback?: () => Promise<AgentMessage>;
}

// If Quality Reviewer fails, fallback to manual approval
// If Generation Agent fails, retry with simpler prompt
// If Orchestrator fails, reset to last stable state
```

---

## Part 6: V1 → V2 Migration Path

### What Stays the Same
- Database schema (add columns, don't change existing)
- UI components (ChatPanel, PreviewPanel, etc.)
- Content database (84 items)
- Semantic search (pgvector)
- DOCX export

### What Changes
- `lib/claude.ts` → Replaced by agent implementations
- API routes → Use orchestrator
- Session state → Add verb tracker, enhanced keyword state

### Migration Strategy
1. Build V2 agents alongside V1 code
2. Feature flag to switch between V1 and V2
3. Test V2 thoroughly before removing V1
4. Gradual rollout: Start with summary generation

---

## Part 7: Success Metrics

| Metric | V1 Baseline | V2 Target |
|--------|-------------|-----------|
| Verb repetition | 5+ per resume | Max 2 |
| Keyword stuffing incidents | Common | Zero |
| User refinement rounds | 3-4 | 1-2 |
| Generation quality score | ~70 | 85+ |
| Time to complete resume | 15-20 min | 10-12 min |

---

## Part 8: Getting Started with Claude Code

### Setup for Multi-Agent Development

1. **Create worktrees for parallel development**:
```bash
cd resumeos
git worktree add ../resumeos-orchestrator feature/orchestrator
git worktree add ../resumeos-agents feature/specialist-agents
git worktree add ../resumeos-integration feature/integration
```

2. **Update CLAUDE.md** with V2 context:
```markdown
## V2 Multi-Agent Architecture

We're building a multi-agent system. Key files:
- src/lib/agents/types.ts — Agent interfaces
- src/lib/agents/orchestrator.ts — Main coordinator
- src/lib/agents/*.ts — Specialist agents

See RESUMEOS_V2_ARCHITECTURE.md for full spec.
```

3. **Create implementation specs** for each agent (I'll create these)

4. **Implement one agent at a time**, testing in isolation

---

## Appendix: File Structure for V2

```
src/
├── lib/
│   ├── agents/
│   │   ├── types.ts              # Agent interfaces and types
│   │   ├── message-bus.ts        # Agent communication
│   │   ├── orchestrator.ts       # Main orchestrator
│   │   ├── jd-analyst.ts         # JD analysis agent
│   │   ├── content-selector.ts   # Content selection agent
│   │   ├── quality-reviewer.ts   # Quality validation agent
│   │   ├── keyword-integrator.ts # Keyword integration agent
│   │   ├── generator.ts          # Content generation agent
│   │   └── index.ts              # Barrel export
│   ├── claude.ts                 # DEPRECATED - keep for V1 fallback
│   └── ... (rest unchanged)
```

---

## Questions Before Implementation

1. **Claude Max subscription?** — Affects parallel agent execution
2. **V1 stability requirement?** — Keep V1 working during V2 build?
3. **Timeline flexibility?** — 4-6 weeks aggressive, 8 weeks comfortable
4. **Learning system priority?** — Phase 4 can be deferred to V3

---

Ready to proceed when you are.
