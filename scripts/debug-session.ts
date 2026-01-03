const BASE_URL = 'https://resumeos.vercel.app';

// Use the session ID from the last run
const SESSION_ID = '25129eca-3a0f-4b62-81f8-df139cac7edf';

async function debug() {
  console.log('Checking session state...\n');

  // Try to get raw session data via a search to see blocked IDs
  const searchResponse = await fetch(`${BASE_URL}/api/search-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      contentType: 'career_highlight',
      limit: 10,
    }),
  });

  const searchData = await searchResponse.json();
  console.log('Search results:', JSON.stringify(searchData, null, 2));

  // Try export again
  console.log('\nAttempting export...');
  const exportResponse = await fetch(`${BASE_URL}/api/export-docx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: SESSION_ID }),
  });

  if (!exportResponse.ok) {
    console.log('Export failed:', await exportResponse.text());
  } else {
    console.log('Export succeeded, size:', (await exportResponse.arrayBuffer()).byteLength);
  }
}

debug();
