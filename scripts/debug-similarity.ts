// Test similarity between two sample summaries

const s1 = "Umberto is a seasoned Marketing Executive with over 12 years of experience in developing and executing strategic marketing initiatives that drive brand transformation and deliver bottom-line growth.";

const s2 = "Umberto Castaldo is a seasoned Marketing Executive with over 15 years of experience transforming brands and driving business growth for Fortune 10 companies and high-growth organizations.";

const s3 = "Umberto is a visionary marketing leader with over 15 years of experience in developing and executing data-driven brand strategies that drive brand awareness, equity, and sales performance.";

function similarity(s1: string, s2: string, useNgramSimilarity = false): number {
  if (s1 === s2) return 1;
  const str1 = s1.toLowerCase().substring(0, 500);
  const str2 = s2.toLowerCase().substring(0, 500);
  if (str1 === str2) return 1;

  if (useNgramSimilarity) {
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

  const words1 = new Set(str1.split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(str2.split(/\s+/).filter(w => w.length > 3));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;

  return intersection / union;
}

console.log("Word-based similarity:");
console.log(`s1 vs s2: ${similarity(s1, s2, false).toFixed(3)}`);
console.log(`s1 vs s3: ${similarity(s1, s3, false).toFixed(3)}`);
console.log(`s2 vs s3: ${similarity(s2, s3, false).toFixed(3)}`);

console.log("\nN-gram similarity:");
console.log(`s1 vs s2: ${similarity(s1, s2, true).toFixed(3)}`);
console.log(`s1 vs s3: ${similarity(s1, s3, true).toFixed(3)}`);
console.log(`s2 vs s3: ${similarity(s2, s3, true).toFixed(3)}`);
