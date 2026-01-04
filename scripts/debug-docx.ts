import mammoth from "mammoth";

async function main() {
  const result = await mammoth.extractRawText({
    path: '/Users/UmbertoCastaldo/Desktop/Resumes to analyze/24. Umberto Castaldo_Resume.docx'
  });

  console.log("=== Raw text structure ===\n");

  const lines = result.value.split(/\n/);
  for (let i = 0; i < Math.min(lines.length, 100); i++) {
    const line = lines[i];
    const charCodes = [...line.substring(0, 5)].map(c => c.charCodeAt(0));
    console.log(`Line ${i}: [${charCodes.join(',')}] ${line.substring(0, 150)}`);
  }
}

main().catch(console.error);
