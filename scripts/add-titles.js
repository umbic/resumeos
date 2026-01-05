const fs = require('fs');
const path = require('path');

// Title mappings
const TITLES = {
  // Summaries
  'SUM-B2B': 'B2B / Enterprise',
  'SUM-FS': 'Financial Services',
  'SUM-TECH': 'Technology',
  'SUM-CON': 'Consumer',
  'SUM-CE': 'Creative Excellence',
  'SUM-PM': 'Product Marketing',
  'SUM-BS': 'Brand Strategy',
  'SUM-PG': 'Performance / Growth',

  // Career Highlights
  'CH-01': 'Deloitte Practice',
  'CH-02': 'NWSL',
  'CH-03': 'OOFOS',
  'CH-04': 'Deloitte Repositioning',
  'CH-05': 'PfizerForAll',
  'CH-06': 'LTK',
  'CH-07': 'NYU Langone',
  'CH-08': 'Gateway Health',
  'CH-09': 'American Express',
  'CH-10': 'GE Innovation',
  'CH-11': 'AI Tools',

  // Overviews
  'OV-P1': 'Deloitte Digital SVP',
  'OV-P2': 'Deloitte Digital Sr. Director',
  'OV-P3': 'Omnicom Media Group VP',
  'OV-P4': 'OMD Worldwide Head',
  'OV-P5': 'Straightline International',
  'OV-P6': 'Berlin Cameron',

  // P1 Bullets
  'P1-B01': 'Synovus',
  'P1-B02': 'Deloitte Practice',
  'P1-B03': 'Amex CRM',
  'P1-B04': 'OOFOS',
  'P1-B05': 'NYU Langone',
  'P1-B06': 'Pfizer B2B',
  'P1-B07': 'Gateway Health',
  'P1-B08': 'LTK',
  'P1-B09': 'Deloitte Only See Possible',
  'P1-B10': 'New York Life',

  // P2 Bullets
  'P2-B01': 'Salesforce',
  'P2-B02': 'Wild Turkey',
  'P2-B03': 'Deloitte Consulting',
  'P2-B04': 'NWSL Communications',
  'P2-B05': 'Energizer Auto Care',
  'P2-B06': 'Aspen Dental',
  'P2-B07': 'MTN DEW Game Fuel',
  'P2-B08': 'NWSL',
  'P2-B09': 'PfizerForAll',

  // P3 Bullets
  'P3-B01': 'Ray-Ban',
  'P3-B02': 'Soap & Glory',
  'P3-B03': 'Retail Media',

  // P4 Bullets
  'P4-B01': 'GE Podcast',
  'P4-B02': 'GE VR',

  // P5 Bullets
  'P5-B01': 'Walgreens Boots Alliance',
  'P5-B02': 'Teva',

  // P6 Bullets
  'P6-B01': 'TIAA'
};

// Update content-database.json
console.log('Updating content-database.json...');
const contentDbPath = path.join(__dirname, '../src/data/content-database.json');
const contentDb = JSON.parse(fs.readFileSync(contentDbPath, 'utf8'));

let contentUpdated = 0;
contentDb.items.forEach(item => {
  if (TITLES[item.id]) {
    item.title = TITLES[item.id];
    contentUpdated++;
  }
});

fs.writeFileSync(contentDbPath, JSON.stringify(contentDb, null, 2));
console.log(`  Updated ${contentUpdated} items in content-database.json`);

// Update variants.json base_items
console.log('Updating variants.json...');
const variantsPath = path.join(__dirname, '../src/data/variants.json');
const variants = JSON.parse(fs.readFileSync(variantsPath, 'utf8'));

let baseItemsUpdated = 0;
if (variants.base_items) {
  variants.base_items.forEach(item => {
    if (TITLES[item.id]) {
      item.title = TITLES[item.id];
      baseItemsUpdated++;
    }
  });
}

// Also add titles to overview_variants based on their theme
const overviewVariantTitles = {
  'OV-P1-B2B': 'Deloitte SVP - B2B',
  'OV-P1-FS': 'Deloitte SVP - Financial Services',
  'OV-P1-TECH': 'Deloitte SVP - Technology',
  'OV-P1-CON': 'Deloitte SVP - Consumer',
  'OV-P1-CE': 'Deloitte SVP - Creative Excellence',
  'OV-P1-PM': 'Deloitte SVP - Product Marketing',
  'OV-P1-BS': 'Deloitte SVP - Brand Strategy',
  'OV-P1-PG': 'Deloitte SVP - Performance/Growth',
  'OV-P2-B2B': 'Deloitte Sr. Dir - B2B',
  'OV-P2-FS': 'Deloitte Sr. Dir - Financial Services',
  'OV-P2-TECH': 'Deloitte Sr. Dir - Technology',
  'OV-P2-CON': 'Deloitte Sr. Dir - Consumer',
  'OV-P2-CE': 'Deloitte Sr. Dir - Creative Excellence',
  'OV-P2-PM': 'Deloitte Sr. Dir - Product Marketing',
  'OV-P2-BS': 'Deloitte Sr. Dir - Brand Strategy',
  'OV-P2-PG': 'Deloitte Sr. Dir - Performance/Growth'
};

let overviewVariantsUpdated = 0;
if (variants.overview_variants) {
  variants.overview_variants.forEach(v => {
    if (overviewVariantTitles[v.id]) {
      v.title = overviewVariantTitles[v.id];
      overviewVariantsUpdated++;
    }
  });
}

fs.writeFileSync(variantsPath, JSON.stringify(variants, null, 2));
console.log(`  Updated ${baseItemsUpdated} base_items and ${overviewVariantsUpdated} overview_variants in variants.json`);

// Export titles for other uses
fs.writeFileSync(
  path.join(__dirname, '../src/data/titles.json'),
  JSON.stringify({ ...TITLES, ...overviewVariantTitles }, null, 2)
);
console.log('  Created titles.json reference file');

console.log('\nDone! Now run: npm run db:seed to update Vercel database');
