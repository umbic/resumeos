# SESSION 1: Verb Tracking Infrastructure

## Context
Read CONTENT_GENERATION_RULES.md section on verb tracking (Part 3 and Appendix).

## Task
Add verb tracking infrastructure. NO prompt changes yet - just the data layer.

## Steps

### 1. Add VerbTracker interface to `src/types/index.ts`:
```typescript
export interface VerbTracker {
  usedVerbs: Record<string, string[]>; // verb → array of sections where used
  availableVerbs: string[];
}

// Add to Session interface
verbTracker?: VerbTracker;
```

### 2. Update `src/drizzle/schema.ts`:
Add to sessions table:
```typescript
verb_tracker: jsonb('verb_tracker').default({
  usedVerbs: {},
  availableVerbs: [
    'Built', 'Developed', 'Created', 'Established', 'Launched', 'Designed',
    'Led', 'Directed', 'Oversaw', 'Managed', 'Headed', 'Guided',
    'Grew', 'Scaled', 'Expanded', 'Increased', 'Accelerated', 'Drove',
    'Transformed', 'Repositioned', 'Modernized', 'Revitalized', 'Redesigned',
    'Architected', 'Defined', 'Shaped', 'Crafted', 'Pioneered', 'Championed',
    'Delivered', 'Executed', 'Implemented', 'Activated', 'Orchestrated'
  ]
}),
```

### 3. Update `src/lib/store.ts`:
Add verbTracker to Zustand store state.

### 4. Generate migration:
```bash
npm run db:generate
```

### 5. Run migration:
```bash
npx dotenv -e .env.local -- npm run db:migrate
```

## Commit
```bash
git add .
git commit -m "feat: add verb tracking infrastructure"
```

## Update HANDOFF.md
Document what was done and that Session 2 is next.

## Success Criteria
- [ ] Types compile without errors
- [ ] Migration runs successfully
- [ ] Store has verbTracker state
- [ ] No API or prompt changes yet
