// src/lib/v3/content-loader.ts
// Loads and transforms master-content.json into V3 ContentSources

import type {
  ContentSources,
  SummarySource,
  CHSource,
  BulletSource,
  Profile,
  ProfilePosition,
} from './types';

// Raw types from master-content.json
interface RawSummary {
  id: string;
  title: string;
  contentLong: string;
  industryTags: string[];
  functionTags: string[];
  themeTags: string[];
}

interface RawVariant {
  id: string;
  label: string;
  content?: string;
  contentLong?: string;
  themeTags: string[];
  functionTags?: string[];
  industryTags?: string[];
  exclusiveMetrics?: string[];
}

interface RawCareerHighlight {
  id: string;
  title: string;
  contentLong: string;
  functionTags: string[];
  industryTags: string[];
  exclusiveMetrics?: string[];
  variants: RawVariant[];
}

interface RawOverview {
  id: string;
  title: string;
  position: number;
  contentLong: string;
  industryTags: string[];
  functionTags: string[];
  variants: Array<{
    id: string;
    title: string;
    themeTags: string[];
  }>;
}

interface RawBullet {
  id: string;
  title: string;
  contentLong: string;
  functionTags: string[];
  industryTags: string[];
  exclusiveMetrics?: string[];
  conflictsWith?: string[];
  variants: RawVariant[];
}

interface RawMasterContent {
  metadata: {
    version: string;
    lastUpdated: string;
    description: string;
  };
  summaries: RawSummary[];
  careerHighlights: RawCareerHighlight[];
  overviews: RawOverview[];
  positionBullets: {
    P1: RawBullet[];
    P2: RawBullet[];
    P3?: RawBullet[];
    P4?: RawBullet[];
    P5?: RawBullet[];
    P6?: RawBullet[];
  };
  conflictRules: Array<{
    itemId: string;
    conflictsWith: string[];
    reason: string;
  }>;
}

/**
 * Load and transform master-content.json into V3 ContentSources
 */
export function loadContentSources(masterContent: RawMasterContent): ContentSources {
  return {
    summaries: loadSummaries(masterContent.summaries),
    careerHighlights: loadCareerHighlights(masterContent.careerHighlights),
    p1Sources: loadP1Sources(masterContent.positionBullets.P1, masterContent.overviews),
    p2Sources: loadP2Sources(masterContent.positionBullets.P2, masterContent.overviews),
    p3p6Overviews: loadP3P6Overviews(masterContent.overviews),
  };
}

/**
 * Transform summaries into SummarySource format
 */
function loadSummaries(rawSummaries: RawSummary[]): SummarySource[] {
  return rawSummaries.map((s) => ({
    id: s.id,
    label: s.title,
    content: s.contentLong,
    emphasis: [...s.industryTags, ...s.functionTags, ...s.themeTags],
  }));
}

/**
 * Transform career highlights into CHSource format
 * Each variant becomes a separate CHSource entry
 */
function loadCareerHighlights(rawCHs: RawCareerHighlight[]): CHSource[] {
  const result: CHSource[] = [];

  for (const ch of rawCHs) {
    // Add base item
    result.push({
      id: ch.id,
      baseId: ch.id,
      content: ch.contentLong,
      tags: {
        industry: ch.industryTags,
        function: ch.functionTags,
        theme: [], // Base items don't have theme tags
      },
    });

    // Add each variant
    for (const variant of ch.variants) {
      result.push({
        id: variant.id,
        baseId: ch.id,
        variantLabel: variant.label,
        content: variant.content || variant.contentLong || ch.contentLong,
        tags: {
          industry: variant.industryTags || ch.industryTags,
          function: variant.functionTags || ch.functionTags,
          theme: variant.themeTags,
        },
      });
    }
  }

  return result;
}

/**
 * Transform P1 bullets and overviews into BulletSource format
 */
function loadP1Sources(rawBullets: RawBullet[], rawOverviews: RawOverview[]): BulletSource[] {
  const result: BulletSource[] = [];

  // Find P1 overview
  const p1Overview = rawOverviews.find((o) => o.position === 1);

  if (p1Overview) {
    // Add base overview
    result.push({
      id: p1Overview.id,
      baseId: p1Overview.id,
      type: 'overview',
      content: p1Overview.contentLong,
      tags: {
        industry: p1Overview.industryTags,
        function: p1Overview.functionTags,
        theme: [],
      },
    });

    // Add overview variants
    for (const variant of p1Overview.variants) {
      result.push({
        id: variant.id,
        baseId: p1Overview.id,
        type: 'overview',
        variantLabel: variant.title,
        content: p1Overview.contentLong, // Variants use base content with theme emphasis
        tags: {
          industry: p1Overview.industryTags,
          function: p1Overview.functionTags,
          theme: variant.themeTags,
        },
      });
    }
  }

  // Add P1 bullets and variants
  for (const bullet of rawBullets) {
    // Add base bullet
    result.push({
      id: bullet.id,
      baseId: bullet.id,
      type: 'bullet',
      content: bullet.contentLong,
      tags: {
        industry: bullet.industryTags,
        function: bullet.functionTags,
        theme: [],
      },
    });

    // Add bullet variants
    for (const variant of bullet.variants) {
      result.push({
        id: variant.id,
        baseId: bullet.id,
        type: 'bullet',
        variantLabel: variant.label,
        content: variant.contentLong || variant.content || bullet.contentLong,
        tags: {
          industry: variant.industryTags || bullet.industryTags,
          function: variant.functionTags || bullet.functionTags,
          theme: variant.themeTags,
        },
      });
    }
  }

  return result;
}

