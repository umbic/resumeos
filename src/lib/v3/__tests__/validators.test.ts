// src/lib/v3/__tests__/validators.test.ts
// Unit tests for V3 validators

import { describe, it, expect } from 'vitest';
import {
  validateJDOutput,
  validateSummaryOutput,
  validateCHOutput,
  validateP1Output,
  validateP2Output,
  validateP3P6Output,
  countWords,
} from '../validators';
import type { AccumulatedState } from '../types';

// ============ Helper: Create Empty State ============

function createEmptyState(): AccumulatedState {
  return {
    summaryVerbs: [],
    summaryMetrics: [],
    summaryPhrases: [],
    summarySectionsAddressed: [],
    chUsedBaseIds: [],
    chUsedVerbs: [],
    chUsedMetrics: [],
    chCoverage: [],
    p1UsedBaseIds: [],
    p1UsedVerbs: [],
    p1UsedMetrics: [],
    p1SectionsAddressed: [],
    p2UsedBaseIds: [],
    p2UsedVerbs: [],
    allUsedBaseIds: [],
    allUsedVerbs: [],
    allUsedMetrics: [],
  };
}

// ============ Helper: Create State With Bans ============

function createStateWithBans(): AccumulatedState {
  return {
    ...createEmptyState(),
    allUsedBaseIds: ['CH-01', 'CH-02', 'P1-B01'],
    allUsedVerbs: ['Architected', 'Transformed', 'Built'],
    allUsedMetrics: ['$727M', '40% efficiency'],
  };
}

// ============ countWords Tests ============

describe('countWords', () => {
  it('counts words correctly', () => {
    expect(countWords('Hello world')).toBe(2);
    expect(countWords('One two three four five')).toBe(5);
    expect(countWords('   spaced   out   words   ')).toBe(3);
  });

  it('handles empty and whitespace strings', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
  });

  it('handles single word', () => {
    expect(countWords('Hello')).toBe(1);
  });
});

// ============ JD Validator Tests ============

describe('validateJDOutput', () => {
  const validJDOutput = {
    metadata: {
      company: 'Bankrate',
      title: 'SVP Brand Strategy',
      industry: 'Financial Services / Fintech',
      level: 'VP',
      location: 'New York, NY',
      reportsTo: 'CMO',
    },
    sections: [
      {
        name: 'Overview',
        summary: 'Looking for a brand strategist',
        keyPhrases: [
          { phrase: 'brand strategy', weight: 'HIGH' },
          { phrase: 'cross-functional', weight: 'MEDIUM' },
          { phrase: 'leadership', weight: 'HIGH' },
        ],
      },
      {
        name: 'Requirements',
        summary: 'Must have experience',
        keyPhrases: [
          { phrase: 'financial services', weight: 'HIGH' },
          { phrase: '10+ years', weight: 'MEDIUM' },
          { phrase: 'team management', weight: 'LOW' },
        ],
      },
    ],
    globalPhraseFrequency: [
      { phrase: 'brand strategy', count: 3, sectionsFound: ['Overview', 'Requirements'] },
    ],
    themes: [
      { theme: 'Brand Leadership', evidence: ['brand strategy', 'leadership'], priority: 'Critical' },
    ],
    sectionToResumeMapping: [
      { jdSection: 'Overview', bestAddressedBy: ['Summary', 'CH'] },
    ],
    gaps: [],
  };

  it('returns valid for complete JD output', () => {
    const result = validateJDOutput(validJDOutput);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('fails when company is missing', () => {
    const invalid = {
      ...validJDOutput,
      metadata: { ...validJDOutput.metadata, company: '' },
    };
    const result = validateJDOutput(invalid);
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Missing company in metadata');
  });

  it('fails when sections are empty', () => {
    const invalid = { ...validJDOutput, sections: [] };
    const result = validateJDOutput(invalid);
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('No sections extracted');
  });

  it('fails when section has fewer than 3 key phrases', () => {
    const invalid = {
      ...validJDOutput,
      sections: [
        {
          name: 'Overview',
          summary: 'Test',
          keyPhrases: [
            { phrase: 'one', weight: 'HIGH' },
            { phrase: 'two', weight: 'MEDIUM' },
          ],
        },
      ],
    };
    const result = validateJDOutput(invalid);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('fewer than 3 key phrases'))).toBe(true);
  });

  it('fails when themes are empty', () => {
    const invalid = { ...validJDOutput, themes: [] };
    const result = validateJDOutput(invalid);
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('No themes identified');
  });

  it('allows retry on failure', () => {
    const invalid = { ...validJDOutput, themes: [] };
    const result = validateJDOutput(invalid);
    expect(result.canRetry).toBe(true);
  });
});

