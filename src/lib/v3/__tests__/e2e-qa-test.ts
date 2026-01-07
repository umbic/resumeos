/**
 * E2E QA Test for V3 Pipeline
 * Run with: npx tsx src/lib/v3/__tests__/e2e-qa-test.ts
 */

// Load environment variables BEFORE any other imports
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

// Verify API key is loaded
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY not found in environment');
  console.error(`Checked: ${envPath}`);
  process.exit(1);
}

console.log('✓ Environment loaded, API key present');

// Now import the rest (dynamically to ensure env is loaded first)
async function main() {
  const { generateResumeV3, generateResumeDocx } = await import('../index');
  const { ResumeV3, V3Diagnostics } = await import('../types') as { ResumeV3: unknown; V3Diagnostics: unknown };

  // Citi Digital Strategy JD (extracted from RTF)
  const JOB_DESCRIPTION = `
Job Title: Head of Digital Strategy & Execution, Wealth Marketing, Director
Company: Citi Wealth

Job Overview
We are seeking a digitally fluent, strategically minded leader to serve as Global Head of Digital Strategy & Execution for Citi Wealth. This individual will define and lead the future of how Citi Wealth shows up across all digital channels — from .com to advisor platforms, social media to email automation — ensuring a seamless, impactful, and differentiated digital experience for both clients and advisors across the full wealth continuum.

As Citi builds new digital platforms for both clients and advisors, this role will embed digital marketing strategy from the ground up — integrating performance marketing, martech, content, analytics, UX, and global execution. This leader will ensure all touchpoints reflect a consistent brand voice, drive measurable engagement, and are governed with operational rigor. They will also play a critical role in shaping the digital infrastructure, processes, and capabilities required for scalable execution across regions and segments.

This is a high-impact, high-visibility role that requires both strategic vision and hands-on leadership. The ideal candidate brings a unique blend of digital thought leadership, marketing operations savvy, and the ability to unify global teams under a common digital roadmap. Success in this role will cement digital as a core engine of client growth, brand building, and advisor enablement across Citi Wealth.

Responsibilities:
Develop and lead Citi Wealth's global digital marketing strategy, spanning client and advisor-facing platforms across the full wealth continuum (Citigold, CPC, Citi Private Bank, and Wealth at Work).
Define and operationalize a global digital roadmap across .com, intranet, social, email, content management, and advisor platforms.
Build digital governance models to ensure brand consistency, regulatory compliance, and strategic alignment across business units and markets.
Oversee the implementation and optimization of digital marketing platforms and tools — including CMS, marketing automation, personalization, and analytics.
Partner with product, design, and engineering teams to improve UX and UI across digital journeys — ensuring our platforms reflect our brand and client promise.
Lead digital performance measurement and reporting frameworks to track KPIs, optimize campaigns, and inform executive decision-making.
Drive the integration of digital marketing into global campaign planning and execution — ensuring cross-channel alignment and activation.
Serve as a thought partner to regional marketing leads, helping elevate digital maturity and capability across the global organization.
Build and manage a small team of digital specialists; oversee agency partners and digital vendors as needed.
Represent digital marketing at the highest levels — including senior leadership, compliance, risk, and product partners.
Appropriately assess risk when business decisions are made, demonstrating particular consideration for the firm's reputation and safeguarding Citigroup, its clients and assets, by driving compliance with applicable laws, rules and regulations, adhering to Policy, applying sound ethical judgment regarding personal behavior, conduct and business practices, and escalating, managing and reporting control issues with transparency, as well as effectively supervise the activity of others and create accountability with those who fail to maintain these standards.

Qualifications:
15+ years of experience
Experience leading digital marketing strategy, execution, and operations within a large, global, matrixed organization — ideally in financial services or a digitally advanced industry.
Experience developing and executing marketing strategies
Proven track record of leading complex digital transformation projects and embedding digital within enterprise marketing functions.
Experience managing multi-platform ecosystems (.com, intranet, social, email, CMS, martech).
Strong understanding of UX/UI, content strategy, personalization, and web performance metrics.
Hands-on experience with enterprise marketing platforms and tools (e.g., Adobe, Salesforce Marketing Cloud, Google Analytics).
Demonstrated ability to influence senior stakeholders, drive cross-functional alignment, and lead through ambiguity.

Education:
Bachelor's/University degree, Master's degree preferred

Key Competencies:
Digitally fluent with strategic vision and operational precision.
Confident leader who can drive transformation and bring teams along the journey.
Excellent communicator and cross-functional collaborator.
Performance-driven and highly analytical.
Comfortable working across time zones, cultures, and hierarchies.
Curious, future-focused, and constantly scanning for innovation.
`;

  const FORBIDDEN_WORDS = ['leveraged', 'utilized', 'spearheaded', 'synergy', 'passionate'];
  const OUTPUTS_DIR = path.join(process.cwd(), 'outputs');

  interface ValidationResult {
    passed: boolean;
    errors: string[];
    warnings: string[];
  }

  // Ensure outputs directory exists
  function ensureOutputsDir() {
    if (!fs.existsSync(OUTPUTS_DIR)) {
      fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
    }
  }

  // Count words in a string
  function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  // Extract starting verb from content
  // Handles Career Highlights format: "**Headline**: Content starts here..."
  function extractStartingVerb(content: string): string {
    let text = content.trim();

    // If content starts with "**Headline**: ", extract the verb after the colon
    if (text.startsWith('**') && text.includes(':')) {
      const colonIdx = text.indexOf(':');
      text = text.substring(colonIdx + 1).trim();
    }

    // Strip any remaining markdown formatting
    text = text.replace(/\*\*/g, '');

    const firstWord = text.split(/\s+/)[0];
    return firstWord.toLowerCase().replace(/[.,;:!?]$/, '');
  }

  // Count words, excluding the headline portion for CH
  function countContentWords(content: string, includeHeadline: boolean = true): number {
    let text = content.trim();

    // If we should exclude the headline and content has "**Headline**: " format
    if (!includeHeadline && text.startsWith('**') && text.includes(':')) {
      const colonIdx = text.indexOf(':');
      text = text.substring(colonIdx + 1).trim();
    }

    // Strip markdown
    text = text.replace(/\*\*/g, '');

    return text.split(/\s+/).filter(w => w.length > 0).length;
  }

  // Validate Summary
  function validateSummary(summary: string, jdPhrases: string[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const wordCount = countWords(summary);

    if (wordCount < 140) {
      errors.push(`Summary too short: ${wordCount} words (need 140-160)`);
    }
    if (wordCount > 160) {
      errors.push(`Summary too long: ${wordCount} words (need 140-160)`);
    }

    for (const word of FORBIDDEN_WORDS) {
      if (summary.toLowerCase().includes(word)) {
        errors.push(`Summary contains forbidden word: "${word}"`);
      }
    }

    if (summary.includes('—') || summary.includes('–')) {
      errors.push('Summary contains emdash character');
    }

    // Check for JD phrases (relaxed - just check if at least 3 keywords appear)
    const lowerSummary = summary.toLowerCase();
    const keywordsFound = jdPhrases.filter(phrase =>
      lowerSummary.includes(phrase.toLowerCase())
    );

    if (keywordsFound.length < 3) {
      warnings.push(`Only ${keywordsFound.length} JD phrases found in summary (want at least 3)`);
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings
    };
  }

  // Validate Career Highlights
  function validateCareerHighlights(
    highlights: { headline: string; content: string; sourceId: string }[],
    priorVerbs: string[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (highlights.length !== 5) {
      errors.push(`Expected 5 career highlights, got ${highlights.length}`);
    }

    const verbs: string[] = [];
    const baseIds: string[] = [];

    for (let i = 0; i < highlights.length; i++) {
      const ch = highlights[i];
      // Count words excluding the headline portion
      const wordCount = countContentWords(ch.content, false);

      if (wordCount < 35) {
        errors.push(`CH[${i}] too short: ${wordCount} words (need 35-50)`);
      }
      if (wordCount > 50) {
        errors.push(`CH[${i}] too long: ${wordCount} words (need 35-50)`);
      }

      if (!ch.headline || ch.headline.length < 5) {
        errors.push(`CH[${i}] missing or invalid headline`);
      }

      // Extract and track starting verb from content
      const verb = extractStartingVerb(ch.content);
      if (verbs.includes(verb)) {
        errors.push(`CH[${i}] duplicate starting verb: "${verb}"`);
      }
      verbs.push(verb);

      // Check for duplicate baseIds
      if (baseIds.includes(ch.sourceId)) {
        errors.push(`CH[${i}] duplicate sourceId: "${ch.sourceId}"`);
      }
      baseIds.push(ch.sourceId);
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings
    };
  }

  // Validate P1 Bullets
  function validateP1Bullets(
    position: { bullets?: string[] },
    priorVerbs: string[],
    priorMetrics: string[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!position.bullets || position.bullets.length !== 4) {
      errors.push(`P1 should have exactly 4 bullets, got ${position.bullets?.length || 0}`);
      return { passed: false, errors, warnings };
    }

    const verbs: string[] = [];

    for (let i = 0; i < position.bullets.length; i++) {
      const bullet = position.bullets[i];
      const wordCount = countWords(bullet);

      if (wordCount < 25) {
        errors.push(`P1 bullet[${i}] too short: ${wordCount} words (need 25-40)`);
      }
      if (wordCount > 40) {
        errors.push(`P1 bullet[${i}] too long: ${wordCount} words (need 25-40)`);
      }

      const verb = extractStartingVerb(bullet);
      if (verbs.includes(verb)) {
        errors.push(`P1 bullet[${i}] duplicate starting verb within P1: "${verb}"`);
      }
      if (priorVerbs.includes(verb)) {
        warnings.push(`P1 bullet[${i}] verb "${verb}" also used in prior section`);
      }
      verbs.push(verb);
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings
    };
  }

  // Validate P2 Bullets
  function validateP2Bullets(
    position: { bullets?: string[] },
    priorVerbs: string[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!position.bullets || position.bullets.length !== 3) {
      errors.push(`P2 should have exactly 3 bullets, got ${position.bullets?.length || 0}`);
      return { passed: false, errors, warnings };
    }

    const verbs: string[] = [];

    for (let i = 0; i < position.bullets.length; i++) {
      const bullet = position.bullets[i];
      const wordCount = countWords(bullet);

      if (wordCount < 25) {
        errors.push(`P2 bullet[${i}] too short: ${wordCount} words (need 25-40)`);
      }
      if (wordCount > 40) {
        errors.push(`P2 bullet[${i}] too long: ${wordCount} words (need 25-40)`);
      }

      const verb = extractStartingVerb(bullet);
      if (verbs.includes(verb)) {
        errors.push(`P2 bullet[${i}] duplicate starting verb within P2: "${verb}"`);
      }
      if (priorVerbs.includes(verb)) {
        warnings.push(`P2 bullet[${i}] verb "${verb}" also used in prior section`);
      }
      verbs.push(verb);
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings
    };
  }

  // Validate P3-P6 Overviews
  function validateP3P6(
    positions: { overview: string; bullets?: string[] }[],
    priorVerbs: string[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const p3p6 = positions.slice(2); // positions 3-6

    if (p3p6.length !== 4) {
      errors.push(`Expected 4 positions for P3-P6, got ${p3p6.length}`);
    }

    const verbs: string[] = [];

    for (let i = 0; i < p3p6.length; i++) {
      const pos = p3p6[i];
      const wordCount = countWords(pos.overview);

      if (wordCount < 20) {
        errors.push(`P${i+3} overview too short: ${wordCount} words (need 20-40)`);
      }
      if (wordCount > 40) {
        errors.push(`P${i+3} overview too long: ${wordCount} words (need 20-40)`);
      }

      const verb = extractStartingVerb(pos.overview);
      if (verbs.includes(verb)) {
        errors.push(`P${i+3} duplicate starting verb within P3-P6: "${verb}"`);
      }
      if (priorVerbs.includes(verb)) {
        warnings.push(`P${i+3} verb "${verb}" also used in prior section`);
      }
      verbs.push(verb);

      // Check that P3-P6 have no bullets
      if (pos.bullets && pos.bullets.length > 0) {
        errors.push(`P${i+3} should not have bullets, but has ${pos.bullets.length}`);
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings
    };
  }

  // Validate Diagnostics
  function validateDiagnostics(diagnostics: {
    sessionId: string;
    totalCost: number;
    totalDurationMs: number;
    steps: { step: string; status: string }[];
    errors: { error: string }[];
  }): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const expectedSteps = ['jd-analyzer', 'summary', 'ch', 'p1', 'p2', 'p3p6'];
    const foundSteps = diagnostics.steps.map(s => s.step);

    for (const step of expectedSteps) {
      if (!foundSteps.includes(step)) {
        errors.push(`Missing step in diagnostics: ${step}`);
      }
    }

    for (const step of diagnostics.steps) {
      // 'retry' status is acceptable - it means the step eventually succeeded after retries
      if (step.status !== 'success' && step.status !== 'retry') {
        errors.push(`Step ${step.step} has status: ${step.status}`);
      }
    }

    if (!diagnostics.totalCost || diagnostics.totalCost === 0) {
      warnings.push('totalCost is zero or missing');
    }

    if (!diagnostics.totalDurationMs || diagnostics.totalDurationMs === 0) {
      warnings.push('totalDurationMs is zero or missing');
    }

    if (!diagnostics.sessionId) {
      errors.push('sessionId is missing');
    }

    if (diagnostics.errors.length > 0) {
      for (const err of diagnostics.errors) {
        errors.push(`Diagnostic error: ${err.error}`);
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings
    };
  }

  console.log('='.repeat(60));
  console.log('V3 E2E QA TEST');
  console.log('='.repeat(60));
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('');

  ensureOutputsDir();

  // Phase 1: Run Pipeline
  console.log('PHASE 1: Running V3 Pipeline...');
  console.log('-'.repeat(40));

  const startTime = Date.now();
  const result = await generateResumeV3(JOB_DESCRIPTION.trim());
  const duration = Date.now() - startTime;

  console.log(`Pipeline completed in ${(duration / 1000).toFixed(1)}s`);
  console.log(`Success: ${result.success}`);

  if (!result.success) {
    console.error('❌ Pipeline FAILED');
    console.error('Error:', result.error);
    console.error('Diagnostics:', JSON.stringify(result.diagnostics, null, 2));
    process.exit(1);
  }

  console.log('✅ Pipeline completed successfully');
  console.log('');

  const resume = result.resume!;
  const diagnostics = result.diagnostics;

  // Phase 2: Export Files
  console.log('PHASE 2: Exporting Files...');
  console.log('-'.repeat(40));

  // Save resume JSON
  const resumePath = path.join(OUTPUTS_DIR, 'qa-test-resume.json');
  fs.writeFileSync(resumePath, JSON.stringify(resume, null, 2));
  console.log(`✅ Resume JSON saved: ${resumePath}`);

  // Save diagnostics JSON
  const diagPath = path.join(OUTPUTS_DIR, 'qa-test-diagnostics.json');
  fs.writeFileSync(diagPath, JSON.stringify(diagnostics, null, 2));
  console.log(`✅ Diagnostics saved: ${diagPath}`);

  // Generate and save DOCX
  try {
    const docxBuffer = await generateResumeDocx(resume);
    const docxPath = path.join(OUTPUTS_DIR, 'qa-test-resume.docx');
    fs.writeFileSync(docxPath, docxBuffer);
    console.log(`✅ DOCX saved: ${docxPath}`);
  } catch (error) {
    console.error('❌ DOCX generation failed:', error);
    process.exit(1);
  }
  console.log('');

  // Phase 3: Validate Resume Content
  console.log('PHASE 3: Validating Resume Content...');
  console.log('-'.repeat(40));

  let allValid = true;
  const collectedVerbs: string[] = [];
  const collectedMetrics: string[] = [];

  // Extract JD phrases for summary validation
  const jdPhrases = [
    'digital strategy', 'digital marketing', 'wealth', 'global',
    'digital transformation', 'performance marketing', 'martech',
    'brand', 'UX', 'analytics', 'platforms', 'execution'
  ];

  // Summary validation
  console.log('\n📝 Summary:');
  const summaryResult = validateSummary(resume.summary, jdPhrases);
  if (summaryResult.passed) {
    console.log(`  ✅ Word count: ${countWords(resume.summary)}`);
  }
  for (const err of summaryResult.errors) console.log(`  ❌ ${err}`);
  for (const warn of summaryResult.warnings) console.log(`  ⚠️  ${warn}`);
  if (!summaryResult.passed) allValid = false;

  // Career Highlights validation
  console.log('\n🏆 Career Highlights:');
  const chResult = validateCareerHighlights(resume.careerHighlights, collectedVerbs);
  if (chResult.passed) {
    console.log(`  ✅ Count: ${resume.careerHighlights.length} highlights`);
  }
  for (const err of chResult.errors) console.log(`  ❌ ${err}`);
  for (const warn of chResult.warnings) console.log(`  ⚠️  ${warn}`);
  if (!chResult.passed) allValid = false;

  // Collect CH verbs for downstream validation
  for (const ch of resume.careerHighlights) {
    collectedVerbs.push(extractStartingVerb(ch.content));
  }

  // P1 validation
  console.log('\n💼 Position 1:');
  const p1 = resume.positions[0];
  const p1Result = validateP1Bullets(p1, collectedVerbs, collectedMetrics);
  if (p1Result.passed) {
    console.log(`  ✅ Bullets: ${p1.bullets?.length || 0}`);
  }
  for (const err of p1Result.errors) console.log(`  ❌ ${err}`);
  for (const warn of p1Result.warnings) console.log(`  ⚠️  ${warn}`);
  if (!p1Result.passed) allValid = false;

  // Collect P1 verbs
  if (p1.bullets) {
    for (const bullet of p1.bullets) {
      collectedVerbs.push(extractStartingVerb(bullet));
    }
  }

  // P2 validation
  console.log('\n💼 Position 2:');
  const p2 = resume.positions[1];
  const p2Result = validateP2Bullets(p2, collectedVerbs);
  if (p2Result.passed) {
    console.log(`  ✅ Bullets: ${p2.bullets?.length || 0}`);
  }
  for (const err of p2Result.errors) console.log(`  ❌ ${err}`);
  for (const warn of p2Result.warnings) console.log(`  ⚠️  ${warn}`);
  if (!p2Result.passed) allValid = false;

  // Collect P2 verbs
  if (p2.bullets) {
    for (const bullet of p2.bullets) {
      collectedVerbs.push(extractStartingVerb(bullet));
    }
  }

  // P3-P6 validation
  console.log('\n📋 Positions 3-6:');
  const p3p6Result = validateP3P6(resume.positions, collectedVerbs);
  if (p3p6Result.passed) {
    console.log(`  ✅ All 4 overviews valid`);
  }
  for (const err of p3p6Result.errors) console.log(`  ❌ ${err}`);
  for (const warn of p3p6Result.warnings) console.log(`  ⚠️  ${warn}`);
  if (!p3p6Result.passed) allValid = false;

  console.log('');

  // Phase 4: Validate Diagnostics
  console.log('PHASE 4: Validating Diagnostics...');
  console.log('-'.repeat(40));

  const diagResult = validateDiagnostics(diagnostics);
  if (diagResult.passed) {
    console.log(`  ✅ All 6 steps present and successful`);
    console.log(`  ✅ Total cost: $${diagnostics.totalCost.toFixed(4)}`);
    console.log(`  ✅ Total duration: ${(diagnostics.totalDurationMs / 1000).toFixed(1)}s`);
    console.log(`  ✅ Session ID: ${diagnostics.sessionId}`);
  }
  for (const err of diagResult.errors) console.log(`  ❌ ${err}`);
  for (const warn of diagResult.warnings) console.log(`  ⚠️  ${warn}`);
  if (!diagResult.passed) allValid = false;

  console.log('');

  // Phase 5: DOCX Validation Summary
  console.log('PHASE 5: DOCX Validation...');
  console.log('-'.repeat(40));
  console.log('  ℹ️  DOCX file generated - manual inspection needed');
  console.log(`  📄 File: ${path.join(OUTPUTS_DIR, 'qa-test-resume.docx')}`);
  console.log('');

  // Final Summary
  console.log('='.repeat(60));
  console.log('FINAL RESULTS');
  console.log('='.repeat(60));

  if (allValid) {
    console.log('✅ ALL VALIDATIONS PASSED');
  } else {
    console.log('❌ SOME VALIDATIONS FAILED');
    console.log('Review errors above and fix the code');
    process.exit(1);
  }

  console.log('');
  console.log(`Completed: ${new Date().toISOString()}`);
  console.log('');
}

// Run the test
main().catch((error) => {
  console.error('❌ FATAL ERROR:', error);
  process.exit(1);
});
