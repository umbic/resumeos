import * as fs from 'fs';

const BASE_URL = 'https://resumeos.vercel.app';

const JOB_DESCRIPTION = `Head of GTM Narrative at Anthropic. Owns strategic storytelling for enterprise customers. 10+ years B2B marketing experience required.`;

async function main() {
  console.log('=== Debug Export Test ===\n');

  // Step 1: Analyze JD
  console.log('1. Creating session...');
  const analyzeResponse = await fetch(`${BASE_URL}/api/analyze-jd`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobDescription: JOB_DESCRIPTION }),
  });
  const { sessionId } = await analyzeResponse.json();
  console.log(`   Session: ${sessionId}\n`);

  // Step 2: Approve format
  console.log('2. Approving format...');
  await fetch(`${BASE_URL}/api/approve-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, sectionType: 'format', content: 'long' }),
  });

  // Step 3: Approve header
  console.log('3. Approving header...');
  await fetch(`${BASE_URL}/api/approve-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      sectionType: 'header',
      content: { name: 'Test User', title: 'Test Title', location: 'NYC', phone: '555', email: 'test@test.com' },
    }),
  });

  // Step 4: Generate and approve summary
  console.log('4. Generating summary...');
  const summaryResp = await fetch(`${BASE_URL}/api/generate-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, sectionType: 'summary' }),
  });
  const summaryData = await summaryResp.json();
  console.log(`   Summary generated: ${summaryData.draft?.length || 0} chars`);

  await fetch(`${BASE_URL}/api/approve-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, sectionType: 'summary', content: summaryData.draft }),
  });

  // Step 5: Search highlights
  console.log('5. Searching highlights...');
  const searchResp = await fetch(`${BASE_URL}/api/search-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, contentType: 'career_highlight', limit: 5 }),
  });
  const searchData = await searchResp.json();
  console.log(`   Found ${searchData.results?.length || 0} highlights`);

  const highlightIds = searchData.results?.slice(0, 5).map((r: { id: string }) => r.id) || [];
  console.log(`   IDs: ${highlightIds.join(', ')}`);

  // Step 6: Generate highlights
  console.log('6. Generating highlights...');
  const hlGenResp = await fetch(`${BASE_URL}/api/generate-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, sectionType: 'career_highlight', contentIds: highlightIds }),
  });
  const hlGenData = await hlGenResp.json();
  console.log(`   Generated: ${hlGenData.draft?.length || 0} chars`);
  console.log(`   Draft preview: ${hlGenData.draft?.slice(0, 200) || 'EMPTY'}...`);

  // Step 7: Approve highlights - THIS IS KEY
  console.log('7. Approving highlights...');
  const approveResp = await fetch(`${BASE_URL}/api/approve-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      sectionType: 'highlights',
      content: hlGenData.draft,
      contentIds: highlightIds,
    }),
  });
  const approveData = await approveResp.json();
  console.log(`   Approve response: ${JSON.stringify(approveData)}`);

  // Step 8: Add one position (required for export to work)
  console.log('8. Adding position 1...');
  const ovResp = await fetch(`${BASE_URL}/api/search-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, contentType: 'overview', position: 1, limit: 1 }),
  });
  const ovData = await ovResp.json();
  const overview = ovData.results?.[0]?.content || 'Test overview';

  await fetch(`${BASE_URL}/api/approve-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      sectionType: 'position',
      content: overview,
      positionData: { number: 1, title: 'Test Title', company: 'Test Co', location: 'NYC', dates: '2020-Present', bullets: [] },
    }),
  });

  // Step 9: Export
  console.log('9. Exporting DOCX...');
  const exportResp = await fetch(`${BASE_URL}/api/export-docx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });

  if (!exportResp.ok) {
    console.log(`   Export FAILED: ${await exportResp.text()}`);
    return;
  }

  const buffer = await exportResp.arrayBuffer();
  fs.writeFileSync('DEBUG_RESUME.docx', Buffer.from(buffer));
  console.log(`   Exported: ${buffer.byteLength} bytes`);
  console.log('\nFile: DEBUG_RESUME.docx');
}

main().catch(console.error);