// ============ Summary Validator Tests ============

describe('validateSummaryOutput', () => {
  const validSummaryOutput = {
    positioningDecision: {
      approach: 'Lead with Philosophy/Approach',
      rationale: 'JD emphasizes thought leadership',
    },
    summary: {
      content:
        'Great brands drive revenue. That belief has guided fifteen years of building brand-led growth engines for financial services and consumer companies. From repositioning USAA to launching Bankrate\'s first integrated content strategy, the pattern is consistent: clarify the brand promise, align cross-functional teams around measurable outcomes, and prove that brand investment translates to acquisition efficiency. What makes this work sustainable is treating brand as a business discipline, not a creative exercise. Whether leading a team of strategists at Deloitte Digital or partnering with product and performance marketing teams, the focus remains on connecting brand storytelling to commercial results that executives can measure and scale.',
      wordCount: 142,
      sourcesUsed: ['SUM-FS', 'SUM-BS'],
    },
    jdMapping: [
      {
        phraseUsed: 'brand strategy',
        jdSection: 'Overview',
        jdPhraseSource: 'brand strategy leadership',
        exactQuote: true,
      },
      {
        phraseUsed: 'cross-functional',
        jdSection: 'Requirements',
        jdPhraseSource: 'cross-functional collaboration',
        exactQuote: true,
      },
      {
        phraseUsed: 'measurable outcomes',
        jdSection: 'Overview',
        jdPhraseSource: 'measurable business outcomes',
        exactQuote: true,
      },
    ],
    thematicAnchors: {
      primaryNarrative: 'Brand strategist who proves brand drives revenue',
      distinctiveValue: 'Financial services expertise with measurable outcomes focus',
      toneEstablished: 'Confident, direct, business-focused',
      doNotRepeat: {
        metrics: ['$727M'],
        clients: ['USAA'],
        phrases: ['great brands drive revenue'],
      },
      reinforce: {
        beliefs: ['brand drives revenue'],
        capabilities: ['cross-functional leadership'],
      },
    },
    stateForDownstream: {
      usedVerbs: ['building', 'repositioning', 'launching'],
      usedMetrics: [],
      jdPhrasesUsed: ['brand strategy', 'cross-functional', 'measurable outcomes'],
      jdSectionsAddressed: ['Overview', 'Requirements'],
    },
  };

  it('returns valid for complete summary output', () => {
    const result = validateSummaryOutput(validSummaryOutput);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('fails when word count is below 140', () => {
    const invalid = {
      ...validSummaryOutput,
      summary: { ...validSummaryOutput.summary, wordCount: 120 },
    };
    const result = validateSummaryOutput(invalid);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('outside 140-160 range'))).toBe(true);
  });

  it('fails when word count is above 160', () => {
    const invalid = {
      ...validSummaryOutput,
      summary: { ...validSummaryOutput.summary, wordCount: 175 },
    };
    const result = validateSummaryOutput(invalid);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('outside 140-160 range'))).toBe(true);
  });

  it('fails when primaryNarrative is missing', () => {
    const invalid = {
      ...validSummaryOutput,
      thematicAnchors: { ...validSummaryOutput.thematicAnchors, primaryNarrative: '' },
    };
    const result = validateSummaryOutput(invalid);
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Missing primaryNarrative in thematicAnchors');
  });

  it('fails when fewer than 3 JD phrases used', () => {
    const invalid = {
      ...validSummaryOutput,
      jdMapping: [validSummaryOutput.jdMapping[0], validSummaryOutput.jdMapping[1]],
    };
    const result = validateSummaryOutput(invalid);
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Summary must use at least 3 JD phrases');
  });

  it('fails when forbidden word is used', () => {
    const invalid = {
      ...validSummaryOutput,
      summary: {
        ...validSummaryOutput.summary,
        content: 'This summary leveraged many skills to achieve results.',
      },
    };
    const result = validateSummaryOutput(invalid);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('Forbidden word "leveraged"'))).toBe(true);
  });

  it('fails when emdash is present', () => {
    const invalid = {
      ...validSummaryOutput,
      summary: {
        ...validSummaryOutput.summary,
        content: 'Great brands — and the people who build them — drive revenue.',
      },
    };
    const result = validateSummaryOutput(invalid);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('emdash'))).toBe(true);
  });
});

