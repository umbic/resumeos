const fs = require('fs');
const path = require('path');

// Read master content file (single source of truth)
const masterContent = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/master-content.json'), 'utf8'));

// Build export structure
const exportData = {
  exportInfo: {
    exportedAt: new Date().toISOString(),
    purpose: "Complete ResumeOS content library for visualization",
    totalContentPieces: 0,
    source: "master-content.json (single source of truth)"
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
    description: "11 base items with themed variants",
    baseCount: 0,
    variantCount: 0,
    items: []
  },

  // OVERVIEWS
  overviews: {
    description: "6 position overviews - P1/P2 have themed variants each, P3-P6 have none",
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
masterContent.summaries.forEach(item => {
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
masterContent.careerHighlights.forEach(base => {
  const itemVariants = base.variants || [];
  exportData.careerHighlights.items.push({
    baseId: base.id,
    title: base.title || null,
    baseContent: base.contentLong?.substring(0, 80) + '...',
    functionTags: base.functionTags || [],
    industryTags: base.industryTags || [],
    exclusiveMetrics: base.exclusiveMetrics || [],
    variantCount: itemVariants.length,
    variants: itemVariants.map(v => ({
      id: v.id,
      label: v.label,
      themeTags: v.themeTags || [],
      content: v.content?.substring(0, 80) + '...'
    }))
  });
  exportData.careerHighlights.baseCount++;
  exportData.careerHighlights.variantCount += itemVariants.length;
});

// Process overviews
masterContent.overviews.forEach(base => {
  const itemVariants = base.variants || [];
  exportData.overviews.items.push({
    baseId: base.id,
    title: base.title || null,
    position: base.position,
    baseContent: base.contentLong?.substring(0, 80) + '...',
    functionTags: base.functionTags || [],
    industryTags: base.industryTags || [],
    variantCount: itemVariants.length,
    variants: itemVariants.map(v => ({
      id: v.id,
      title: v.title || null,
      themeTags: v.themeTags || []
    }))
  });
  exportData.overviews.baseCount++;
  exportData.overviews.variantCount += itemVariants.length;
});

// Process position bullets
for (let p = 1; p <= 6; p++) {
  const posKey = `P${p}`;
  const bullets = masterContent.positionBullets[posKey] || [];

  let totalVariants = 0;
  const bulletItems = bullets.map(b => {
    const bVariants = b.variants || [];
    totalVariants += bVariants.length;

    return {
      baseId: b.id,
      title: b.title || null,
      baseContent: b.contentLong?.substring(0, 80) + '...',
      functionTags: b.functionTags || [],
      industryTags: b.industryTags || [],
      exclusiveMetrics: b.exclusiveMetrics || [],
      variantCount: bVariants.length,
      variants: bVariants.map(v => ({
        id: v.id,
        label: v.label,
        themeTags: v.themeTags || [],
        content: v.contentLong?.substring(0, 80) + '...',
        industryTags: v.industryTags || [],
        functionTags: v.functionTags || [],
        exclusiveMetrics: v.exclusiveMetrics || []
      }))
    };
  });

  exportData.positionBullets.positions[posKey] = {
    positionNumber: p,
    baseCount: bullets.length,
    variantCount: totalVariants,
    totalCount: bullets.length + totalVariants,
    bullets: bulletItems
  };

  exportData.positionBullets.summary[posKey] = {
    bases: bullets.length,
    variants: totalVariants
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
