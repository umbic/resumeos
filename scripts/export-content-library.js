const fs = require('fs');
const path = require('path');

// Read source files
const contentDbRaw = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/content-database.json'), 'utf8'));
const contentDb = contentDbRaw.items; // Items array is inside the object
const variants = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/variants.json'), 'utf8'));

// Read position bullet variants (not yet in database, but included for visualization)
let positionBulletVariants = {};
try {
  const pbvData = JSON.parse(fs.readFileSync(path.join(__dirname, '../position-bullet-variants.json'), 'utf8'));
  positionBulletVariants = pbvData.positionBulletVariants || {};
} catch (e) {
  console.log('Note: position-bullet-variants.json not found or invalid');
}

// Build export structure
const exportData = {
  exportInfo: {
    exportedAt: new Date().toISOString(),
    purpose: "Complete ResumeOS content library for visualization",
    totalContentPieces: 0,
    sources: {
      "content-database.json": "Base content items",
      "variants.json": "Themed variants and base item metadata"
    },
    notYetSeeded: {
      file: "position-bullet-variants.json",
      description: "42 additional position bullet variants matching CH themes - NOT in database yet"
    }
  },

  // SUMMARIES
  summaries: {
    description: "8 thematic summaries scored by industry/function/theme tags",
    count: 0,
    themes: ["B2B", "FS (Financial Services)", "TECH", "CON (Consumer)", "CE (Creative Excellence)", "PM (Product Marketing)", "BS (Brand Strategy)", "PG (Performance/Growth)"],
    items: []
  },

  // CAREER HIGHLIGHTS
  careerHighlights: {
    description: "11 base items with 46 themed variants",
    baseCount: 0,
    variantCount: 0,
    items: []
  },

  // OVERVIEWS
  overviews: {
    description: "6 position overviews - P1/P2 have 8 themed variants each, P3-P6 have none",
    baseCount: 0,
    variantCount: 0,
    items: []
  },

  // POSITION BULLETS
  positionBullets: {
    description: "Bullets organized by position with their variants",
    summary: {},
    positions: {}
  }
};

// Process summaries
contentDb.filter(item => item.type === 'summary').forEach(item => {
  exportData.summaries.items.push({
    id: item.id,
    title: item.title || null,
    industryTags: item.industryTags || [],
    functionTags: item.functionTags || [],
    themeTags: item.themeTags || [],
    contentPreview: item.contentLong?.substring(0, 100) + '...'
  });
  exportData.summaries.count++;
});

// Process career highlights
const chBases = contentDb.filter(item => item.type === 'career_highlight');
const chVariants = variants.variants?.filter(v => v.base_id?.startsWith('CH-')) || [];

chBases.forEach(base => {
  const itemVariants = chVariants.filter(v => v.base_id === base.id);
  exportData.careerHighlights.items.push({
    baseId: base.id,
    title: base.title || null,
    baseContent: base.contentLong?.substring(0, 80) + '...',
    functionTags: base.functionTags || [],
    variantCount: itemVariants.length,
    variants: itemVariants.map(v => ({
      id: v.id,
      label: v.variant_label,
      themeTags: v.theme_tags || []
    }))
  });
  exportData.careerHighlights.baseCount++;
});
exportData.careerHighlights.variantCount = chVariants.length;

// Process overviews
const ovBases = contentDb.filter(item => item.type === 'overview');
const ovVariants = variants.overview_variants || [];

ovBases.forEach(base => {
  const position = base.position || parseInt(base.id.replace('OV-P', ''));
  const itemVariants = ovVariants.filter(v => v.id?.includes(`P${position}-`));
  exportData.overviews.items.push({
    baseId: base.id,
    title: base.title || null,
    position: position,
    baseContent: base.contentLong?.substring(0, 80) + '...',
    variantCount: itemVariants.length,
    variants: itemVariants.map(v => ({
      id: v.id,
      title: v.title || null,
      themeTags: v.theme_tags || []
    }))
  });
  exportData.overviews.baseCount++;
});
exportData.overviews.variantCount = ovVariants.length;

// Process position bullets
for (let p = 1; p <= 6; p++) {
  const bullets = contentDb.filter(item => item.type === 'bullet' && item.position === p);
  const bulletVariants = variants.variants?.filter(v => v.base_id?.startsWith(`P${p}-B`)) || [];

  // Get additional variants from position-bullet-variants.json (not yet seeded)
  const additionalVariants = [];
  Object.entries(positionBulletVariants).forEach(([baseId, data]) => {
    if (baseId.startsWith(`P${p}-B`) && data.variants) {
      additionalVariants.push(...data.variants);
    }
  });

  const totalVariantCount = bulletVariants.length + additionalVariants.length;

  exportData.positionBullets.positions[`P${p}`] = {
    positionNumber: p,
    baseCount: bullets.length,
    variantCount: totalVariantCount,
    totalCount: bullets.length + totalVariantCount,
    bullets: bullets.map(b => {
      // Variants from variants.json (already seeded)
      const bVariants = bulletVariants.filter(v => v.base_id === b.id);
      // Additional variants from position-bullet-variants.json (not yet seeded)
      const pbvData = positionBulletVariants[b.id];
      const pbvVariants = pbvData?.variants || [];

      const allVariants = [
        ...bVariants.map(v => ({
          id: v.id,
          label: v.variant_label,
          themeTags: v.theme_tags || [],
          content: null, // Already seeded variants don't have content in this export
          notSeeded: false
        })),
        ...pbvVariants.map(v => ({
          id: v.id,
          label: v.variantLabel,
          themeTags: v.themeTags || [],
          content: v.contentLong,
          industryTags: v.industryTags || [],
          functionTags: v.functionTags || [],
          exclusiveMetrics: v.exclusiveMetrics || [],
          notSeeded: true // Mark as not yet in database
        }))
      ];

      return {
        baseId: b.id,
        title: b.title || null,
        baseContent: b.contentLong?.substring(0, 80) + '...',
        functionTags: b.functionTags || [],
        exclusiveMetrics: b.exclusiveMetrics || [],
        variantCount: allVariants.length,
        variants: allVariants
      };
    })
  };

  exportData.positionBullets.summary[`P${p}`] = {
    bases: bullets.length,
    variants: totalVariantCount
  };
}

// Calculate totals
let total = 0;
total += exportData.summaries.count;
total += exportData.careerHighlights.baseCount + exportData.careerHighlights.variantCount;
total += exportData.overviews.baseCount + exportData.overviews.variantCount;
Object.values(exportData.positionBullets.positions).forEach(p => {
  total += p.baseCount + p.variantCount;
});
exportData.exportInfo.totalContentPieces = total;

// Write export
fs.writeFileSync(
  path.join(__dirname, '../CONTENT_LIBRARY_EXPORT.json'),
  JSON.stringify(exportData, null, 2)
);

console.log('Export complete!');
console.log(`Total content pieces: ${total}`);
console.log(`- Summaries: ${exportData.summaries.count}`);
console.log(`- Career Highlights: ${exportData.careerHighlights.baseCount} base + ${exportData.careerHighlights.variantCount} variants`);
console.log(`- Overviews: ${exportData.overviews.baseCount} base + ${exportData.overviews.variantCount} variants`);
console.log(`- Position Bullets:`);
Object.entries(exportData.positionBullets.summary).forEach(([pos, counts]) => {
  console.log(`  ${pos}: ${counts.bases} base + ${counts.variants} variants`);
});
