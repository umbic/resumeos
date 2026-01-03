import * as fs from 'fs';

const BASE_URL = 'https://resumeos.vercel.app';

const JOB_DESCRIPTION = `
# Head of GTM Narrative - Anthropic

**Position:** Head of GTM Narrative
**Location:** San Francisco, CA | New York City, NY
**Salary:** $320,000 - $400,000 USD

## About the Role

The GTM Narratives Lead owns strategic storytelling that communicates Claude's capabilities and Anthropic's mission to enterprise customers. This person crafts keynote presentations, executive briefings, and core narratives shaping how industry leaders understand the company's safe AI systems and market positioning.

## Key Responsibilities

- **Develop executive narratives:** Create high-impact presentations and strategic messaging articulating competitive differentiation
- **Drive GTM alignment:** Partner across product marketing, sales, communications, and leadership for cohesive narratives
- **Craft customer stories:** Collaborate with enterprises to showcase AI transformation journeys demonstrating real-world impact
- **Shape competitive positioning:** Translate AI capabilities and safety features into compelling differentiation messages
- **Lead without formal authority:** Rally cross-functional teams through storytelling excellence and strategic influence
- **Ensure consistency:** Establish narrative standards enabling audience-specific message adaptation
- **Support major milestones:** Lead narrative development for announcements, funding rounds, and strategic moments

## Required Qualifications

- 10+ years in product marketing, corporate messaging, or strategic communications at enterprise B2B technology companies
- Proven track record of executive-level presentations driving measurable business impact
- Deep understanding of enterprise buyer journeys and complex sales cycles
- Exceptional written and verbal communication skills making technical concepts accessible
- Experience working with senior stakeholders and providing strategic counsel
- Strong collaboration skills rallying teams without formal reporting authority
- Strategic mindset combined with hands-on execution capabilities

## Preferred Qualifications

- AI/ML or enterprise software market experience
- Background in regulated industries emphasizing trust and safety messaging
- Competitive positioning success in rapidly evolving markets
- Developer and enterprise buyer narrative development experience
- Understanding of AI safety principles communicating safeguards in business terms
- Account-based marketing experience
- Crisis communications background
`;

// Position metadata for all 6 positions
const POSITIONS = [
  {
    number: 1,
    title: 'SVP Brand Strategy / Head of Brand Strategy Practice',
    company: 'Deloitte Digital',
    location: 'New York, NY',
    dates: 'May 2021 - Present',
    bulletsNeeded: 4,
  },
  {
    number: 2,
    title: 'Sr. Director of Brand Strategy',
    company: 'Deloitte Digital',
    location: 'New York, NY',
    dates: 'Apr 2018 - May 2021',
    bulletsNeeded: 3,
  },
  {
    number: 3,
    title: 'VP of Innovation',
    company: 'Omnicom Media Group',
    location: 'New York, NY',
    dates: 'May 2016 - Apr 2018',
    bulletsNeeded: 0, // Overview only
  },
  {
    number: 4,
    title: 'Head of Media Innovation',
    company: 'OMD Worldwide',
    location: 'New York, NY',
    dates: 'Apr 2015 - May 2016',
    bulletsNeeded: 0,
  },
  {
    number: 5,
    title: 'Senior Brand Strategist',
    company: 'Straightline International',
    location: 'New York, NY',
    dates: 'Jul 2014 - Apr 2015',
    bulletsNeeded: 0,
  },
  {
    number: 6,
    title: 'Brand Strategist',
    company: 'Agency Network',
    location: 'New York, NY',
    dates: 'Jun 2012 - Jul 2014',
    bulletsNeeded: 0,
  },
];

