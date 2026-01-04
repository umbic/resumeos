import type { GeneratedResume, QualityIssue } from '@/types';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

/**
 * Auto-fix critical quality issues in a generated resume.
 * Currently handles:
 * - Bullet length violations (>40 words)
 */
export async function autoFixIssues(
  resume: GeneratedResume,
  issues: QualityIssue[]
): Promise<{ resume: GeneratedResume; fixedIssues: QualityIssue[] }> {
  const fixedResume = { ...resume };
  const fixedIssues: QualityIssue[] = [];

  // Group issues by location for batch fixing
  const bulletLengthIssues = issues.filter(
    i => i.type === 'bullet_length' && i.severity === 'error'
  );

  // Fix overlong bullets
  for (const issue of bulletLengthIssues) {
    const match = issue.location.match(/position_(\d+)_bullet_(\d+)/);
    if (match) {
      const posNum = parseInt(match[1]);
      const bulletNum = parseInt(match[2]);

      const position = fixedResume.positions.find(p => p.number === posNum);
      if (position?.bullets) {
        const originalBullet = position.bullets[bulletNum - 1];
        if (originalBullet) {
          const fixedBullet = await shortenBullet(originalBullet);

          fixedResume.positions = fixedResume.positions.map(p => {
            if (p.number !== posNum) return p;
            return {
              ...p,
              bullets: p.bullets?.map((b, i) =>
                i === bulletNum - 1 ? fixedBullet : b
              ),
            };
          });

          fixedIssues.push({ ...issue, autoFixed: true });
        }
      }
    }
  }

  return { resume: fixedResume, fixedIssues };
}

/**
 * Use Claude to shorten a bullet to 40 words or less while preserving metrics.
 */
async function shortenBullet(bullet: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Shorten this resume bullet to 40 words or less while preserving all metrics and key facts:

"${bullet}"

Rules:
- Keep all numbers and metrics exactly
- Keep the action verb at the start
- Cut filler words and phrases
- Combine ideas efficiently
- One sentence maximum

Return ONLY the shortened bullet, nothing else.`,
    }],
  });

  return response.content[0].type === 'text'
    ? response.content[0].text.trim()
    : bullet;
}
