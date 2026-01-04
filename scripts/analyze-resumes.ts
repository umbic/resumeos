import mammoth from "mammoth";
import * as fs from "fs";
import * as path from "path";

const FOLDER_PATH = "/Users/UmbertoCastaldo/Desktop/Resumes to analyze";
const OUTPUT_PATH = "/Users/UmbertoCastaldo/Desktop/resume_content_analysis.md";

interface ContentItem {
  text: string;
  sourceFiles: string[];
}

interface ExtractedContent {
  summaries: ContentItem[];
  careerHighlights: ContentItem[];
  positionOverviews: { [key: string]: ContentItem[] };
  positionBullets: { [key: string]: ContentItem[] };
}

// Position markers to identify sections
const POSITION_MARKERS = [
  { pattern: /Deloitte\s*Digital/i, position: "Position 1 - Deloitte" },
  { pattern: /NWSL|National Women.*Soccer/i, position: "Position 2 - NWSL" },
  { pattern: /DEUTSCH|DeutschLA/i, position: "Position 3 - Deutsch" },
  { pattern: /PEPSICO|PepsiCo|Pepsi/i, position: "Position 4 - PepsiCo" },
  { pattern: /USTA|U\.S\. Tennis/i, position: "Position 5 - USTA" },
  { pattern: /WIMM-BILL-DANN|Wimm|WBD/i, position: "Position 6 - WimmBillDann" },
  { pattern: /Omnicom|OMD/i, position: "Position - Omnicom/OMD" },
  { pattern: /Berlin Cameron/i, position: "Position - Berlin Cameron" },
  { pattern: /Straightline/i, position: "Position - Straightline" },
];

// Section markers
const SECTION_MARKERS = [
  "CAREER HIGHLIGHTS",
  "PROFESSIONAL EXPERIENCE",
  "EXPERIENCE",
  "EDUCATION",
  "SKILLS",
];

function similarity(s1: string, s2: string, useNgramSimilarity = false): number {
  if (s1 === s2) return 1;
  const str1 = s1.toLowerCase().substring(0, 500);
  const str2 = s2.toLowerCase().substring(0, 500);
  if (str1 === str2) return 1;

  if (useNgramSimilarity) {
    // Use 3-gram similarity for more precise matching
    const getNgrams = (s: string, n: number) => {
      const ngrams = new Set<string>();
      for (let i = 0; i <= s.length - n; i++) {
        ngrams.add(s.substring(i, i + n));
      }
      return ngrams;
    };
    const ngrams1 = getNgrams(str1, 3);
    const ngrams2 = getNgrams(str2, 3);
    const intersection = [...ngrams1].filter(ng => ngrams2.has(ng)).length;
    const union = new Set([...ngrams1, ...ngrams2]).size;
    return union > 0 ? intersection / union : 0;
  }

  // Word-based Jaccard similarity
  const words1 = new Set(str1.split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(str2.split(/\s+/).filter(w => w.length > 3));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;

  return intersection / union;
}

async function extractTextFromDocx(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, "•")
    .trim();
}

function isAchievementLine(line: string): boolean {
  // Lines that start with action verbs or contain metrics
  const actionVerbs = /^(Led|Launched|Built|Developed|Transformed|Designed|Created|Directed|Drove|Achieved|Increased|Grew|Managed|Delivered|Partnered|Spearheaded|Overhauled|Repositioned|Secured)/i;
  const hasMetrics = /\d+%|\$\d+[MBK]?|\d+[MBK]\+?/i;

  return actionVerbs.test(line.trim()) || hasMetrics.test(line);
}