async function main() {
  console.log('=== ResumeOS Full E2E Export Test ===\n');

  // Step 1: Analyze JD
  console.log('1. Analyzing job description...');
  const analyzeResponse = await fetch(`${BASE_URL}/api/analyze-jd`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobDescription: JOB_DESCRIPTION }),
  });

  if (!analyzeResponse.ok) {
    throw new Error(`analyze-jd failed: ${await analyzeResponse.text()}`);
  }

  const { sessionId, analysis } = await analyzeResponse.json();
  console.log(`   Session ID: ${sessionId}`);
  console.log(`   Target: ${analysis.targetTitle} at ${analysis.targetCompany}`);
  console.log('   ✓ JD analysis complete\n');

  // Step 2: Approve format (long)
  console.log('2. Approving format (long)...');
  await fetch(`${BASE_URL}/api/approve-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      sectionType: 'format',
      content: 'long',
    }),
  });
  console.log('   ✓ Format approved\n');

  // Step 3: Approve header
  console.log('3. Approving header...');
  await fetch(`${BASE_URL}/api/approve-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      sectionType: 'header',
      content: {
        name: 'Umberto Castaldo',
        title: analysis.targetTitle || 'Head of GTM Narrative',
        location: 'New York, NY',
        phone: '555-123-4567',
        email: 'umberto@example.com',
      },
    }),
  });
  console.log('   ✓ Header approved\n');

  // Step 4: Generate and approve summary
  console.log('4. Generating summary...');
  const summaryResponse = await fetch(`${BASE_URL}/api/generate-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      sectionType: 'summary',
    }),
  });

  const summaryData = await summaryResponse.json();
  console.log(`   Summary: ${summaryData.draft.slice(0, 100)}...`);

  await fetch(`${BASE_URL}/api/approve-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      sectionType: 'summary',
      content: summaryData.draft,
    }),
  });
  console.log('   ✓ Summary approved\n');

  // Step 5: Search and generate highlights
  console.log('5. Generating highlights (5)...');
  const highlightSearchResponse = await fetch(`${BASE_URL}/api/search-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      contentType: 'career_highlight',
      limit: 5,
    }),
  });

  const highlightSearchData = await highlightSearchResponse.json();
  const highlightIds = highlightSearchData.results.slice(0, 5).map((r: { id: string }) => r.id);
  console.log(`   Selected: ${highlightIds.join(', ')}`);

  const highlightsResponse = await fetch(`${BASE_URL}/api/generate-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      sectionType: 'career_highlight',
      contentIds: highlightIds,
    }),
  });

  const highlightsData = await highlightsResponse.json();

  await fetch(`${BASE_URL}/api/approve-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      sectionType: 'highlights',
      content: highlightsData.draft,
      contentIds: highlightIds,
    }),
  });
  console.log('   ✓ Highlights approved\n');

  // Step 6-11: Generate and approve all positions
  for (const pos of POSITIONS) {
    console.log(`${5 + pos.number}. Generating Position ${pos.number} (${pos.title})...`);

    // Search for overview
    const overviewResponse = await fetch(`${BASE_URL}/api/search-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        contentType: 'overview',
        position: pos.number,
        limit: 1,
      }),
    });

    const overviewData = await overviewResponse.json();
    let overview = overviewData.results[0]?.content || '';
    const overviewId = overviewData.results[0]?.id;

    let bullets: string[] = [];
    let bulletIds: string[] = [];

    // Get bullets if needed
    if (pos.bulletsNeeded > 0) {
      const bulletResponse = await fetch(`${BASE_URL}/api/search-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          contentType: 'bullet',
          position: pos.number,
          limit: pos.bulletsNeeded,
        }),
      });

      const bulletData = await bulletResponse.json();
      bulletIds = bulletData.results.slice(0, pos.bulletsNeeded).map((r: { id: string }) => r.id);

      if (bulletIds.length > 0) {
        const bulletsGenResponse = await fetch(`${BASE_URL}/api/generate-section`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            sectionType: 'bullet',
            contentIds: bulletIds,
          }),
        });

        const bulletsGenData = await bulletsGenResponse.json();
        bullets = bulletsGenData.draft
          .split('\n')
          .filter((b: string) => b.startsWith('•'))
          .map((b: string) => b.replace('• ', ''));
      }
    }

    // Approve position
    const contentIds = overviewId ? [overviewId, ...bulletIds] : bulletIds;

    await fetch(`${BASE_URL}/api/approve-section`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        sectionType: 'position',
        content: overview,
        contentIds,
        positionData: {
          number: pos.number,
          title: pos.title,
          company: pos.company,
          location: pos.location,
          dates: pos.dates,
          bullets,
        },
      }),
    });

    console.log(`   Overview: ${overview.slice(0, 80)}...`);
    if (bullets.length > 0) {
      console.log(`   Bullets: ${bullets.length}`);
    }
    console.log('   ✓ Position approved\n');
  }

  // Step 12: Export DOCX
  console.log('12. Exporting DOCX...');
  const exportResponse = await fetch(`${BASE_URL}/api/export-docx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });

  if (!exportResponse.ok) {
    throw new Error(`export-docx failed: ${await exportResponse.text()}`);
  }

  const buffer = await exportResponse.arrayBuffer();
  const filePath = 'TEST_RESUME_ANTHROPIC.docx';
  fs.writeFileSync(filePath, Buffer.from(buffer));

  console.log(`   ✓ DOCX exported to ${filePath}`);
  console.log(`   File size: ${(buffer.byteLength / 1024).toFixed(1)} KB\n`);

  console.log('=== TEST COMPLETE ===');
  console.log(`\nFile ready: ${process.cwd()}/${filePath}`);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
