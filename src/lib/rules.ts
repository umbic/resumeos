import type { JDKeyword } from '../types';

// Conflict Map - when an item is used, its conflicts get blocked
export const CONFLICT_MAP: Record<string, string[]> = {
  'CH-01': ['P1-B02'], // Deloitte practice - same $40M metric
  'CH-02': ['P2-B08'], // NWSL - same 50% attendance metric
  'CH-03': ['P1-B04'], // OOFOS - same 191% sales metric
  'CH-04': ['P1-B09'], // Deloitte repositioning - same 43% lead gen
  'CH-05': ['P2-B09'], // PfizerForAll - same $727M metric
  'CH-06': ['P1-B08'], // LTK - same $2.8B to $5B metric
  'CH-07': ['P1-B05'], // NYU Langone - same 1.6M appointments
  'CH-08': ['P1-B07'], // Gateway - same 30K members
  'CH-09': ['P1-B03'], // Amex CRM - same 5% retention
  'CH-10': ['P4-B01', 'P4-B02'], // GE innovation - same awards
};

// Reverse conflict map (for bi-directional blocking)
export const REVERSE_CONFLICT_MAP: Record<string, string[]> = {
  'P1-B02': ['CH-01'],
  'P2-B08': ['CH-02'],
  'P1-B04': ['CH-03'],
  'P1-B09': ['CH-04'],
  'P2-B09': ['CH-05'],
  'P1-B08': ['CH-06'],
  'P1-B05': ['CH-07'],
  'P1-B07': ['CH-08'],
  'P1-B03': ['CH-09'],
  'P4-B01': ['CH-10'],
  'P4-B02': ['CH-10'],
};

// Competitor branding rules
export const COMPETITOR_MAP: Record<string, string[]> = {
  McKinsey: ['Deloitte'],
  BCG: ['Deloitte'],
  Bain: ['Deloitte'],
  Accenture: ['Deloitte'],
  EY: ['Deloitte'],
  KPMG: ['Deloitte'],
  PwC: ['Deloitte'],
  WPP: ['Omnicom', 'OMD'],
  Publicis: ['Omnicom', 'OMD'],
  IPG: ['Omnicom', 'OMD'],
  Dentsu: ['Omnicom', 'OMD'],
};

// Always use generic version for these brands
export const ALWAYS_GENERIC = ['SAP'];

// Junior skills to filter out from ATS keyword extraction
// These are too tactical/junior for executive-level resumes
export const JUNIOR_SKILLS_IGNORE_LIST = [
  // Office tools
  'excel',
  'powerpoint',
  'word',
  'google sheets',
  'google slides',
  'google docs',
  'microsoft office',
  'ms office',
  'outlook',

  // Technical/tactical
  'sql',
  'html',
  'css',
  'javascript',
  'python',
  'r programming',
  'google analytics',
  'adobe analytics',
  'mixpanel',
  'mailchimp',
  'constant contact',
  'hubspot certifications',

  // Junior marketing
  'social media posting',
  'content calendar',
  'email scheduling',
  'canva',
  'basic photoshop',
  'wordpress admin',

  // Generic/filler
  'attention to detail',
  'team player',
  'self-starter',
  'fast-paced environment',
  'multitasking',
  'detail-oriented',
  'results-driven',
  'proactive',
];

// Filter keywords to remove junior/tactical skills
export function filterExecutiveKeywords(keywords: JDKeyword[]): JDKeyword[] {
  return keywords.filter(
    (k) =>
      !JUNIOR_SKILLS_IGNORE_LIST.some((junior) =>
        k.keyword.toLowerCase().includes(junior.toLowerCase())
      )
  );
}

// Format rules
export const FORMAT_RULES = {
  long: {
    summaryLines: '4-5',
    careerHighlightsCount: 5,
    careerHighlightsVersion: 'medium' as const,
    position1Bullets: 4,
    position2Bullets: 3,
    position3_6Bullets: 0,
    bulletVersion: 'long' as const,
  },
  short: {
    summaryLines: '3-4',
    careerHighlightsCount: 5,
    careerHighlightsVersion: 'short' as const,
    position1Bullets: 0,
    position2Bullets: 0,
    position3_6Bullets: 0,
    bulletVersion: null,
  },
};

