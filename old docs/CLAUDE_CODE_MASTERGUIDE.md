# Claude Code Masterguide for ResumeOS V2

> **Your Level**: Beginner → Intermediate
> **Goal**: Learn multi-agent workflows and advanced patterns to build ResumeOS V2 properly

---

## Part 1: The Fundamentals You're Missing

### What Claude Code Actually Is

Claude Code is a **terminal-based AI agent** that can:
- Read and write files
- Run bash commands
- Use tools (MCP servers, APIs)
- Spawn sub-agents for parallel work
- Chain tasks together

It's NOT just "ChatGPT in terminal." It's an **autonomous agent** that can work on tasks for 10-20 minutes without your input.

### Key Insight: Context Window is Everything

| Fact | Implication |
|------|-------------|
| 200K token context | ~150 pages of text before Claude forgets |
| Effectiveness drops after ~10-20 min | Start fresh sessions for new tasks |
| `/clear` resets context | Use liberally between tasks |
| `/compact` summarizes history | Saves 70% token space |

**When to start a new session:**
- After completing a feature
- When Claude starts forgetting things
- When responses get slow or weird
- After ~50-100 exchanges

---

## Part 2: The CLAUDE.md File (Critical)

This is the **single most important file** for your project. It's automatically loaded every time Claude Code starts.

### Where to Put It
```
resumeos/
├── CLAUDE.md          ← Main project instructions (commit to git)
├── CLAUDE.local.md    ← Your personal preferences (gitignored)
├── .claude/
│   ├── commands/      ← Custom slash commands
│   └── settings.json  ← Tool permissions
```

### What to Put In It

```markdown
# ResumeOS Project Context

## Quick Commands
- `npm run dev` — Start development server
- `npm run build` — Build for production
- `npm run lint` — Run linter

## Architecture
- This is a Next.js app deployed on Vercel
- Uses Supabase with pgvector for semantic search
- Content comes from a database—NEVER fabricate content

## Key Files
- `/lib/content-rules.ts` — Content selection logic
- `/api/generate-section/route.ts` — Claude API calls
- `/components/ResumePreview.tsx` — Live preview

## Code Style
- Use TypeScript with strict types
- Prefer async/await over .then()
- Use Tailwind for styling

## CRITICAL RULES
- NEVER modify metrics, client names, or facts in resume content
- Action verbs: max 2x per resume, never repeat in same position
- Always run `npm run typecheck` after changes

## Workflow
- Read the relevant spec file BEFORE implementing
- Write tests first when possible
- Commit after each working feature
```

### Pro Tips from Anthropic
- Keep it concise and human-readable
- Use `/init` command to auto-generate a starter
- Press `#` during conversation to add instructions Claude will remember
- Run your CLAUDE.md through the prompt improver periodically

---

## Part 3: Custom Commands (Your Secret Weapon)

Store reusable prompts in `.claude/commands/` folder. Access them with `/project:command-name`.

### Example: Create a Handoff Command

**File: `.claude/commands/handoff.md`**
```markdown
Create or update HANDOFF.md with the current session state:

1. What was just completed (be specific about files changed)
2. What's currently in progress
3. What should be tackled next
4. Any decisions made or issues encountered
5. Which tests are passing/failing

Format as a clear handoff document for the next session.
```

**Usage:** Type `/project:handoff` before ending any session.

### Example: Spec Implementation Command

**File: `.claude/commands/implement-spec.md`**
```markdown
Read the spec file: $ARGUMENTS

Then:
1. Summarize what needs to be built
2. List the files that will be created/modified
3. Identify any dependencies or prerequisites
4. Ask for confirmation before coding
5. Implement incrementally, testing as you go
6. Commit when each piece is working
```

**Usage:** `/project:implement-spec PROMPT_REWRITE_SPEC.md`

---

## Part 4: Multi-Agent Workflows (The V2 Pattern)

### The Problem with Single-Agent

One Claude session trying to do everything:
- Context fills up
- Loses track of decisions
- One-shots complex apps (usually fails)
- No verification loop

### The Solution: Specialized Agents

**Pattern 1: Git Worktrees (Parallel Development)**
```bash
# Create separate working directories
git worktree add ../resumeos-api feature/api-rewrite
git worktree add ../resumeos-ui feature/ui-refactor

# Run Claude in each (separate terminals)
cd ../resumeos-api && claude
cd ../resumeos-ui && claude
```

Each Claude works independently, no conflicts. Merge when ready.

**Pattern 2: Subagents (Built-in Feature)**

Claude Code has a `Task(...)` feature that spawns child agents:
- Main agent handles orchestration
- Subagents handle specific tasks
- Each subagent has fresh context
- Results flow back to main agent

**From the Official Docs:**
> "Telling Claude to use subagents to verify details or investigate particular questions it might have, especially early on in a conversation or task, tends to preserve context availability without much downside in terms of lost efficiency."

**Pattern 3: The "3 Amigos" Pattern**

From community best practices:
1. **PM Agent** — Creates specifications and requirements
2. **Designer Agent** — Translates to UX/implementation design
3. **Builder Agent** — Implements the code

Each agent creates artifacts that feed the next.

---

## Part 5: Best Workflows for Your Skill Level

### Workflow A: Explore → Plan → Code → Commit

**Perfect for:** Features where you're not sure how to approach it

```
You: Read the files in /api/generate-section/ and understand how 
     content generation currently works. Don't write any code yet.

Claude: [reads files, summarizes]

You: Now think hard about how to add verb tracking to prevent 
     "Spearheaded" from appearing 5 times. Make a detailed plan.

Claude: [creates plan with extended thinking]

You: Good plan. Implement step 1 only, then stop and show me.

Claude: [implements step 1]

You: Looks good. Continue with step 2.
```