// ============ CH Validator Tests ============

describe('validateCHOutput', () => {
  const createValidCH = (slot: string, baseId: string, verb: string) => ({
    slot,
    sourceId: `${baseId}-V1`,
    baseId,
    headline: 'Brand-Led Growth',
    content: `**Brand-Led Growth**: ${verb} a comprehensive brand strategy that delivered exceptional results across multiple business units and drove significant revenue growth for the organization.`,
    wordCount: 38,
    primaryVerb: verb,
    jdMapping: [
      { phraseUsed: 'brand strategy', jdSection: 'Overview', jdPhraseSource: 'brand strategy', exactQuote: true },
      { phraseUsed: 'revenue growth', jdSection: 'Requirements', jdPhraseSource: 'revenue growth', exactQuote: true },
    ],
    selectionRationale: 'Addresses brand strategy requirement',
  });

  const validCHOutput = {
    careerHighlights: [
      createValidCH('ch-1', 'CH-01', 'Architected'),
      createValidCH('ch-2', 'CH-02', 'Transformed'),
      createValidCH('ch-3', 'CH-03', 'Developed'),
      createValidCH('ch-4', 'CH-04', 'Scaled'),
      createValidCH('ch-5', 'CH-05', 'Built'),
    ],
    coverageAnalysis: {
      jdSectionsCovered: [
        { section: 'Overview', strength: 'Strong', coveredBy: ['ch-1', 'ch-2'] },
      ],
      gapsRemaining: [],
    },
    stateForDownstream: {
      usedBaseIds: ['CH-01', 'CH-02', 'CH-03', 'CH-04', 'CH-05'],
      usedVerbs: ['Architected', 'Transformed', 'Developed', 'Scaled', 'Built'],
      usedMetrics: ['67% awareness'],
      jdSectionsCoveredByCH: ['Overview'],
    },
  };

  it('returns valid for complete CH output', () => {
    const result = validateCHOutput(validCHOutput, createEmptyState());
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('fails when not exactly 5 CHs', () => {
    const invalid = {
      ...validCHOutput,
      careerHighlights: validCHOutput.careerHighlights.slice(0, 4),
    };
    const result = validateCHOutput(invalid, createEmptyState());
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('Expected 5 career highlights'))).toBe(true);
  });

  it('fails when duplicate base IDs exist', () => {
    const invalid = {
      ...validCHOutput,
      careerHighlights: [
        createValidCH('ch-1', 'CH-01', 'Architected'),
        createValidCH('ch-2', 'CH-01', 'Transformed'), // Duplicate base ID
        createValidCH('ch-3', 'CH-03', 'Developed'),
        createValidCH('ch-4', 'CH-04', 'Scaled'),
        createValidCH('ch-5', 'CH-05', 'Built'),
      ],
    };
    const result = validateCHOutput(invalid, createEmptyState());
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('Duplicate base ID'))).toBe(true);
  });

  it('fails when duplicate verbs exist', () => {
    const invalid = {
      ...validCHOutput,
      careerHighlights: [
        createValidCH('ch-1', 'CH-01', 'Architected'),
        createValidCH('ch-2', 'CH-02', 'Architected'), // Duplicate verb
        createValidCH('ch-3', 'CH-03', 'Developed'),
        createValidCH('ch-4', 'CH-04', 'Scaled'),
        createValidCH('ch-5', 'CH-05', 'Built'),
      ],
    };
    const result = validateCHOutput(invalid, createEmptyState());
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('Duplicate verb'))).toBe(true);
  });

  it('fails when word count is outside 35-50 range', () => {
    const invalid = {
      ...validCHOutput,
      careerHighlights: [
        { ...createValidCH('ch-1', 'CH-01', 'Architected'), wordCount: 25 },
        createValidCH('ch-2', 'CH-02', 'Transformed'),
        createValidCH('ch-3', 'CH-03', 'Developed'),
        createValidCH('ch-4', 'CH-04', 'Scaled'),
        createValidCH('ch-5', 'CH-05', 'Built'),
      ],
    };
    const result = validateCHOutput(invalid, createEmptyState());
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('outside 35-50 range'))).toBe(true);
  });

  it('fails when CH has fewer than 2 JD mappings', () => {
    const invalid = {
      ...validCHOutput,
      careerHighlights: [
        {
          ...createValidCH('ch-1', 'CH-01', 'Architected'),
          jdMapping: [{ phraseUsed: 'test', jdSection: 'Overview', jdPhraseSource: 'test', exactQuote: true }],
        },
        createValidCH('ch-2', 'CH-02', 'Transformed'),
        createValidCH('ch-3', 'CH-03', 'Developed'),
        createValidCH('ch-4', 'CH-04', 'Scaled'),
        createValidCH('ch-5', 'CH-05', 'Built'),
      ],
    };
    const result = validateCHOutput(invalid, createEmptyState());
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('at least 2 JD mappings'))).toBe(true);
  });
});