// Position metadata
export const POSITIONS = [
  {
    number: 1,
    titleDefault: 'SVP Brand Strategy / Head of Brand Strategy Practice',
    titleOptions: ['Head of Brand Strategy & Activation', 'SVP Brand Strategy'],
    company: 'Deloitte Digital',
    location: 'New York, NY',
    dates: 'May 2021 - Present',
    maxBulletsLong: 4,
    maxBulletsShort: 0,
  },
  {
    number: 2,
    titleDefault: 'Sr. Director of Brand Strategy',
    titleOptions: ['Director of Brand Strategy'],
    company: 'Deloitte Digital',
    location: 'New York, NY',
    dates: 'Apr 2018 - May 2021',
    maxBulletsLong: 3,
    maxBulletsShort: 0,
  },
  {
    number: 3,
    titleDefault: 'VP of Innovation',
    titleOptions: ['Director of Innovation'],
    company: 'Omnicom Media Group',
    location: 'New York, NY',
    dates: 'May 2016 - Apr 2018',
    maxBulletsLong: 0,
    maxBulletsShort: 0,
  },
  {
    number: 4,
    titleDefault: 'Head of Media Innovation',
    titleOptions: ['Director of Media Innovation and Brand Partnerships'],
    company: 'OMD Worldwide',
    location: 'New York, NY',
    dates: 'Apr 2015 - May 2016',
    maxBulletsLong: 0,
    maxBulletsShort: 0,
  },
  {
    number: 5,
    titleDefault: 'Senior Brand Strategist',
    titleOptions: [],
    company: 'Straightline International',
    location: 'New York, NY',
    dates: 'Jul 2014 - Apr 2015',
    maxBulletsLong: 0,
    maxBulletsShort: 0,
  },
  {
    number: 6,
    titleDefault: 'Brand Strategist',
    titleOptions: ['Creative Strategist'],
    company: 'Berlin Cameron, WPP Cultural Agency',
    location: 'New York, NY',
    dates: 'Jun 2011 - Jul 2014',
    maxBulletsLong: 0,
    maxBulletsShort: 0,
  },
];

// Static content
export const STATIC_CONTENT = {
  header: {
    name: 'Umberto Castaldo',
    location: 'New York, NY',
    phone: '917 435 2003',
    email: 'Umberto.Castaldo@gmail.com',
  },
  education: {
    degree: 'Bachelor of Business Administration',
    field: 'Business Management & Marketing Communications',
    school: 'Marist College',
  },
};

// Helper functions
export function getConflicts(itemId: string): string[] {
  return [
    ...(CONFLICT_MAP[itemId] || []),
    ...(REVERSE_CONFLICT_MAP[itemId] || []),
  ];
}

export function getAllConflicts(itemIds: string[]): string[] {
  const conflicts = new Set<string>();
  for (const id of itemIds) {
    for (const conflict of getConflicts(id)) {
      conflicts.add(conflict);
    }
  }
  return Array.from(conflicts);
}

export function shouldUseGeneric(
  brandTags: string[],
  targetCompany: string
): boolean {
  // Check if any brand tag is in the always generic list
  if (brandTags.some((tag) => ALWAYS_GENERIC.includes(tag))) {
    return true;
  }

  // Check if target company has competitor conflicts
  const competitorBrands = COMPETITOR_MAP[targetCompany] || [];
  return brandTags.some((tag) => competitorBrands.includes(tag));
}

export function getContentVersion(
  item: {
    contentShort?: string | null;
    contentMedium?: string | null;
    contentLong?: string | null;
    contentGeneric?: string | null;
    brandTags?: string[];
  },
  version: 'short' | 'medium' | 'long',
  useGeneric: boolean
): string {
  if (useGeneric && item.contentGeneric) {
    return item.contentGeneric;
  }

  switch (version) {
    case 'short':
      return item.contentShort || item.contentMedium || item.contentLong || '';
    case 'medium':
      return item.contentMedium || item.contentLong || item.contentShort || '';
    case 'long':
      return item.contentLong || item.contentMedium || item.contentShort || '';
    default:
      return item.contentLong || item.contentMedium || item.contentShort || '';
  }
}

export function isValidForSection(itemId: string, section: string): boolean {
  const prefix = itemId.split('-')[0];

  switch (section) {
    case 'summary':
      return prefix === 'SUM';
    case 'career_highlight':
      return prefix === 'CH';
    case 'bullet':
      return prefix.startsWith('P') && itemId.includes('-B');
    case 'overview':
      return prefix === 'OV';
    default:
      return false;
  }
}

export function getPositionFromId(itemId: string): number | null {
  const match = itemId.match(/P(\d)/);
  return match ? parseInt(match[1], 10) : null;
}
