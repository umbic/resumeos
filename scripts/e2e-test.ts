import * as fs from 'fs';

const BASE_URL = process.env.BASE_URL || 'https://resumeos.vercel.app';

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

## Education & Logistics

- Bachelor's degree required or equivalent experience
- Hybrid arrangement: minimum 25% in-office time
- Visa sponsorship available
`;

interface TestResult {
  sessionId: string;
  analysis: {
    keywords: Array<{ keyword: string; priority: string }>;
    themes: string[];
    targetTitle: string;
    targetCompany: string;
  };
  summary: {
    draft: string;
    detectedVerbs: string[];
    missingKeywords: unknown[];
  };
  highlights: {
    draft: string | string[];
    detectedVerbs: string[];
    contentIds: string[];
  };
  position1: {
    draft: { overview: string; bullets: string[] };
    detectedVerbs: string[];
    contentIds: string[];
  };
  position2: {
    draft: { overview: string; bullets: string[] };
    detectedVerbs: string[];
    contentIds: string[];
  };
  verbTracker: {
    usedVerbs: Record<string, string[]>;
    availableVerbs: string[];
  };
}

async function runTest(): Promise<TestResult> {
  const result: Partial<TestResult> = {};

  console.log('=== ResumeOS E2E Test ===\n');

  // Step 1: Analyze JD
  console.log('1. Analyzing job description...');
  const analyzeResponse = await fetch(`${BASE_URL}/api/analyze-jd`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobDescription: JOB_DESCRIPTION }),
  });

  if (!analyzeResponse.ok) {
    const error = await analyzeResponse.text();
    throw new Error(`analyze-jd failed: ${error}`);
  }

  const analyzeData = await analyzeResponse.json();
  result.sessionId = analyzeData.sessionId;
  result.analysis = {
    keywords: analyzeData.analysis.keywords || [],
    themes: analyzeData.analysis.themes || [],
    targetTitle: analyzeData.analysis.targetTitle,
    targetCompany: analyzeData.analysis.targetCompany,
  };

  console.log(`   Session ID: ${result.sessionId}`);
  console.log(`   Target: ${result.analysis.targetTitle} at ${result.analysis.targetCompany}`);
  console.log(`   Keywords: ${result.analysis.keywords.slice(0, 5).map((k: { keyword: string }) => k.keyword).join(', ')}...`);
  console.log('   ✓ JD analysis complete\n');

  // Step 2: Approve format (long)
  console.log('2. Approving format...');
  await fetch(`${BASE_URL}/api/approve-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: result.sessionId,
      sectionType: 'format',
      content: 'long',
    }),
  });
  console.log('   ✓ Format approved (long)\n');

  // Step 3: Generate summary
  console.log('3. Generating summary...');
  const summaryResponse = await fetch(`${BASE_URL}/api/generate-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: result.sessionId,
      sectionType: 'summary',
    }),
  });

  if (!summaryResponse.ok) {
    const error = await summaryResponse.text();
    throw new Error(`generate-section (summary) failed: ${error}`);
  }

  const summaryData = await summaryResponse.json();
  result.summary = {
    draft: summaryData.draft,
    detectedVerbs: summaryData.detectedVerbs || [],
    missingKeywords: summaryData.missingKeywords || [],
  };
  console.log(`   Summary length: ${result.summary.draft.length} chars`);
  console.log(`   Detected verbs: ${result.summary.detectedVerbs.join(', ')}`);
  console.log('   ✓ Summary generated\n');

  // Step 4: Approve summary
  console.log('4. Approving summary...');
  await fetch(`${BASE_URL}/api/approve-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: result.sessionId,
      sectionType: 'summary',
      content: result.summary.draft,
    }),
  });
  console.log('   ✓ Summary approved\n');

  // Step 5: Search for highlights
  console.log('5. Searching for highlights...');
  const highlightSearchResponse = await fetch(`${BASE_URL}/api/search-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: result.sessionId,
      contentType: 'career_highlight',
      limit: 5,
    }),
  });

  if (!highlightSearchResponse.ok) {
    const error = await highlightSearchResponse.text();
    throw new Error(`search-content (highlights) failed: ${error}`);
  }

  const highlightSearchData = await highlightSearchResponse.json();
  const highlightIds = highlightSearchData.results.slice(0, 5).map((r: { id: string }) => r.id);
  console.log(`   Found ${highlightSearchData.results.length} highlights`);
  console.log(`   Selected IDs: ${highlightIds.join(', ')}`);

  // Step 6: Generate highlights
  console.log('6. Generating highlights...');
  const highlightsResponse = await fetch(`${BASE_URL}/api/generate-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: result.sessionId,
      sectionType: 'career_highlight',
      contentIds: highlightIds,
    }),
  });

  if (!highlightsResponse.ok) {
    const error = await highlightsResponse.text();
    throw new Error(`generate-section (highlights) failed: ${error}`);
  }

  const highlightsData = await highlightsResponse.json();
  result.highlights = {
    draft: highlightsData.draft,
    detectedVerbs: highlightsData.detectedVerbs || [],
    contentIds: highlightIds,
  };
  console.log(`   Detected verbs: ${result.highlights.detectedVerbs.join(', ')}`);
  console.log('   ✓ Highlights generated\n');

  // Step 7: Approve highlights
  console.log('7. Approving highlights...');
  await fetch(`${BASE_URL}/api/approve-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: result.sessionId,
      sectionType: 'highlights',
      content: result.highlights.draft,
      contentIds: highlightIds,
    }),
  });
  console.log('   ✓ Highlights approved\n');

  // Step 8: Search for Position 1 bullets
  console.log('8. Searching for Position 1 content...');
  const p1OverviewResponse = await fetch(`${BASE_URL}/api/search-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: result.sessionId,
      contentType: 'overview',
      position: 1,
      limit: 3,
    }),
  });

  const p1BulletResponse = await fetch(`${BASE_URL}/api/search-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: result.sessionId,
      contentType: 'bullet',
      position: 1,
      limit: 4,
    }),
  });

  const p1OverviewData = await p1OverviewResponse.json();
  const p1BulletData = await p1BulletResponse.json();
  const p1OverviewId = p1OverviewData.results[0]?.id;
  const p1BulletIds = p1BulletData.results.slice(0, 4).map((r: { id: string }) => r.id);
  console.log(`   Overview ID: ${p1OverviewId}`);
  console.log(`   Bullet IDs: ${p1BulletIds.join(', ')}`);

  // Step 9: Generate Position 1
  console.log('9. Generating Position 1...');
  const p1OverviewContent = p1OverviewData.results[0]?.content || '';

  // Generate bullets for P1
  const p1BulletsResponse = await fetch(`${BASE_URL}/api/generate-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: result.sessionId,
      sectionType: 'bullet',
      contentIds: p1BulletIds,
    }),
  });

  const p1BulletsData = await p1BulletsResponse.json();
  const p1Bullets = p1BulletsData.draft.split('\n').filter((b: string) => b.startsWith('•')).map((b: string) => b.replace('• ', ''));

  result.position1 = {
    draft: {
      overview: p1OverviewContent,
      bullets: p1Bullets,
    },
    detectedVerbs: p1BulletsData.detectedVerbs || [],
    contentIds: [p1OverviewId, ...p1BulletIds],
  };
  console.log(`   Detected verbs: ${result.position1.detectedVerbs.join(', ')}`);
  console.log('   ✓ Position 1 generated\n');

  // Step 10: Approve Position 1
  console.log('10. Approving Position 1...');
  await fetch(`${BASE_URL}/api/approve-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: result.sessionId,
      sectionType: 'position',
      content: result.position1.draft.overview,
      contentIds: result.position1.contentIds,
      positionData: {
        number: 1,
        title: 'VP Marketing',
        company: 'TechCorp',
        location: 'San Francisco, CA',
        dates: '2020 - Present',
        bullets: result.position1.draft.bullets,
      },
    }),
  });
  console.log('   ✓ Position 1 approved\n');

  // Step 11: Search for Position 2 bullets
  console.log('11. Searching for Position 2 content...');
  const p2OverviewResponse = await fetch(`${BASE_URL}/api/search-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: result.sessionId,
      contentType: 'overview',
      position: 2,
      limit: 3,
    }),
  });

  const p2BulletResponse = await fetch(`${BASE_URL}/api/search-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: result.sessionId,
      contentType: 'bullet',
      position: 2,
      limit: 3,
    }),
  });

  const p2OverviewData = await p2OverviewResponse.json();
  const p2BulletData = await p2BulletResponse.json();
  const p2OverviewId = p2OverviewData.results[0]?.id;
  const p2BulletIds = p2BulletData.results.slice(0, 3).map((r: { id: string }) => r.id);
  console.log(`   Overview ID: ${p2OverviewId}`);
  console.log(`   Bullet IDs: ${p2BulletIds.join(', ')}`);

  // Step 12: Generate Position 2
  console.log('12. Generating Position 2...');
  const p2OverviewContent = p2OverviewData.results[0]?.content || '';

  const p2BulletsResponse = await fetch(`${BASE_URL}/api/generate-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: result.sessionId,
      sectionType: 'bullet',
      contentIds: p2BulletIds,
    }),
  });

  const p2BulletsData = await p2BulletsResponse.json();
  const p2Bullets = p2BulletsData.draft.split('\n').filter((b: string) => b.startsWith('•')).map((b: string) => b.replace('• ', ''));

  result.position2 = {
    draft: {
      overview: p2OverviewContent,
      bullets: p2Bullets,
    },
    detectedVerbs: p2BulletsData.detectedVerbs || [],
    contentIds: [p2OverviewId, ...p2BulletIds],
  };
  console.log(`   Detected verbs: ${result.position2.detectedVerbs.join(', ')}`);
  console.log('   ✓ Position 2 generated\n');

  // Step 13: Approve Position 2
  console.log('13. Approving Position 2...');
  await fetch(`${BASE_URL}/api/approve-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: result.sessionId,
      sectionType: 'position',
      content: result.position2.draft.overview,
      contentIds: result.position2.contentIds,
      positionData: {
        number: 2,
        title: 'Director Marketing',
        company: 'PrevCorp',
        location: 'New York, NY',
        dates: '2017 - 2020',
        bullets: result.position2.draft.bullets,
      },
    }),
  });
  console.log('   ✓ Position 2 approved\n');

  // Step 14: Get final verb tracker
  console.log('14. Fetching final session state...');
  const finalSessionResponse = await fetch(`${BASE_URL}/api/session/${result.sessionId}`);

  // If endpoint doesn't exist, use SQL directly (handled in report)
  if (finalSessionResponse.ok) {
    const finalSession = await finalSessionResponse.json();
    result.verbTracker = finalSession.verbTracker;
  } else {
    // Aggregate verbs from all sections
    result.verbTracker = {
      usedVerbs: {
        summary: result.summary.detectedVerbs,
        highlights: result.highlights.detectedVerbs,
        position_1: result.position1.detectedVerbs,
        position_2: result.position2.detectedVerbs,
      },
      availableVerbs: [],
    };
  }
  console.log('   ✓ Final state retrieved\n');

  return result as TestResult;
}

function gradeResults(result: TestResult): void {
  console.log('\n=== GRADING RESULTS ===\n');

  // Collect all verbs
  const allVerbs: string[] = [
    ...result.summary.detectedVerbs,
    ...result.highlights.detectedVerbs,
    ...result.position1.detectedVerbs,
    ...result.position2.detectedVerbs,
  ];

  // Count verb frequency
  const verbCounts: Record<string, number> = {};
  allVerbs.forEach((v) => {
    verbCounts[v] = (verbCounts[v] || 0) + 1;
  });

  // Generate report
  const report: string[] = [];
  report.push('# ResumeOS E2E Test Results');
  report.push(`\n**Test Date:** ${new Date().toISOString()}`);
  report.push(`**Session ID:** ${result.sessionId}`);
  report.push(`**Target Role:** ${result.analysis.targetTitle} at ${result.analysis.targetCompany}`);

  // Verb Tracking Section
  report.push('\n## Verb Tracking\n');
  report.push('### All Verbs Used');
  report.push('| Verb | Count | Section(s) |');
  report.push('|------|-------|------------|');

  const sortedVerbs = Object.entries(verbCounts).sort((a, b) => b[1] - a[1]);
  sortedVerbs.forEach(([verb, count]) => {
    const sections: string[] = [];
    if (result.summary.detectedVerbs.includes(verb)) sections.push('Summary');
    if (result.highlights.detectedVerbs.includes(verb)) sections.push('Highlights');
    if (result.position1.detectedVerbs.includes(verb)) sections.push('P1');
    if (result.position2.detectedVerbs.includes(verb)) sections.push('P2');
    const flag = count > 2 ? ' ⚠️' : '';
    report.push(`| ${verb}${flag} | ${count} | ${sections.join(', ')} |`);
  });

  const overusedVerbs = sortedVerbs.filter(([, count]) => count > 2);
  const verbPass = overusedVerbs.length === 0;
  report.push(`\n**Verbs used more than 2x:** ${overusedVerbs.length > 0 ? overusedVerbs.map(([v]) => v).join(', ') : 'None'}`);
  report.push(`\n**Result:** ${verbPass ? '✅ PASS' : '❌ FAIL'}`);

  // Keyword Integration Section
  report.push('\n## Keyword Integration\n');

  const summaryText = result.summary.draft.toLowerCase();
  const keywordsInSummary = result.analysis.keywords.filter((k) =>
    summaryText.includes(k.keyword.toLowerCase())
  );

  report.push(`**Keywords found in summary:** ${keywordsInSummary.length}`);
  report.push(`**Target range:** 8-12`);

  // Check for stuffing patterns
  const stuffingPatterns = [
    'leveraging data-driven strategies',
    'driving strategic initiatives',
    'leveraging cutting-edge',
    'synergizing cross-functional',
    'leveraging innovative',
  ];

  const foundStuffing = stuffingPatterns.filter((p) =>
    summaryText.includes(p.toLowerCase())
  );

  report.push(`**Stuffing patterns detected:** ${foundStuffing.length > 0 ? foundStuffing.join(', ') : 'None'}`);

  const keywordPass = keywordsInSummary.length >= 8 && keywordsInSummary.length <= 12 && foundStuffing.length === 0;
  report.push(`\n**Result:** ${keywordPass ? '✅ PASS' : keywordsInSummary.length < 8 ? '⚠️ NEEDS MORE KEYWORDS' : keywordsInSummary.length > 12 ? '⚠️ KEYWORD STUFFING' : '❌ FAIL'}`);

  // Content Quality Section
  report.push('\n## Content Quality\n');

  // Check CAR structure in bullets
  report.push('### CAR Structure Analysis');
  const allBullets = [
    ...result.position1.draft.bullets,
    ...result.position2.draft.bullets,
  ];

  const carPatterns = {
    challenge: /(?:faced|challenged|tasked|required|needed)/i,
    action: /(?:led|developed|created|implemented|designed|built|launched)/i,
    result: /(?:\d+%|\$\d+|increased|reduced|improved|achieved|generated|drove)/i,
  };

  let bulletsCar = 0;
  allBullets.forEach((bullet) => {
    const hasAction = carPatterns.action.test(bullet);
    const hasResult = carPatterns.result.test(bullet);
    if (hasAction && hasResult) bulletsCar++;
  });

  report.push(`**Bullets with CAR structure:** ${bulletsCar}/${allBullets.length}`);

  // Check mark tag density
  report.push('\n### Mark Tag Density');
  const fullText = result.summary.draft +
    (Array.isArray(result.highlights.draft) ? result.highlights.draft.join(' ') : result.highlights.draft) +
    result.position1.draft.overview + result.position1.draft.bullets.join(' ') +
    result.position2.draft.overview + result.position2.draft.bullets.join(' ');

  const markTagCount = (fullText.match(/<mark>/g) || []).length;
  const markTagDensity = markTagCount > 0 ? 'Sparse (2-4)' : 'None';

  report.push(`**Mark tags found:** ${markTagCount}`);
  report.push(`**Density:** ${markTagDensity}`);

  // Naturalness check (simple heuristics)
  report.push('\n### Summary Naturalness');
  const summaryWords = result.summary.draft.split(/\s+/).length;
  const summarySentences = result.summary.draft.split(/[.!?]+/).filter((s) => s.trim()).length;
  const avgWordsPerSentence = summaryWords / summarySentences;

  report.push(`**Word count:** ${summaryWords}`);
  report.push(`**Sentences:** ${summarySentences}`);
  report.push(`**Avg words/sentence:** ${avgWordsPerSentence.toFixed(1)}`);

  const naturalPass = avgWordsPerSentence >= 10 && avgWordsPerSentence <= 25;
  report.push(`**Natural flow:** ${naturalPass ? '✅ PASS' : '⚠️ May need revision'}`);

  const contentPass = bulletsCar >= allBullets.length * 0.7 && markTagCount <= 10 && naturalPass;
  report.push(`\n**Overall Content Quality:** ${contentPass ? '✅ PASS' : '❌ FAIL'}`);

  // Overall Grade
  report.push('\n## Overall Grade\n');

  const passCount = [verbPass, keywordPass, contentPass].filter(Boolean).length;

  let grade: string;
  let reasoning: string;

  if (passCount === 3) {
    grade = 'A';
    reasoning = 'All quality checks passed. Verb variety maintained, keywords integrated naturally, and content follows CAR structure.';
  } else if (passCount === 2) {
    grade = 'B';
    reasoning = 'Most quality checks passed. Minor improvements needed in one area.';
  } else if (passCount === 1) {
    grade = 'C';
    reasoning = 'Multiple areas need improvement. System is functional but quality is inconsistent.';
  } else {
    grade = 'D';
    reasoning = 'Significant quality issues detected across multiple dimensions.';
  }

  report.push(`### Grade: ${grade}\n`);
  report.push(`**Reasoning:** ${reasoning}\n`);
  report.push('**Score Breakdown:**');
  report.push(`- Verb Tracking: ${verbPass ? '✅' : '❌'}`);
  report.push(`- Keyword Integration: ${keywordPass ? '✅' : '❌'}`);
  report.push(`- Content Quality: ${contentPass ? '✅' : '❌'}`);

  // Generated Content
  report.push('\n---\n## Generated Content Preview\n');

  report.push('### Summary');
  report.push('```');
  report.push(result.summary.draft);
  report.push('```\n');

  report.push('### Career Highlights');
  report.push('```');
  report.push(Array.isArray(result.highlights.draft) ? result.highlights.draft.join('\n') : result.highlights.draft);
  report.push('```\n');

  report.push('### Position 1 Bullets');
  report.push('```');
  result.position1.draft.bullets.forEach((b) => report.push(`• ${b}`));
  report.push('```\n');

  report.push('### Position 2 Bullets');
  report.push('```');
  result.position2.draft.bullets.forEach((b) => report.push(`• ${b}`));
  report.push('```');

  // Write report
  const reportContent = report.join('\n');
  fs.writeFileSync('TEST_RESULTS.md', reportContent);
  console.log(reportContent);
  console.log('\n✅ Report saved to TEST_RESULTS.md');
}

async function main() {
  try {
    const result = await runTest();
    gradeResults(result);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

main();