// ============ P1 Validator Tests ============

describe('validateP1Output', () => {
  const createValidBullet = (slot: string, baseId: string, verb: string) => ({
    slot,
    sourceId: `${baseId}-V1`,
    baseId,
    content: `${verb} a comprehensive strategy that delivered measurable results across the organization.`,
    wordCount: 30,
    primaryVerb: verb,
    jdMapping: [
      { phraseUsed: 'strategy', jdSection: 'Overview', jdPhraseSource: 'strategy', exactQuote: true },
    ],
    gapAddressed: 'Addresses tactical execution gap',
    selectionRationale: 'Strong metric alignment',
  });

  const validP1Output = {
    overview: {
      sourceId: 'OV-P1-01',
      content: 'Led brand strategy and marketing operations for Deloitte Digital practice, managing cross-functional teams and driving measurable business outcomes across multiple client engagements.',
      wordCount: 45,
      jdMapping: [
        { phraseUsed: 'brand strategy', jdSection: 'Overview', jdPhraseSource: 'brand strategy', exactQuote: true },
      ],
    },
    bullets: [
      createValidBullet('p1-bullet-1', 'P1-B01', 'Created'),
      createValidBullet('p1-bullet-2', 'P1-B02', 'Scaled'),
      createValidBullet('p1-bullet-3', 'P1-B03', 'Drove'),
      createValidBullet('p1-bullet-4', 'P1-B04', 'Unified'),
    ],
    coverageAnalysis: {
      jdSectionsAddressed: [
        { section: 'Overview', strength: 'Strong', coveredBy: ['p1-bullet-1'] },
      ],
      gapsRemaining: [],
      phrasesCovered: ['brand strategy'],
    },
    stateForDownstream: {
      usedBaseIds: ['P1-B01', 'P1-B02', 'P1-B03', 'P1-B04'],
      usedVerbs: ['Created', 'Scaled', 'Drove', 'Unified'],
      usedMetrics: ['9% acquisition'],
      jdSectionsCoveredByP1: ['Overview'],
    },
  };

  it('returns valid for complete P1 output', () => {
    const result = validateP1Output(validP1Output, createEmptyState());
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('fails when overview word count is outside 40-60 range', () => {
    const invalid = {
      ...validP1Output,
      overview: { ...validP1Output.overview, wordCount: 30 },
    };
    const result = validateP1Output(invalid, createEmptyState());
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('overview word count'))).toBe(true);
  });

  it('fails when not exactly 4 bullets', () => {
    const invalid = {
      ...validP1Output,
      bullets: validP1Output.bullets.slice(0, 3),
    };
    const result = validateP1Output(invalid, createEmptyState());
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('Expected 4 P1 bullets'))).toBe(true);
  });

  it('fails when bullet uses banned base ID', () => {
    const state = createStateWithBans();
    const invalid = {
      ...validP1Output,
      bullets: [
        { ...createValidBullet('p1-bullet-1', 'CH-01', 'Created') }, // Banned base ID
        createValidBullet('p1-bullet-2', 'P1-B02', 'Scaled'),
        createValidBullet('p1-bullet-3', 'P1-B03', 'Drove'),
        createValidBullet('p1-bullet-4', 'P1-B04', 'Unified'),
      ],
    };
    const result = validateP1Output(invalid, state);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('banned base ID'))).toBe(true);
  });

  it('fails when bullet uses banned verb', () => {
    const state = createStateWithBans();
    const invalid = {
      ...validP1Output,
      bullets: [
        { ...createValidBullet('p1-bullet-1', 'P1-B01', 'Architected') }, // Banned verb
        createValidBullet('p1-bullet-2', 'P1-B02', 'Scaled'),
        createValidBullet('p1-bullet-3', 'P1-B03', 'Drove'),
        createValidBullet('p1-bullet-4', 'P1-B04', 'Unified'),
      ],
    };
    const result = validateP1Output(invalid, state);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('banned verb'))).toBe(true);
  });

  it('does not allow retry when banned items are used', () => {
    const state = createStateWithBans();
    const invalid = {
      ...validP1Output,
      bullets: [
        { ...createValidBullet('p1-bullet-1', 'CH-01', 'Created') }, // Banned base ID
        createValidBullet('p1-bullet-2', 'P1-B02', 'Scaled'),
        createValidBullet('p1-bullet-3', 'P1-B03', 'Drove'),
        createValidBullet('p1-bullet-4', 'P1-B04', 'Unified'),
      ],
    };
    const result = validateP1Output(invalid, state);
    expect(result.canRetry).toBe(false);
  });
});

