import mammoth from "mammoth";
import * as fs from "fs";
import * as path from "path";

const FOLDER_PATH = "/Users/UmbertoCastaldo/Desktop/Resumes to analyze";

const POSITION_MARKERS = [
  { pattern: /Deloitte\s*Digital/i, position: "Position 1 - Deloitte" },
  { pattern: /NWSL|National Women.*Soccer/i, position: "Position 2 - NWSL" },
  { pattern: /DEUTSCH|DeutschLA/i, position: "Position 3 - Deutsch" },
  { pattern: /PEPSICO|PepsiCo|Pepsi/i, position: "Position 4 - PepsiCo" },
  { pattern: /USTA|U\.S\. Tennis/i, position: "Position 5 - USTA" },
  { pattern: /WIMM-BILL-DANN|Wimm|WBD/i, position: "Position 6 - WimmBillDann" },
];

async function main() {
  const files = fs.readdirSync(FOLDER_PATH).filter((f) => f.endsWith(".docx"));

  for (const file of files.slice(0, 5)) {
    console.log(`\n=== ${file} ===`);
    const result = await mammoth.extractRawText({
      path: path.join(FOLDER_PATH, file),
    });

    const lines = result.value.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0);

    // Find summary
    for (let i = 0; i < Math.min(lines.length, 15); i++) {
      const line = lines[i];
      if (line.length > 150 && !line.includes("@") && !/\d{3}.*\d{4}/.test(line)) {
        console.log(`Summary (line ${i}): ${line.substring(0, 100)}...`);
        break;
      }
    }
  }
}

main().catch(console.error);
