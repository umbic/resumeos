/**
 * Content Allocator Tests
 * Run with: npx tsx src/lib/pipeline/__tests__/content-allocator.test.ts
 */

import { allocateContent, getBaseId, getAllocationSummary, verifyNoDuplicates } from '../content-allocator';
import { AllocatorInput } from '@/types/v2.1';

// Simple test runner
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error instanceof Error ? error.message : error}`);
    failed++;
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toEqual(expected: T) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (typeof actual !== 'number' || actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy value, got ${actual}`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected falsy value, got ${actual}`);
      }
    }
  };
}

// Mock selection data
const mockSelection: AllocatorInput = {
  summaries: [
    { id: 'SUM-01', content: 'Summary 1', score: 8, matchedTags: [] },
    { id: 'SUM-02', content: 'Summary 2', score: 6, matchedTags: [] }
  ],
  careerHighlights: [
    // Slot 1: CH-05 variants
    [
      { id: 'CH-05-V2', content: 'CH-05 variant 2', score: 9, matchedTags: [] },
      { id: 'CH-05-V1', content: 'CH-05 variant 1', score: 7, matchedTags: [] }
    ],
    // Slot 2: CH-07 variants
    [
      { id: 'CH-07-V1', content: 'CH-07 variant 1', score: 8, matchedTags: [] }
    ],
    // Slot 3: Includes CH-05 again (should be blocked)
    [
      { id: 'CH-05-V3', content: 'CH-05 variant 3', score: 10, matchedTags: [] },
      { id: 'CH-03-V1', content: 'CH-03 variant 1', score: 6, matchedTags: [] }
    ],
    // Slot 4
    [
      { id: 'CH-04-V1', content: 'CH-04 variant 1', score: 7, matchedTags: [] }
    ],
    // Slot 5
    [
      { id: 'CH-06-V1', content: 'CH-06 variant 1', score: 5, matchedTags: [] }
    ]
  ],
  position1Bullets: [
    [{ id: 'P1-B01-V1', content: 'P1 bullet 1', score: 8, matchedTags: [] }],
    [{ id: 'P1-B02-V1', content: 'P1 bullet 2', score: 7, matchedTags: [] }],
    // This slot has CH-05 content (should be blocked because CH-05 used in highlights)
    [
      { id: 'CH-05-V1', content: 'CH-05 as bullet', score: 10, matchedTags: [] },
      { id: 'P1-B03-V1', content: 'P1 bullet 3', score: 5, matchedTags: [] }
    ],
    [{ id: 'P1-B04-V1', content: 'P1 bullet 4', score: 6, matchedTags: [] }]
  ],
  position2Bullets: [
    [{ id: 'P2-B01-V1', content: 'P2 bullet 1', score: 7, matchedTags: [] }],
    [{ id: 'P2-B02-V1', content: 'P2 bullet 2', score: 6, matchedTags: [] }],
    [{ id: 'P2-B03-V1', content: 'P2 bullet 3', score: 5, matchedTags: [] }]
  ],
  overviews: {
    1: [{ id: 'OV-P1-01', content: 'P1 overview', score: 5, matchedTags: [] }],
    2: [{ id: 'OV-P2-01', content: 'P2 overview', score: 5, matchedTags: [] }]
  }
};

// Tests
console.log('\n=== getBaseId tests ===\n');

test('removes variant suffix', () => {
  expect(getBaseId('CH-05-V2')).toBe('CH-05');
  expect(getBaseId('P1-B08-V1')).toBe('P1-B08');
  expect(getBaseId('CH-05-V10')).toBe('CH-05');
});

test('returns unchanged if no variant', () => {
  expect(getBaseId('CH-05')).toBe('CH-05');
  expect(getBaseId('P1-B08')).toBe('P1-B08');
});

console.log('\n=== allocateContent tests ===\n');

test('assigns highest scored candidate to each slot', () => {
  const allocation = allocateContent(mockSelection);

  // CH slot 1 should get CH-05-V2 (score 9)
  expect(allocation.careerHighlights[0].contentId).toBe('CH-05-V2');
  expect(allocation.careerHighlights[0].score).toBe(9);
});

test('blocks variants of used content', () => {
  const allocation = allocateContent(mockSelection);

  // CH slot 3 has CH-05-V3 (score 10) but CH-05 base is already used
  // Should fall back to CH-03-V1 (score 6)
  expect(allocation.careerHighlights[2].contentId).toBe('CH-03-V1');
});

test('prevents cross-section duplication', () => {
  const allocation = allocateContent(mockSelection);

  // P1 bullet slot 3 has CH-05-V1 (score 10) but CH-05 is used in highlights
  // Should fall back to P1-B03-V1 (score 5)
  expect(allocation.position1Bullets[2].contentId).toBe('P1-B03-V1');
});

test('allocates all slots when possible', () => {
  const allocation = allocateContent(mockSelection);
  const summary = getAllocationSummary(allocation);

  expect(summary.assignedSlots).toBeGreaterThan(0);
  expect(summary.skippedSlots).toBe(0);
});

test('logs all allocation decisions', () => {
  const allocation = allocateContent(mockSelection);

  expect(allocation.allocationLog.length).toBeGreaterThan(0);
  const hasAssigned = allocation.allocationLog.some(e => e.action === 'assigned');
  expect(hasAssigned).toBeTruthy();
});

test('no duplicates in final allocation', () => {
  const allocation = allocateContent(mockSelection);
  const result = verifyNoDuplicates(allocation);

  expect(result.valid).toBeTruthy();
  if (!result.valid) {
    console.log('  Duplicates found:', result.duplicates);
  }
});

test('allocates summaries separately from bullets', () => {
  const allocation = allocateContent(mockSelection);

  // Should have 2 summary sources
  expect(allocation.summaries.length).toBe(2);
  expect(allocation.summaries[0].contentId).toBe('SUM-01');
  expect(allocation.summaries[1].contentId).toBe('SUM-02');
});

test('allocates overviews', () => {
  const allocation = allocateContent(mockSelection);

  expect(allocation.position1Overview).toBeTruthy();
  expect(allocation.position1Overview?.contentId).toBe('OV-P1-01');

  expect(allocation.position2Overview).toBeTruthy();
  expect(allocation.position2Overview?.contentId).toBe('OV-P2-01');
});

test('tracks unique base IDs correctly', () => {
  const allocation = allocateContent(mockSelection);
  const summary = getAllocationSummary(allocation);

  // Should have unique base IDs for all CH + P1 + P2 bullets
  // CH: 5 slots (CH-05, CH-07, CH-03, CH-04, CH-06)
  // P1: 4 slots (P1-B01, P1-B02, P1-B03, P1-B04)
  // P2: 3 slots (P2-B01, P2-B02, P2-B03)
  // Total: 12 unique base IDs (not counting overviews which are separate)
  expect(summary.uniqueBaseIds).toBe(12);
});

// Summary
console.log(`\n=== Results ===\n`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