function extractContent(text: string): {
  summary: string | null;
  careerHighlights: string[];
  positions: { [key: string]: { overview: string; bullets: string[] } };
} {
  const lines = text.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);

  let summary: string | null = null;
  const careerHighlights: string[] = [];
  const positions: { [key: string]: { overview: string; bullets: string[] } } = {};

  let currentSection = "header";
  let currentPosition = "";
  let positionLineCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for section headers - must be short lines that look like headers
    const isHeader = line.length < 50 && SECTION_MARKERS.some(m => {
      const upper = line.toUpperCase();
      // Must start with the marker or be mostly the marker text
      return upper === m || upper.startsWith(m) || upper.includes(m + " ") || upper.endsWith(" " + m);
    });

    if (isHeader) {
      if (line.toUpperCase().includes("CAREER HIGHLIGHTS")) {
        currentSection = "career_highlights";
      } else if (line.toUpperCase().includes("EXPERIENCE")) {
        currentSection = "experience";
      } else if (line.toUpperCase().includes("EDUCATION")) {
        currentSection = "education";
      }
      currentPosition = "";
      positionLineCount = 0;
      continue;
    }

    // Check for position markers in experience section
    if (currentSection === "experience" || currentSection === "header") {
      for (const marker of POSITION_MARKERS) {
        if (marker.pattern.test(line)) {
          currentPosition = marker.position;
          positionLineCount = 0;
          if (!positions[currentPosition]) {
            positions[currentPosition] = { overview: "", bullets: [] };
          }
          break;
        }
      }
    }

    // Extract content based on current section
    if (currentSection === "header" && !summary) {
      // Look for summary - usually the first long paragraph
      if (line.length > 150 && !line.includes("@") && !/\d{3}.*\d{4}/.test(line)) {
        summary = cleanText(line);
        currentSection = "after_summary";
      }
    } else if (currentSection === "career_highlights") {
      // Career highlights are substantial lines between the header and experience
      if (line.length > 80 && isAchievementLine(line)) {
        careerHighlights.push(cleanText(line));
      }
    } else if (currentPosition && currentSection !== "education") {
      positionLineCount++;

      // Skip title/date lines
      if (line.length < 60 && /\d{4}/.test(line)) continue;
      if (line.length < 40) continue;

      // First substantial content line after position marker is the overview
      if (!positions[currentPosition].overview && line.length > 80) {
        positions[currentPosition].overview = cleanText(line);
      } else if (line.length > 60 && isAchievementLine(line)) {
        // Subsequent achievement lines are bullets
        positions[currentPosition].bullets.push(cleanText(line));
      }
    }
  }

  return { summary, careerHighlights, positions };
}

function addToCollection(
  collection: ContentItem[],
  text: string | null | undefined,
  sourceFile: string,
  threshold = 0.7,
  useNgramSimilarity = false
) {
  if (!text || text.length < 40) return;

  for (const item of collection) {
    const sim = similarity(item.text, text, useNgramSimilarity);
    if (sim > threshold) {
      if (!item.sourceFiles.includes(sourceFile)) {
        item.sourceFiles.push(sourceFile);
      }
      return;
    }
  }

  collection.push({ text, sourceFiles: [sourceFile] });
}

async function analyzeResumes(): Promise<void> {
  console.log("Starting resume analysis...\n");

  const files = fs.readdirSync(FOLDER_PATH).filter((f) => f.endsWith(".docx"));
  console.log(`Found ${files.length} DOCX files to analyze.\n`);

  const content: ExtractedContent = {
    summaries: [],
    careerHighlights: [],
    positionOverviews: {},
    positionBullets: {},
  };

  for (const marker of POSITION_MARKERS) {
    content.positionOverviews[marker.position] = [];
    content.positionBullets[marker.position] = [];
  }

  for (const file of files) {
    const filePath = path.join(FOLDER_PATH, file);
    console.log(`Processing: ${file}`);

    try {
      const text = await extractTextFromDocx(filePath);
      const extracted = extractContent(text);

      // Add summary - use n-gram similarity with high threshold for precise matching
      addToCollection(content.summaries, extracted.summary, file, 0.9, true);

      // Add career highlights
      for (const highlight of extracted.careerHighlights) {
        addToCollection(content.careerHighlights, highlight, file);
      }

      // Add position content
      for (const [position, posContent] of Object.entries(extracted.positions)) {
        if (!content.positionOverviews[position]) {
          content.positionOverviews[position] = [];
          content.positionBullets[position] = [];
        }

        addToCollection(content.positionOverviews[position], posContent.overview, file);

        for (const bullet of posContent.bullets) {
          addToCollection(content.positionBullets[position], bullet, file);
        }
      }
    } catch (error) {
      console.error(`Error processing ${file}:`, (error as Error).message);
    }
  }

  console.log("\nGenerating report...");
  generateReport(content, files.length);
}

