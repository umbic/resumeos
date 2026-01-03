# SESSION 2: Verb Tracking in Prompts

## Context
Read CONTENT_GENERATION_RULES.md:
- Part 3: Action Verb Rules
- Part 10: Prompt Requirements

## Task
Update Claude prompts to receive and respect verb constraints.

## Steps

### 1. Create helper function in `src/lib/claude.ts`:

```typescript
// Add at top of file
const VERB_PATTERNS = [
  'Built', 'Developed', 'Created', 'Established', 'Launched', 'Designed',
  'Led', 'Directed', 'Oversaw', 'Managed', 'Headed', 'Guided',
  'Grew', 'Scaled', 'Expanded', 'Increased', 'Accelerated', 'Drove',
  'Transformed', 'Repositioned', 'Modernized', 'Revitalized', 'Redesigned',
  'Architected', 'Defined', 'Shaped', 'Crafted', 'Pioneered', 'Championed',
  'Delivered', 'Executed', 'Implemented', 'Activated', 'Orchestrated'
];

export function extractVerbsFromContent(content: string): string[] {
  const found: string[] = [];
  for (const verb of VERB_PATTERNS) {
    // Match verb at start of sentence or after bullet
    const regex = new RegExp(`(?:^|[•\\-\\n])\\s*${verb}\\b`, 'gi');
    if (regex.test(content)) {
      found.push(verb);
    }
  }
  return [...new Set(found)]; // Dedupe
}
```

### 2. Update `generateTailoredContent()`:

Add parameter:
```typescript
export async function generateTailoredContent(
  originalContent: string,
  jdAnalysis: JDAnalysis,
  sectionType: string,
  usedVerbs: string[] = [],  // ADD THIS
  instructions?: string
): Promise<{ content: string; detectedVerbs: string[] }>
```

Add to prompt after ALLOWED CUSTOMIZATIONS:
```
VERB CONSTRAINTS:
The following verbs have already been used in this resume and MUST NOT be used again:
${usedVerbs.length > 0 ? usedVerbs.join(', ') : 'None yet'}

Choose action verbs from this list that haven't been used:
Built, Developed, Created, Launched, Led, Directed, Grew, Scaled, 
Transformed, Architected, Delivered, Executed, Pioneered, Championed

CRITICAL: Do not start any bullet with a verb from the "already used" list.
```

Return detected verbs:
```typescript
const detectedVerbs = extractVerbsFromContent(content);
return { content, detectedVerbs };
```

### 3. Update `generateSummary()`:

Same pattern - add usedVerbs parameter and verb constraint block.

### 4. Update `refinePositionContent()`:

Same pattern - add usedVerbs parameter and verb constraint block.

## Do NOT modify API routes yet - that's Session 3.

## Commit
```bash
git add .
git commit -m "feat: add verb constraints to generation prompts"
```

## Update HANDOFF.md

## Success Criteria
- [ ] All generation functions accept usedVerbs parameter
- [ ] All prompts include verb constraint section
- [ ] extractVerbsFromContent() works correctly
- [ ] Functions return detected verbs
