# SESSION 3: Wire Verb Tracking to API Routes

## Context
Sessions 1-2 added the infrastructure and prompt changes. Now wire it through the API layer.

## Task
Connect verb tracking through the full request/response cycle.

## Steps

### 1. Update `/api/generate-section/route.ts`:

Fetch verb tracker from session:
```typescript
// After fetching session
const verbTracker = session.verb_tracker || { usedVerbs: {}, availableVerbs: [] };
const allUsedVerbs = Object.values(verbTracker.usedVerbs).flat();
```

Pass to generation functions:
```typescript
// For summary generation
const result = await generateSummary(
  summaryOptions,
  jdAnalysis,
  format,
  allUsedVerbs  // ADD THIS
);

// For tailored content
const result = await generateTailoredContent(
  originalContent,
  jdAnalysis,
  sectionType,
  allUsedVerbs,  // ADD THIS
  instructions
);
```

Include in response:
```typescript
return NextResponse.json({
  draft: result.content,
  detectedVerbs: result.detectedVerbs,  // ADD THIS
  // ... rest of response
});
```

### 2. Update `/api/approve-section/route.ts`:

Extract and save verbs when content is approved:
```typescript
import { extractVerbsFromContent } from '@/lib/claude';

// After content is approved, before saving session
const detectedVerbs = extractVerbsFromContent(
  typeof content === 'string' ? content : JSON.stringify(content)
);

// Update verb tracker
const currentTracker = session.verb_tracker || { usedVerbs: {}, availableVerbs: [] };
const sectionKey = sectionType === 'position' 
  ? `position_${positionData?.position}` 
  : sectionType;

currentTracker.usedVerbs[sectionKey] = detectedVerbs;

// Remove used verbs from available
currentTracker.availableVerbs = currentTracker.availableVerbs.filter(
  v => !detectedVerbs.includes(v)
);

// Save to session
await db.update(sessions)
  .set({ 
    verb_tracker: currentTracker,
    // ... other updates
  })
  .where(eq(sessions.id, sessionId));
```

### 3. Test locally:

1. Start dev server: `npm run dev`
2. Create a new session
3. Generate summary → Check that verbs are tracked
4. Approve summary → Check that verb_tracker is updated in DB
5. Generate highlights → Check that used verbs are excluded

## Commit
```bash
git add .
git commit -m "feat: wire verb tracking through API layer"
```

## Update HANDOFF.md

## Success Criteria
- [ ] generate-section passes usedVerbs to Claude
- [ ] approve-section extracts and saves verbs
- [ ] Subsequent generations exclude already-used verbs
- [ ] Can verify in database that verb_tracker updates
