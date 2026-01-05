import type { SelectionResult, JDRequirements } from '../content-selector';

export interface RewritePromptInput {
  jdRequirements: JDRequirements;
  priorityThemes: { theme: string; evidence?: string }[];
  atsKeywords: string[];
  selection: SelectionResult;
  targetTitle: string;
  targetCompany: string;
}

export function buildRewritePrompt(input: RewritePromptInput): string {
  const { jdRequirements, priorityThemes, atsKeywords, selection, targetTitle, targetCompany } = input;

  return `# Resume Rewriting Task

You are rewriting pre-selected resume content to match a job description's language and terminology.

## YOUR TASK
- Rewrite each content item to incorporate JD keywords naturally
- Maintain the core facts, metrics, and achievements — DO NOT invent
- Match the tone and terminology of the target role
- You are NOT selecting content — that's already done

## TARGET ROLE
- Title: ${targetTitle}
- Company: ${targetCompany}
- Industry: ${jdRequirements.industry}

## PRIORITY THEMES TO EMPHASIZE
${priorityThemes.map((t, i) => `${i + 1}. ${t.theme}${t.evidence ? ` — Evidence: "${t.evidence}"` : ''}`).join('\n')}

## KEYWORDS TO INCORPORATE (naturally, not forced)
${atsKeywords.slice(0, 15).join(', ')}

---

## CONTENT TO REWRITE

### SUMMARY
Original:
${selection.summary?.content || 'No summary selected'}

Rewrite this summary to emphasize the priority themes and incorporate keywords naturally.

---

### CAREER HIGHLIGHTS (5)
${selection.careerHighlights.map((ch, i) => `
#### Career Highlight ${i + 1} [${ch.id}]
${ch.variantLabel ? `Variant: ${ch.variantLabel}` : 'Base content'}
Original:
${ch.content}
`).join('\n')}

For each Career Highlight:
- Keep the **bold hook** format: **Hook phrase**: Supporting detail with metrics
- Preserve all metrics exactly (dollar amounts, percentages, numbers)
- Incorporate JD terminology where natural
- Target: 40-55 words each

---

### POSITION 1 BULLETS (4)
${selection.position1Bullets.map((b, i) => `
#### P1 Bullet ${i + 1} [${b.id}]
Original:
${b.content}
`).join('\n')}

For each bullet:
- Start with strong action verb
- Preserve all metrics exactly
- Target: ≤40 words each

---

### POSITION 2 BULLETS (3)
${selection.position2Bullets.map((b, i) => `
#### P2 Bullet ${i + 1} [${b.id}]
Original:
${b.content}
`).join('\n')}

---

## QUALITY RULES
1. **Metrics are sacred** — Never change numbers, percentages, or dollar amounts
2. **No verb repetition** — Don't use the same action verb twice in the resume
3. **No jargon soup** — Avoid compound noun chains like "B2B enterprise platform ecosystem"
4. **Hook format** — Career Highlights must use **Bold hook**: Supporting text
5. **Word limits** — Career Highlights: 40-55 words, Bullets: ≤40 words

---

## OUTPUT FORMAT

Return JSON in this exact structure:

\`\`\`json
{
  "summary": "Rewritten summary text",
  "career_highlights": [
    {
      "id": "CH-XX-VX",
      "content": "**Bold hook**: Rewritten supporting text with preserved metrics"
    }
  ],
  "position1_bullets": [
    {
      "id": "P1-BXX",
      "content": "Rewritten bullet text"
    }
  ],
  "position2_bullets": [
    {
      "id": "P2-BXX",
      "content": "Rewritten bullet text"
    }
  ],
  "keywords_used": ["keyword1", "keyword2"],
  "verbs_used": ["Built", "Led", "Drove"]
}
\`\`\`
`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseRewriteResponse(response: string): any {
  // Extract JSON from response
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1]);
  }

  // Try parsing as raw JSON
  const cleanResponse = response.trim();
  if (cleanResponse.startsWith('{')) {
    return JSON.parse(cleanResponse);
  }

  throw new Error('Could not parse rewrite response as JSON');
}
