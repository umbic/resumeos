# SESSION 5: Conversation History for All Sections

## Context
Currently only position refinement has conversation history. Summary and highlights are one-shot.

## Task
Add conversation history so users can refine any section through dialogue.

## Steps

### 1. Update `src/lib/store.ts`:

Add conversation history to store:
```typescript
interface ResumeState {
  // ... existing state
  
  // ADD: Conversation history per section
  conversationHistory: Record<string, Message[]>;
  
  // ADD: Actions
  addMessage: (section: string, message: Message) => void;
  clearSectionHistory: (section: string) => void;
}

// In create():
conversationHistory: {},

addMessage: (section, message) => set((state) => ({
  conversationHistory: {
    ...state.conversationHistory,
    [section]: [...(state.conversationHistory[section] || []), message]
  }
})),

clearSectionHistory: (section) => set((state) => ({
  conversationHistory: {
    ...state.conversationHistory,
    [section]: []
  }
})),
```

### 2. Update `/api/generate-section/route.ts`:

Accept conversation history:
```typescript
// In request body parsing
const { 
  sessionId, 
  sectionType, 
  contentIds, 
  instructions,
  conversationHistory = []  // ADD THIS
} = await request.json();
```

For summary refinement (new logic):
```typescript
if (sectionType === 'summary' && conversationHistory.length > 0) {
  // This is a refinement, not first generation
  const result = await refineSummary(
    currentSummary,
    jdAnalysis,
    conversationHistory,
    instructions,
    allUsedVerbs
  );
  return NextResponse.json({ draft: result.content, ... });
}
```

### 3. Add `refineSummary()` to `src/lib/claude.ts`:

```typescript
export async function refineSummary(
  currentSummary: string,
  jdAnalysis: JDAnalysis,
  conversationHistory: Message[],
  instructions: string,
  usedVerbs: string[]
): Promise<{ content: string; detectedVerbs: string[] }> {
  const systemContext = `You are helping refine a professional summary based on user feedback.

TARGET: ${jdAnalysis.strategic.targetTitle} at ${jdAnalysis.strategic.targetCompany}
INDUSTRY: ${jdAnalysis.strategic.industry}

CURRENT SUMMARY:
${currentSummary}

RULES:
1. Never change metrics or facts
2. Never add industries not in original
3. Maintain executive tone
4. Used verbs (avoid): ${usedVerbs.join(', ')}

Apply the user's requested changes while maintaining quality.
Wrap changes in <mark> tags.

Return ONLY the updated summary.`;

  const messages: Message[] = [
    { role: 'user', content: systemContext },
    { role: 'assistant', content: 'I understand. I\'ll help refine this summary while preserving all facts and metrics.' },
    ...conversationHistory,
    { role: 'user', content: instructions }
  ];

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 1024,
    messages
  });

  const content = response.content[0].type === 'text' 
    ? response.content[0].text 
    : '';
  
  return {
    content,
    detectedVerbs: extractVerbsFromContent(content)
  };
}
```

### 4. Add similar `refineHighlights()` function

Same pattern as refineSummary but for career highlights.

### 5. Update `ResumeBuilder.tsx`:

Store and pass conversation history:
```typescript
// When user sends a refinement message
const handleRefinement = async (section: string, message: string) => {
  // Add user message to history
  addMessage(section, { role: 'user', content: message });
  
  // Call API with history
  const response = await fetch('/api/generate-section', {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      sectionType: section,
      instructions: message,
      conversationHistory: conversationHistory[section] || []
    })
  });
  
  // Add assistant response to history
  const result = await response.json();
  addMessage(section, { role: 'assistant', content: result.draft });
};
```

### 6. Update UI to show refinement option:

In the summary and highlights steps, add ability to send refinement messages (similar to how positions already work).

## Commit
```bash
git add .
git commit -m "feat: add conversation history to all sections"
```

## Update HANDOFF.md

## Success Criteria
- [ ] Can refine summary through conversation
- [ ] Can refine highlights through conversation  
- [ ] Conversation history persists during session
- [ ] Claude remembers context from earlier messages
- [ ] Position refinement still works (regression test)