function generateReport(content: ExtractedContent, totalResumes: number): void {
  let report = `# Resume Content Analysis Report

**Generated:** ${new Date().toISOString()}
**Total Resumes Processed:** ${totalResumes}

---

## Summary Statistics

| Section | Unique Items |
|---------|-------------|
| Summaries | ${content.summaries.length} |
| Career Highlights | ${content.careerHighlights.length} |
`;

  let totalOverviews = 0;
  let totalBullets = 0;

  // Sort positions for consistent output
  const positions = Object.keys(content.positionOverviews).sort();

  for (const position of positions) {
    const overviewCount = content.positionOverviews[position]?.length || 0;
    const bulletCount = content.positionBullets[position]?.length || 0;
    if (overviewCount > 0 || bulletCount > 0) {
      totalOverviews += overviewCount;
      totalBullets += bulletCount;
      report += `| ${position} Overviews | ${overviewCount} |\n`;
      report += `| ${position} Bullets | ${bulletCount} |\n`;
    }
  }

  const totalUnique = content.summaries.length + content.careerHighlights.length + totalOverviews + totalBullets;
  report += `| **Total Unique Content Pieces** | **${totalUnique}** |\n`;

  // Summaries section
  report += `
---

## Summaries (${content.summaries.length} unique)

`;

  for (let i = 0; i < content.summaries.length; i++) {
    const item = content.summaries[i];
    report += `### Summary ${i + 1}

**Source Files (${item.sourceFiles.length}):** ${item.sourceFiles.join(", ")}

${item.text}

---

`;
  }

  // Career Highlights section
  if (content.careerHighlights.length > 0) {
    report += `## Career Highlights (${content.careerHighlights.length} unique)

`;

    for (let i = 0; i < content.careerHighlights.length; i++) {
      const item = content.careerHighlights[i];
      report += `### Career Highlight ${i + 1}

**Source Files (${item.sourceFiles.length}):** ${item.sourceFiles.join(", ")}

• ${item.text}

---

`;
    }
  }

  // Position Overviews
  for (const position of positions) {
    const overviews = content.positionOverviews[position];
    if (!overviews || overviews.length === 0) continue;

    report += `## ${position} - Overviews (${overviews.length} unique)

`;

    for (let i = 0; i < overviews.length; i++) {
      const item = overviews[i];
      report += `### Overview ${i + 1}

**Source Files (${item.sourceFiles.length}):** ${item.sourceFiles.join(", ")}

${item.text}

---

`;
    }
  }

  // Position Bullets
  for (const position of positions) {
    const bullets = content.positionBullets[position];
    if (!bullets || bullets.length === 0) continue;

    report += `## ${position} - Bullets (${bullets.length} unique)

`;

    for (let i = 0; i < bullets.length; i++) {
      const item = bullets[i];
      report += `### Bullet ${i + 1}

**Source Files (${item.sourceFiles.length}):** ${item.sourceFiles.join(", ")}

• ${item.text}

---

`;
    }
  }

  // Write report
  fs.writeFileSync(OUTPUT_PATH, report);
  console.log(`\n✅ Report saved to: ${OUTPUT_PATH}`);
  console.log(`\n📊 Summary:`);
  console.log(`   - Total resumes: ${totalResumes}`);
  console.log(`   - Unique summaries: ${content.summaries.length}`);
  console.log(`   - Unique career highlights: ${content.careerHighlights.length}`);
  console.log(`   - Unique overviews: ${totalOverviews}`);
  console.log(`   - Unique bullets: ${totalBullets}`);
  console.log(`   - Total unique pieces: ${totalUnique}`);
}

analyzeResumes().catch(console.error);
