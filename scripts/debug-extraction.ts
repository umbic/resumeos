import mammoth from "mammoth";
import * as fs from "fs";
import * as path from "path";

const FOLDER_PATH = "/Users/UmbertoCastaldo/Desktop/Resumes to analyze";

const SECTION_MARKERS = [
  "CAREER HIGHLIGHTS",
  "PROFESSIONAL EXPERIENCE",
  "EXPERIENCE",
  "EDUCATION",
  "SKILLS",
];

function extractSummary(text: string): string | null {
  const lines = text.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);

  let currentSection = "header";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for section headers
    if (SECTION_MARKERS.some(m => line.toUpperCase().includes(m))) {
      console.log(`  Found section marker at line ${i}: ${line.substring(0, 50)}`);
      currentSection = "section";
      continue;
    }

    // Look for summary in header section
    if (currentSection === "header") {
      if (line.length > 150 && !line.includes("@") && !/\d{3}.*\d{4}/.test(line)) {
        console.log(`  Found summary at line ${i}: ${line.substring(0, 80)}...`);
        return line;
      }
    }
  }

  return null;
}

async function main() {
  const files = fs.readdirSync(FOLDER_PATH).filter((f) => f.endsWith(".docx")).slice(0, 5);

  for (const file of files) {
    console.log(`\n=== ${file} ===`);
    const result = await mammoth.extractRawText({
      path: path.join(FOLDER_PATH, file),
    });

    const summary = extractSummary(result.value);
    console.log(`  Summary: ${summary ? summary.substring(0, 60) + '...' : 'NULL'}`);
  }
}

main().catch(console.error);
