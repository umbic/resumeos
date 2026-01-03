// Simulating what export-docx does for highlights
const BASE_URL = 'https://resumeos.vercel.app';

async function test() {
  // Create a quick session and approve highlights
  console.log('Creating session...');
  const analyzeResp = await fetch(`${BASE_URL}/api/analyze-jd`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobDescription: 'Test job' }),
  });
  const { sessionId } = await analyzeResp.json();
  console.log('Session:', sessionId);

  // Approve format
  await fetch(`${BASE_URL}/api/approve-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, sectionType: 'format', content: 'long' }),
  });

  // Get highlight IDs
  const searchResp = await fetch(`${BASE_URL}/api/search-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, contentType: 'career_highlight', limit: 5 }),
  });
  const searchData = await searchResp.json();
  const highlightIds = searchData.results.map((r: { id: string }) => r.id);
  console.log('Highlight IDs from search:', highlightIds);

  // Approve highlights with these IDs
  console.log('Approving highlights...');
  const approveResp = await fetch(`${BASE_URL}/api/approve-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      sectionType: 'highlights',
      content: 'dummy content',
      contentIds: highlightIds,
    }),
  });
  console.log('Approve response:', await approveResp.json());

  // Now search again to see what content we get back
  console.log('\nFetching content again to verify...');
  const verifyResp = await fetch(`${BASE_URL}/api/search-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, contentType: 'career_highlight', limit: 5 }),
  });
  const verifyData = await verifyResp.json();

  console.log('\nContent returned:');
  verifyData.results.forEach((r: { id: string; content: string }) => {
    console.log(`  ${r.id}: ${r.content?.slice(0, 80) || 'NO CONTENT'}...`);
  });
}

test().catch(console.error);