// ============ P2 Validator Tests ============

describe('validateP2Output', () => {
  const createValidP2Bullet = (slot: string, baseId: string, verb: string) => ({
    slot,
    sourceId: `${baseId}-V1`,
    baseId,
    content: `${verb} a comprehensive strategy that delivered measurable results across the organization.`,
    wordCount: 30,
    primaryVerb: verb,
    jdMapping: [
      { phraseUsed: 'strategy', jdSection: 'Overview', jdPhraseSource: 'strategy', exactQuote: true },
    ],
    gapAddressed: 'Reinforces tactical execution',
    patternProof: 'Shows earlier evidence of capability demonstrated in P1',
    selectionRationale: 'Complements P1 example',
  });

  const validP2Output = {
    overview: {
      sourceId: 'OV-P2-01',
      content: 'Directed brand strategy initiatives for the consulting practice, establishing foundational frameworks that enabled scalable growth across client engagements.',
      wordCount: 42,
      jdMapping: [
        { phraseUsed: 'brand strategy', jdSection: 'Overview', jdPhraseSource: 'brand strategy', exactQuote: true },
      ],
    },
    bullets: [
      createValidP2Bullet('p2-bullet-1', 'P2-B01', 'Repositioned'),
      createValidP2Bullet('p2-bullet-2', 'P2-B02', 'Developed'),
      createValidP2Bullet('p2-bullet-3', 'P2-B03', 'Established'),
    ],
    coverageAnalysis: {
      finalCoverage: [
        { section: 'Overview', strength: 'Strong', coveredBy: ['ch-1', 'p1-bullet-1', 'p2-bullet-1'] },
      ],
      remainingGaps: [],
      unusedHighPhrases: [],
    },
    stateForDownstream: {
      usedBaseIds: ['P2-B01', 'P2-B02', 'P2-B03'],
      usedVerbs: ['Repositioned', 'Developed', 'Established'],
      allVerbsUsedInResume: ['Architected', 'Transformed', 'Repositioned', 'Developed', 'Established'],
    },
  };

  it('returns valid for complete P2 output', () => {
    const result = validateP2Output(validP2Output, createEmptyState());
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('fails when not exactly 3 bullets', () => {
    const invalid = {
      ...validP2Output,
      bullets: validP2Output.bullets.slice(0, 2),
    };
    const result = validateP2Output(invalid, createEmptyState());
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('Expected 3 P2 bullets'))).toBe(true);
  });

  it('fails when patternProof is missing', () => {
    const invalid = {
      ...validP2Output,
      bullets: [
        { ...createValidP2Bullet('p2-bullet-1', 'P2-B01', 'Repositioned'), patternProof: '' },
        createValidP2Bullet('p2-bullet-2', 'P2-B02', 'Developed'),
        createValidP2Bullet('p2-bullet-3', 'P2-B03', 'Established'),
      ],
    };
    const result = validateP2Output(invalid, createEmptyState());
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('missing patternProof'))).toBe(true);
  });

  it('fails when duplicate verbs within P2', () => {
    const invalid = {
      ...validP2Output,
      bullets: [
        createValidP2Bullet('p2-bullet-1', 'P2-B01', 'Repositioned'),
        createValidP2Bullet('p2-bullet-2', 'P2-B02', 'Repositioned'), // Duplicate
        createValidP2Bullet('p2-bullet-3', 'P2-B03', 'Established'),
      ],
    };
    const result = validateP2Output(invalid, createEmptyState());
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('Duplicate verb within P2'))).toBe(true);
  });
});