/**
 * Transform P2 bullets and overviews into BulletSource format
 */
function loadP2Sources(rawBullets: RawBullet[], rawOverviews: RawOverview[]): BulletSource[] {
  const result: BulletSource[] = [];

  // Find P2 overview
  const p2Overview = rawOverviews.find((o) => o.position === 2);

  if (p2Overview) {
    // Add base overview
    result.push({
      id: p2Overview.id,
      baseId: p2Overview.id,
      type: 'overview',
      content: p2Overview.contentLong,
      tags: {
        industry: p2Overview.industryTags,
        function: p2Overview.functionTags,
        theme: [],
      },
    });

    // Add overview variants
    for (const variant of p2Overview.variants) {
      result.push({
        id: variant.id,
        baseId: p2Overview.id,
        type: 'overview',
        variantLabel: variant.title,
        content: p2Overview.contentLong,
        tags: {
          industry: p2Overview.industryTags,
          function: p2Overview.functionTags,
          theme: variant.themeTags,
        },
      });
    }
  }

  // Add P2 bullets and variants
  for (const bullet of rawBullets) {
    // Add base bullet
    result.push({
      id: bullet.id,
      baseId: bullet.id,
      type: 'bullet',
      content: bullet.contentLong,
      tags: {
        industry: bullet.industryTags,
        function: bullet.functionTags,
        theme: [],
      },
    });

    // Add bullet variants
    for (const variant of bullet.variants) {
      result.push({
        id: variant.id,
        baseId: bullet.id,
        type: 'bullet',
        variantLabel: variant.label,
        content: variant.contentLong || variant.content || bullet.contentLong,
        tags: {
          industry: variant.industryTags || bullet.industryTags,
          function: variant.functionTags || bullet.functionTags,
          theme: variant.themeTags,
        },
      });
    }
  }

  return result;
}

/**
 * Transform P3-P6 overviews into BulletSource format (overview only, no bullets)
 */
function loadP3P6Overviews(rawOverviews: RawOverview[]): BulletSource[] {
  const result: BulletSource[] = [];

  // Filter to P3-P6 overviews
  const p3p6Overviews = rawOverviews.filter((o) => o.position >= 3 && o.position <= 6);

  for (const overview of p3p6Overviews) {
    result.push({
      id: `OV-P${overview.position}`,
      baseId: overview.id,
      type: 'overview',
      content: overview.contentLong,
      tags: {
        industry: overview.industryTags,
        function: overview.functionTags,
        theme: [],
      },
    });
  }

  return result;
}

/**
 * Get conflict rules from master content
 */
export function loadConflictRules(
  masterContent: RawMasterContent
): Map<string, string[]> {
  const rules = new Map<string, string[]>();

  for (const rule of masterContent.conflictRules) {
    rules.set(rule.itemId, rule.conflictsWith);
    // Also set reverse mapping
    for (const conflict of rule.conflictsWith) {
      const existing = rules.get(conflict) || [];
      if (!existing.includes(rule.itemId)) {
        rules.set(conflict, [...existing, rule.itemId]);
      }
    }
  }

  return rules;
}

/**
 * Default profile for Umberto (can be overridden)
 */
export const DEFAULT_PROFILE: Profile = {
  header: {
    name: 'Umberto Castaldo',
    targetTitle: 'SVP Brand Strategy',
    location: 'New York, NY',
    phone: '917 435 2003',
    email: 'Umberto.Castaldo@gmail.com',
    linkedin: 'linkedin.com/in/umbertocastaldo',
  },
  positions: [
    {
      company: 'Deloitte Digital',
      title: 'SVP Brand Strategy',
      startDate: 'May 2021',
      endDate: 'Present',
      location: 'New York, NY',
    },
    {
      company: 'Deloitte Digital',
      title: 'Sr. Director of Brand Strategy',
      startDate: 'Apr 2018',
      endDate: 'May 2021',
      location: 'New York, NY',
    },
    {
      company: 'Omnicom Media Group',
      title: 'VP of Innovation',
      startDate: 'May 2016',
      endDate: 'Apr 2018',
      location: 'New York, NY',
    },
    {
      company: 'OMD Worldwide',
      title: 'Head of Media Innovation',
      startDate: 'Apr 2015',
      endDate: 'May 2016',
      location: 'New York, NY',
    },
    {
      company: 'Straightline International',
      title: 'Senior Brand Strategist',
      startDate: 'Jul 2014',
      endDate: 'Apr 2015',
      location: 'New York, NY',
    },
    {
      company: 'Berlin Cameron, WPP',
      title: 'Brand Strategist',
      startDate: 'Jun 2011',
      endDate: 'Jul 2014',
      location: 'New York, NY',
    },
  ],
  education: [
    {
      institution: 'Marist College',
      degree: 'Bachelor of Business Administration',
      field: 'Business Management & Marketing Communications',
    },
  ],
};

/**
 * Helper to get positions by index (1-based)
 */
export function getPosition(profile: Profile, positionNumber: number): ProfilePosition | null {
  const index = positionNumber - 1;
  return profile.positions[index] || null;
}

/**
 * Helper to get positions 3-6
 */
export function getPositions3to6(profile: Profile): ProfilePosition[] {
  return profile.positions.slice(2, 6);
}