### Workflow B: Test-Driven Development

**Perfect for:** Well-defined features with clear inputs/outputs

```
You: Write tests for the verb tracking feature. Requirements:
     - Track verbs used per position
     - Track verbs used across entire resume  
     - Block verbs that exceed limits
     Don't write implementation code yet.

Claude: [writes failing tests]

You: Run the tests, confirm they fail.

Claude: [runs tests, confirms failures]

You: Now implement code to make tests pass. Don't modify the tests.

Claude: [implements, iterates until tests pass]
```

### Workflow C: Headless Automation

**Perfect for:** Repetitive tasks like linting, migrations

```bash
# Fix all TypeScript errors in a file
claude -p "Fix all TypeScript errors in lib/content-rules.ts. 
           Run typecheck after each fix. Keep going until clean." \
       --allowedTools Edit Bash

# Process multiple files
for file in lib/*.ts; do
  claude -p "Add JSDoc comments to all functions in $file" --allowedTools Edit
done
```

---

## Part 6: Your ResumeOS V2 Strategy

### Phase 1: Fix V1 (1 Week)
Use single-agent workflows:
1. Run prompt audit → `/project:implement-spec PROMPT_AUDIT_REQUEST.md`
2. Rewrite prompts → Follow CONTENT_GENERATION_RULES.md
3. Add verb tracking → Test-driven workflow
4. Fix export bug → Explore → Code → Commit

### Phase 2: Build V2 (4-6 Weeks)
Use multi-agent workflows:

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR AGENT                        │
│         (manages workflow, makes high-level decisions)       │
├────────────────┬────────────────┬───────────────────────────┤
│  JD ANALYZER   │  CONTENT       │  QUALITY                  │
│  AGENT         │  SELECTOR      │  REVIEWER                 │
│                │  AGENT         │  AGENT                    │
│  - Extract     │  - Semantic    │  - Check verb rules       │
│    themes      │    search      │  - Validate facts         │
│  - Map skills  │  - Apply rules │  - Score readability      │
│  - ATS scan    │  - Rank items  │  - Suggest improvements   │
└────────────────┴────────────────┴───────────────────────────┘
```

**Git Worktree Setup:**
```bash
# Main branch for orchestration
git worktree add ../resumeos-jd-agent feature/jd-analyzer
git worktree add ../resumeos-content-agent feature/content-selector
git worktree add ../resumeos-quality-agent feature/quality-reviewer
```

Each worktree = one Claude session building one agent.

---

## Part 7: Commands to Remember

| Command | What It Does |
|---------|--------------|
| `/clear` | Reset context (use between tasks) |
| `/compact` | Summarize history, save tokens |
| `/init` | Generate starter CLAUDE.md |
| `/permissions` | Manage tool allowlist |
| `/model opus` | Switch to Opus (complex reasoning) |
| `/model sonnet` | Switch to Sonnet (faster, cheaper) |
| `Shift+Tab` | Toggle auto-accept mode |
| `Escape` | Interrupt Claude |
| `Escape Escape` | Edit previous prompt |
| `↑` (up arrow) | Browse past conversations |

### Flags for CLI

```bash
claude                          # Normal interactive mode
claude -p "prompt"              # Headless mode (non-interactive)
claude --dangerously-skip-permissions  # Auto-approve everything (use in containers)
claude --mcp-debug              # Debug MCP server connections
claude --allowedTools Edit Bash # Pre-approve specific tools
```

---

## Part 8: Your Immediate Next Steps

### Today
1. **Install Claude Code** if you haven't: `npm install -g @anthropic-ai/claude-code`
2. **Create CLAUDE.md** in your ResumeOS root using the template above
3. **Create `.claude/commands/handoff.md`** using the example above

### This Week
1. **Run the prompt audit** using the TDD workflow
2. **Create spec files** for each fix (I'll help you create these)
3. **Implement one fix at a time**, committing after each

### For V2
1. **We design the multi-agent architecture together** (here in Claude.ai)
2. **I create detailed spec files** for each agent
3. **You implement in separate worktrees** using Claude Code
4. **Merge and integrate** when agents are working

---

## Resources to Bookmark

| Resource | URL |
|----------|-----|
| Official Docs | https://code.claude.com/docs/en |
| Best Practices (Anthropic) | https://www.anthropic.com/engineering/claude-code-best-practices |
| Subagents Guide | https://code.claude.com/docs/en/sub-agents |
| MCP Servers List | https://github.com/modelcontextprotocol/servers |
| Community FAQ | https://claudelog.com/faq |
| Reddit Community | r/ClaudeAI |

---

## Key Takeaways

1. **CLAUDE.md is everything** — Invest time here, it pays dividends
2. **Context is finite** — Use `/clear` liberally, start fresh sessions
3. **Explore before coding** — Ask Claude to read files and plan first
4. **Subagents preserve context** — Use them for complex investigations
5. **Worktrees for parallel work** — Multiple Claudes, no conflicts
6. **Commit often** — Small, working pieces > big bangs
7. **Handoff documents** — Essential for continuity between sessions

---

## Questions for You

Before we proceed:

1. **Do you have Claude Max subscription?** (Affects worktree parallelism)
2. **Are you comfortable with git worktrees?** (Or should we stick to simpler patterns)
3. **V1 fixes first, or jump to V2?** (I recommend V1 fixes as learning opportunity)

Let me know and we'll chart the path forward.