// ============ P3-P6 Validator Tests ============

describe('validateP3P6Output', () => {
  const validP3P6Output = {
    overviews: [
      {
        position: 3 as const,
        sourceId: 'OV-P3-01',
        content: 'Promoted to lead innovation across brand, technology, and customer experience initiatives.',
        wordCount: 25,
        startingVerb: 'Promoted',
        jdRelevance: { relevant: true, connection: 'Innovation aligns with JD', phraseUsed: null },
      },
      {
        position: 4 as const,
        sourceId: 'OV-P4-01',
        content: 'Recruited to lead global brand storytelling and thought leadership programs.',
        wordCount: 22,
        startingVerb: 'Recruited',
        jdRelevance: { relevant: true, connection: 'Storytelling mentioned in JD', phraseUsed: 'storytelling' },
      },
      {
        position: 5 as const,
        sourceId: 'OV-P5-01',
        content: 'Developed foundational brand strategy systems and client engagement frameworks.',
        wordCount: 20,
        startingVerb: 'Developed',
        jdRelevance: { relevant: false, connection: null, phraseUsed: null },
      },
      {
        position: 6 as const,
        sourceId: 'OV-P6-01',
        content: 'Supported brand positioning and integrated campaign development for agency clients.',
        wordCount: 21,
        startingVerb: 'Supported',
        jdRelevance: { relevant: false, connection: null, phraseUsed: null },
      },
    ],
    verbsUsed: ['Promoted', 'Recruited', 'Developed', 'Supported'],
    trajectoryNarrative: 'Shows progression from agency execution to global brand leadership.',
  };

  it('returns valid for complete P3-P6 output', () => {
    const result = validateP3P6Output(validP3P6Output, createEmptyState());
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('fails when not exactly 4 overviews', () => {
    const invalid = {
      ...validP3P6Output,
      overviews: validP3P6Output.overviews.slice(0, 3),
    };
    const result = validateP3P6Output(invalid, createEmptyState());
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('Expected 4 overviews'))).toBe(true);
  });

  it('fails when word count is outside 20-40 range', () => {
    const invalid = {
      ...validP3P6Output,
      overviews: [
        { ...validP3P6Output.overviews[0], wordCount: 15 },
        validP3P6Output.overviews[1],
        validP3P6Output.overviews[2],
        validP3P6Output.overviews[3],
      ],
    };
    const result = validateP3P6Output(invalid, createEmptyState());
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('outside 20-40 range'))).toBe(true);
  });

  it('fails when banned verb is used', () => {
    const state = createStateWithBans();
    const invalid = {
      ...validP3P6Output,
      overviews: [
        { ...validP3P6Output.overviews[0], startingVerb: 'Architected' }, // Banned
        validP3P6Output.overviews[1],
        validP3P6Output.overviews[2],
        validP3P6Output.overviews[3],
      ],
    };
    const result = validateP3P6Output(invalid, state);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('banned verb'))).toBe(true);
  });

  it('fails when duplicate verbs within P3-P6', () => {
    const invalid = {
      ...validP3P6Output,
      overviews: [
        validP3P6Output.overviews[0],
        { ...validP3P6Output.overviews[1], startingVerb: 'Promoted' }, // Duplicate
        validP3P6Output.overviews[2],
        validP3P6Output.overviews[3],
      ],
    };
    const result = validateP3P6Output(invalid, createEmptyState());
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('Duplicate verb within P3-P6'))).toBe(true);
  });

  it('fails when trajectoryNarrative is missing', () => {
    const invalid = {
      ...validP3P6Output,
      trajectoryNarrative: '',
    };
    const result = validateP3P6Output(invalid, createEmptyState());
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Missing trajectoryNarrative');
  });

  it('allows retry on all failures', () => {
    const invalid = {
      ...validP3P6Output,
      overviews: validP3P6Output.overviews.slice(0, 3),
    };
    const result = validateP3P6Output(invalid, createEmptyState());
    expect(result.canRetry).toBe(true);
  });
});
