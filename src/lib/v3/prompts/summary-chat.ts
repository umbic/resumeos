// src/lib/v3/prompts/summary-chat.ts
// Summary generation prompt for V3 pipeline

import type { JDAnalyzerOutput, SummarySource, SummaryChatOutput } from '../types';
import { UMBERTO_VOICE_GUIDE } from '../voice-guide';

export function buildSummaryChatPrompt(
  jdAnalysis: JDAnalyzerOutput,
  summaries: SummarySource[],
  previousIssues?: string[]
): string {
  // Format summaries for the prompt
  const summaryOptions = summaries
    .map(
      (s) => `
### ${s.id}: ${s.label}
**Emphasis**: ${s.emphasis.join(', ')}
**Content**:
${s.content}
`
    )
    .join('\n');

  // Format JD sections with phrases
  const jdSections = jdAnalysis.sections
    .map(
      (s) => `
### ${s.name}
${s.summary}
**Key Phrases**:
${s.keyPhrases.map((p) => `- [${p.weight}] "${p.phrase}"`).join('\n')}
`
    )
    .join('\n');

  // Format themes
  const themes = jdAnalysis.themes
    .map((t) => `- **${t.theme}** [${t.priority}]: ${t.evidence.slice(0, 2).join('; ')}`)
    .join('\n');

  // Previous issues block for retries
  const issuesBlock = previousIssues?.length
    ? `
## PREVIOUS ATTEMPT ISSUES - FIX THESE

Your previous output had these problems that MUST be fixed:
${previousIssues.map((i) => `- ${i}`).join('\n')}

Address each issue in your new response.
`
    : '';

  return `You are writing the professional summary for a senior executive's resume. This summary sets the tone and positioning for the entire resume.

## TARGET ROLE

**Company**: ${jdAnalysis.metadata.company}
**Title**: ${jdAnalysis.metadata.title}
**Industry**: ${jdAnalysis.metadata.industry}
**Level**: ${jdAnalysis.metadata.level}

## JD ANALYSIS

### Key Themes
${themes}

### Sections & Key Phrases
${jdSections}

## SUMMARY SOURCE OPTIONS

Choose content from these pre-written summaries. You may blend elements from multiple sources, but all facts and metrics must come from these sources - DO NOT fabricate.

${summaryOptions}

${UMBERTO_VOICE_GUIDE}
${issuesBlock}

## YOUR TASK

1. **Choose a positioning approach** - Decide how to position the candidate based on the JD themes and available summaries
2. **Write the summary** - 140-160 words, incorporating JD language naturally
3. **Establish thematic anchors** - Define what the rest of the resume should reinforce and what should NOT be repeated
4. **Map JD coverage** - Show exactly which JD phrases you used and where

## OUTPUT FORMAT

Return ONLY valid JSON matching this structure:

\`\`\`json
{
  "positioningDecision": {
    "approach": "Brief description of positioning strategy",
    "rationale": "Why this approach matches the JD"
  },
  "summary": {
    "content": "The full 140-160 word summary text...",
    "wordCount": 150,
    "sourcesUsed": ["SUM-FS", "SUM-BS"]
  },
  "jdMapping": [
    {
      "phraseUsed": "phrase in your summary",
      "jdSection": "JD section name",
      "jdPhraseSource": "original JD phrase",
      "exactQuote": true
    }
  ],
  "thematicAnchors": {
    "primaryNarrative": "The core story this summary establishes",
    "distinctiveValue": "What makes this candidate uniquely valuable for this role",
    "toneEstablished": "The professional tone set (e.g., strategic, results-driven)",
    "doNotRepeat": {
      "metrics": ["$727M", "other metrics used that shouldn't repeat"],
      "clients": ["Client names used"],
      "phrases": ["Key phrases that shouldn't be repeated verbatim"]
    },
    "reinforce": {
      "beliefs": ["Core beliefs/philosophies to reinforce later"],
      "capabilities": ["Key capabilities to prove with examples later"]
    }
  },
  "stateForDownstream": {
    "usedVerbs": ["building", "launching", "other verbs used"],
    "usedMetrics": ["metrics used if any"],
    "jdPhrasesUsed": ["list of JD phrases incorporated"],
    "jdSectionsAddressed": ["Overview", "Requirements"]
  }
}
\`\`\`

## CRITICAL REQUIREMENTS

1. **Word count**: MUST be 140-160 words. Count carefully.
2. **JD language**: Use at least 3 HIGH-weight phrases from the JD naturally
3. **No forbidden words**: Never use: leveraged, utilized, spearheaded, synergy, passionate
4. **No emdashes**: Use commas or periods instead of —
5. **Specific metrics**: Use exact numbers from sources, don't round or generalize
6. **Active voice**: Start sentences with strong verbs, not "I" or passive constructions
7. **Sources only**: Every fact must come from the provided summaries

Return ONLY the JSON object. No markdown formatting, no explanations.`;
}

// Type guard for summary output
export function isValidSummaryChatOutput(data: unknown): data is SummaryChatOutput {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  if (!obj.positioningDecision || typeof obj.positioningDecision !== 'object') return false;
  if (!obj.summary || typeof obj.summary !== 'object') return false;
  if (!obj.thematicAnchors || typeof obj.thematicAnchors !== 'object') return false;
  if (!obj.stateForDownstream || typeof obj.stateForDownstream !== 'object') return false;
  if (!Array.isArray(obj.jdMapping)) return false;

  const summary = obj.summary as Record<string, unknown>;
  if (typeof summary.content !== 'string') return false;
  if (typeof summary.wordCount !== 'number') return false;

  return true;
}

// Parse Claude's response into typed output
export function parseSummaryChatResponse(response: string): SummaryChatOutput {
  const cleaned = response
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  const parsed = JSON.parse(cleaned);

  if (!isValidSummaryChatOutput(parsed)) {
    throw new Error('Invalid summary chat output structure');
  }

  return parsed as SummaryChatOutput;
}
