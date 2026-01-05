import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export interface CompanyIndustryInfo {
  company: string;
  industries: string[];
  industryCategory: string;
  isB2B: boolean;
  isB2C: boolean;
  competitors: string[];
  confidence: 'high' | 'medium' | 'low';
  source: string;
}

/**
 * Look up a company's industry using web search
 */
export async function lookupCompanyIndustry(
  companyName: string
): Promise<CompanyIndustryInfo> {

  if (!companyName || companyName.trim() === '') {
    return {
      company: '',
      industries: [],
      industryCategory: 'unknown',
      isB2B: false,
      isB2C: false,
      competitors: [],
      confidence: 'low',
      source: 'none',
    };
  }

  // First check known companies (no API call needed)
  const knownResult = inferFromKnownCompanies(companyName);
  if (knownResult.confidence === 'high') {
    console.log(`[company-lookup] Found ${companyName} in known companies database`);
    return knownResult;
  }

  // For unknown companies, use Claude with web search
  try {
    console.log(`[company-lookup] Searching web for: ${companyName}`);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Search for "${companyName}" and determine what industry they operate in.

I need you to:
1. Search for the company
2. Identify their primary industry/sector
3. Determine if they're B2B, B2C, or both
4. List 2-3 major competitors

Return your findings as JSON:
{
  "company": "Company Name",
  "industries": ["tag1", "tag2"],
  "industryCategory": "Primary category like 'Enterprise Software' or 'Financial Services'",
  "isB2B": true/false,
  "isB2C": true/false,
  "competitors": ["Competitor 1", "Competitor 2"],
  "confidence": "high/medium/low",
  "source": "Brief description of source"
}

For the industries array, use these exact tags when applicable:
- technology, enterprise-software, SaaS, fintech
- financial-services, banking, payments
- healthcare, pharma
- consumer, retail, CPG, DTC
- professional-services, consulting
- media, entertainment
- e-commerce
- B2B, B2C

Only return the JSON, no other text.`,
        },
      ],
    });

    // Extract the text response (after tool use)
    let resultText = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        resultText = block.text;
      }
    }

    // Clean up the response and parse JSON
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`[company-lookup] Web search found: ${parsed.industryCategory}`);
      return {
        company: parsed.company || companyName,
        industries: parsed.industries || [],
        industryCategory: parsed.industryCategory || 'unknown',
        isB2B: parsed.isB2B ?? false,
        isB2C: parsed.isB2C ?? false,
        competitors: parsed.competitors || [],
        confidence: parsed.confidence || 'medium',
        source: parsed.source || 'web search',
      };
    }
  } catch (error) {
    console.error('[company-lookup] Web search failed:', error);
  }

  // Fallback to known companies database
  return knownResult;
}

/**
 * Fallback: Infer industry from well-known company names
 */
function inferFromKnownCompanies(companyName: string): CompanyIndustryInfo {
  const name = companyName.toLowerCase();

  const knownCompanies: Record<string, Partial<CompanyIndustryInfo>> = {
    'salesforce': {
      industries: ['technology', 'enterprise-software', 'SaaS', 'B2B'],
      industryCategory: 'Enterprise Software',
      isB2B: true,
      isB2C: false,
      competitors: ['Microsoft', 'Oracle', 'SAP'],
    },
    'microsoft': {
      industries: ['technology', 'enterprise-software', 'SaaS', 'B2B', 'consumer'],
      industryCategory: 'Technology',
      isB2B: true,
      isB2C: true,
      competitors: ['Google', 'Apple', 'Salesforce'],
    },
    'google': {
      industries: ['technology', 'advertising', 'SaaS', 'B2B', 'consumer'],
      industryCategory: 'Technology',
      isB2B: true,
      isB2C: true,
      competitors: ['Microsoft', 'Apple', 'Meta'],
    },
    'alphabet': {
      industries: ['technology', 'advertising', 'SaaS', 'B2B', 'consumer'],
      industryCategory: 'Technology',
      isB2B: true,
      isB2C: true,
      competitors: ['Microsoft', 'Apple', 'Meta'],
    },
    'meta': {
      industries: ['technology', 'social-media', 'advertising', 'consumer'],
      industryCategory: 'Social Media / Technology',
      isB2B: true,
      isB2C: true,
      competitors: ['Google', 'TikTok', 'Snap'],
    },
    'facebook': {
      industries: ['technology', 'social-media', 'advertising', 'consumer'],
      industryCategory: 'Social Media / Technology',
      isB2B: true,
      isB2C: true,
      competitors: ['Google', 'TikTok', 'Snap'],
    },
    'amazon': {
      industries: ['technology', 'e-commerce', 'retail', 'B2B', 'consumer'],
      industryCategory: 'E-commerce / Cloud',
      isB2B: true,
      isB2C: true,
      competitors: ['Walmart', 'Microsoft', 'Google'],
    },
    'aws': {
      industries: ['technology', 'cloud', 'enterprise-software', 'B2B'],
      industryCategory: 'Cloud Computing',
      isB2B: true,
      isB2C: false,
      competitors: ['Microsoft Azure', 'Google Cloud', 'Oracle'],
    },
    'apple': {
      industries: ['technology', 'consumer', 'hardware', 'software'],
      industryCategory: 'Consumer Technology',
      isB2B: false,
      isB2C: true,
      competitors: ['Samsung', 'Google', 'Microsoft'],
    },
    'goldman sachs': {
      industries: ['financial-services', 'banking', 'B2B'],
      industryCategory: 'Investment Banking',
      isB2B: true,
      isB2C: false,
      competitors: ['Morgan Stanley', 'JPMorgan', 'Citi'],
    },
    'jpmorgan': {
      industries: ['financial-services', 'banking', 'B2B', 'consumer'],
      industryCategory: 'Banking',
      isB2B: true,
      isB2C: true,
      competitors: ['Goldman Sachs', 'Bank of America', 'Citi'],
    },
    'jp morgan': {
      industries: ['financial-services', 'banking', 'B2B', 'consumer'],
      industryCategory: 'Banking',
      isB2B: true,
      isB2C: true,
      competitors: ['Goldman Sachs', 'Bank of America', 'Citi'],
    },
    'chase': {
      industries: ['financial-services', 'banking', 'consumer'],
      industryCategory: 'Consumer Banking',
      isB2B: false,
      isB2C: true,
      competitors: ['Bank of America', 'Wells Fargo', 'Citi'],
    },
    'mastercard': {
      industries: ['financial-services', 'payments', 'fintech', 'B2B'],
      industryCategory: 'Payments / Financial Services',
      isB2B: true,
      isB2C: false,
      competitors: ['Visa', 'American Express', 'PayPal'],
    },
    'visa': {
      industries: ['financial-services', 'payments', 'fintech', 'B2B'],
      industryCategory: 'Payments / Financial Services',
      isB2B: true,
      isB2C: false,
      competitors: ['Mastercard', 'American Express', 'PayPal'],
    },
    'paypal': {
      industries: ['financial-services', 'payments', 'fintech', 'B2B', 'consumer'],
      industryCategory: 'Digital Payments',
      isB2B: true,
      isB2C: true,
      competitors: ['Stripe', 'Square', 'Visa'],
    },
    'stripe': {
      industries: ['financial-services', 'payments', 'fintech', 'B2B'],
      industryCategory: 'Payments Infrastructure',
      isB2B: true,
      isB2C: false,
      competitors: ['PayPal', 'Adyen', 'Square'],
    },
    'square': {
      industries: ['financial-services', 'payments', 'fintech', 'B2B'],
      industryCategory: 'Payments / Point of Sale',
      isB2B: true,
      isB2C: false,
      competitors: ['PayPal', 'Stripe', 'Clover'],
    },
    'block': {
      industries: ['financial-services', 'payments', 'fintech', 'B2B'],
      industryCategory: 'Payments / Fintech',
      isB2B: true,
      isB2C: true,
      competitors: ['PayPal', 'Stripe', 'Coinbase'],
    },
    'deloitte': {
      industries: ['professional-services', 'consulting', 'B2B'],
      industryCategory: 'Professional Services',
      isB2B: true,
      isB2C: false,
      competitors: ['McKinsey', 'BCG', 'Accenture'],
    },
    'mckinsey': {
      industries: ['professional-services', 'consulting', 'B2B'],
      industryCategory: 'Management Consulting',
      isB2B: true,
      isB2C: false,
      competitors: ['BCG', 'Bain', 'Deloitte'],
    },
    'bcg': {
      industries: ['professional-services', 'consulting', 'B2B'],
      industryCategory: 'Management Consulting',
      isB2B: true,
      isB2C: false,
      competitors: ['McKinsey', 'Bain', 'Deloitte'],
    },
    'boston consulting': {
      industries: ['professional-services', 'consulting', 'B2B'],
      industryCategory: 'Management Consulting',
      isB2B: true,
      isB2C: false,
      competitors: ['McKinsey', 'Bain', 'Deloitte'],
    },
    'bain': {
      industries: ['professional-services', 'consulting', 'B2B'],
      industryCategory: 'Management Consulting',
      isB2B: true,
      isB2C: false,
      competitors: ['McKinsey', 'BCG', 'Deloitte'],
    },
    'accenture': {
      industries: ['professional-services', 'consulting', 'technology', 'B2B'],
      industryCategory: 'Technology Consulting',
      isB2B: true,
      isB2C: false,
      competitors: ['Deloitte', 'IBM', 'Infosys'],
    },
    'pwc': {
      industries: ['professional-services', 'consulting', 'B2B'],
      industryCategory: 'Professional Services',
      isB2B: true,
      isB2C: false,
      competitors: ['Deloitte', 'EY', 'KPMG'],
    },
    'ey': {
      industries: ['professional-services', 'consulting', 'B2B'],
      industryCategory: 'Professional Services',
      isB2B: true,
      isB2C: false,
      competitors: ['Deloitte', 'PwC', 'KPMG'],
    },
    'ernst': {
      industries: ['professional-services', 'consulting', 'B2B'],
      industryCategory: 'Professional Services',
      isB2B: true,
      isB2C: false,
      competitors: ['Deloitte', 'PwC', 'KPMG'],
    },
    'kpmg': {
      industries: ['professional-services', 'consulting', 'B2B'],
      industryCategory: 'Professional Services',
      isB2B: true,
      isB2C: false,
      competitors: ['Deloitte', 'PwC', 'EY'],
    },
    'pfizer': {
      industries: ['healthcare', 'pharma', 'B2B', 'consumer'],
      industryCategory: 'Pharmaceuticals',
      isB2B: true,
      isB2C: true,
      competitors: ['Johnson & Johnson', 'Merck', 'Novartis'],
    },
    'johnson & johnson': {
      industries: ['healthcare', 'pharma', 'consumer'],
      industryCategory: 'Healthcare / Consumer',
      isB2B: true,
      isB2C: true,
      competitors: ['Pfizer', 'P&G', 'Merck'],
    },
    'j&j': {
      industries: ['healthcare', 'pharma', 'consumer'],
      industryCategory: 'Healthcare / Consumer',
      isB2B: true,
      isB2C: true,
      competitors: ['Pfizer', 'P&G', 'Merck'],
    },
    'merck': {
      industries: ['healthcare', 'pharma', 'B2B'],
      industryCategory: 'Pharmaceuticals',
      isB2B: true,
      isB2C: false,
      competitors: ['Pfizer', 'Johnson & Johnson', 'Novartis'],
    },
    'nike': {
      industries: ['consumer', 'retail', 'apparel', 'DTC'],
      industryCategory: 'Consumer Apparel',
      isB2B: false,
      isB2C: true,
      competitors: ['Adidas', 'Under Armour', 'Puma'],
    },
    'adidas': {
      industries: ['consumer', 'retail', 'apparel', 'DTC'],
      industryCategory: 'Consumer Apparel',
      isB2B: false,
      isB2C: true,
      competitors: ['Nike', 'Under Armour', 'Puma'],
    },
    'procter & gamble': {
      industries: ['consumer', 'CPG', 'retail'],
      industryCategory: 'Consumer Packaged Goods',
      isB2B: false,
      isB2C: true,
      competitors: ['Unilever', 'Colgate-Palmolive', 'Kimberly-Clark'],
    },
    'p&g': {
      industries: ['consumer', 'CPG', 'retail'],
      industryCategory: 'Consumer Packaged Goods',
      isB2B: false,
      isB2C: true,
      competitors: ['Unilever', 'Colgate-Palmolive', 'Kimberly-Clark'],
    },
    'unilever': {
      industries: ['consumer', 'CPG', 'retail'],
      industryCategory: 'Consumer Packaged Goods',
      isB2B: false,
      isB2C: true,
      competitors: ['P&G', 'Nestle', 'Colgate-Palmolive'],
    },
    'nestle': {
      industries: ['consumer', 'CPG', 'food-beverage'],
      industryCategory: 'Consumer Packaged Goods',
      isB2B: false,
      isB2C: true,
      competitors: ['Unilever', 'P&G', 'Kraft Heinz'],
    },
    'coca-cola': {
      industries: ['consumer', 'CPG', 'food-beverage'],
      industryCategory: 'Beverages',
      isB2B: false,
      isB2C: true,
      competitors: ['PepsiCo', 'Dr Pepper', 'Nestle'],
    },
    'pepsi': {
      industries: ['consumer', 'CPG', 'food-beverage'],
      industryCategory: 'Beverages / Snacks',
      isB2B: false,
      isB2C: true,
      competitors: ['Coca-Cola', 'Nestle', 'Kraft Heinz'],
    },
    'pepsico': {
      industries: ['consumer', 'CPG', 'food-beverage'],
      industryCategory: 'Beverages / Snacks',
      isB2B: false,
      isB2C: true,
      competitors: ['Coca-Cola', 'Nestle', 'Kraft Heinz'],
    },
    'netflix': {
      industries: ['media', 'entertainment', 'technology', 'consumer'],
      industryCategory: 'Streaming / Entertainment',
      isB2B: false,
      isB2C: true,
      competitors: ['Disney+', 'HBO Max', 'Amazon Prime'],
    },
    'disney': {
      industries: ['media', 'entertainment', 'consumer'],
      industryCategory: 'Entertainment / Media',
      isB2B: false,
      isB2C: true,
      competitors: ['Netflix', 'Warner Bros', 'Universal'],
    },
    'spotify': {
      industries: ['media', 'entertainment', 'technology', 'consumer'],
      industryCategory: 'Music Streaming',
      isB2B: false,
      isB2C: true,
      competitors: ['Apple Music', 'YouTube Music', 'Amazon Music'],
    },
    'sap': {
      industries: ['technology', 'enterprise-software', 'B2B'],
      industryCategory: 'Enterprise Software',
      isB2B: true,
      isB2C: false,
      competitors: ['Oracle', 'Microsoft', 'Salesforce'],
    },
    'oracle': {
      industries: ['technology', 'enterprise-software', 'B2B'],
      industryCategory: 'Enterprise Software',
      isB2B: true,
      isB2C: false,
      competitors: ['SAP', 'Microsoft', 'Salesforce'],
    },
    'adobe': {
      industries: ['technology', 'software', 'B2B', 'consumer'],
      industryCategory: 'Creative Software',
      isB2B: true,
      isB2C: true,
      competitors: ['Canva', 'Figma', 'Salesforce'],
    },
    'hubspot': {
      industries: ['technology', 'SaaS', 'B2B', 'marketing-tech'],
      industryCategory: 'Marketing Software',
      isB2B: true,
      isB2C: false,
      competitors: ['Salesforce', 'Marketo', 'Mailchimp'],
    },
    'shopify': {
      industries: ['technology', 'e-commerce', 'SaaS', 'B2B'],
      industryCategory: 'E-commerce Platform',
      isB2B: true,
      isB2C: false,
      competitors: ['BigCommerce', 'WooCommerce', 'Squarespace'],
    },
    'uber': {
      industries: ['technology', 'transportation', 'consumer'],
      industryCategory: 'Ride-sharing / Delivery',
      isB2B: false,
      isB2C: true,
      competitors: ['Lyft', 'DoorDash', 'Instacart'],
    },
    'lyft': {
      industries: ['technology', 'transportation', 'consumer'],
      industryCategory: 'Ride-sharing',
      isB2B: false,
      isB2C: true,
      competitors: ['Uber', 'DoorDash', 'Instacart'],
    },
    'airbnb': {
      industries: ['technology', 'travel', 'hospitality', 'consumer'],
      industryCategory: 'Travel / Hospitality',
      isB2B: false,
      isB2C: true,
      competitors: ['Booking.com', 'VRBO', 'Expedia'],
    },
    'doordash': {
      industries: ['technology', 'food-delivery', 'consumer'],
      industryCategory: 'Food Delivery',
      isB2B: false,
      isB2C: true,
      competitors: ['Uber Eats', 'Grubhub', 'Instacart'],
    },
    'instacart': {
      industries: ['technology', 'grocery', 'e-commerce', 'consumer'],
      industryCategory: 'Grocery Delivery',
      isB2B: false,
      isB2C: true,
      competitors: ['DoorDash', 'Amazon', 'Walmart'],
    },
    'slack': {
      industries: ['technology', 'SaaS', 'enterprise-software', 'B2B'],
      industryCategory: 'Enterprise Collaboration',
      isB2B: true,
      isB2C: false,
      competitors: ['Microsoft Teams', 'Zoom', 'Discord'],
    },
    'zoom': {
      industries: ['technology', 'SaaS', 'enterprise-software', 'B2B'],
      industryCategory: 'Video Communications',
      isB2B: true,
      isB2C: true,
      competitors: ['Microsoft Teams', 'Google Meet', 'Webex'],
    },
    'atlassian': {
      industries: ['technology', 'SaaS', 'enterprise-software', 'B2B'],
      industryCategory: 'Developer Tools',
      isB2B: true,
      isB2C: false,
      competitors: ['GitHub', 'GitLab', 'Monday.com'],
    },
    'snowflake': {
      industries: ['technology', 'cloud', 'data', 'enterprise-software', 'B2B'],
      industryCategory: 'Cloud Data Platform',
      isB2B: true,
      isB2C: false,
      competitors: ['Databricks', 'AWS', 'Google BigQuery'],
    },
    'databricks': {
      industries: ['technology', 'cloud', 'data', 'enterprise-software', 'B2B'],
      industryCategory: 'Data & AI Platform',
      isB2B: true,
      isB2C: false,
      competitors: ['Snowflake', 'AWS', 'Azure'],
    },
    'nvidia': {
      industries: ['technology', 'hardware', 'semiconductors', 'B2B'],
      industryCategory: 'Semiconductors / AI',
      isB2B: true,
      isB2C: true,
      competitors: ['AMD', 'Intel', 'Qualcomm'],
    },
    'intel': {
      industries: ['technology', 'hardware', 'semiconductors', 'B2B'],
      industryCategory: 'Semiconductors',
      isB2B: true,
      isB2C: true,
      competitors: ['AMD', 'NVIDIA', 'Qualcomm'],
    },
    'walmart': {
      industries: ['retail', 'e-commerce', 'consumer'],
      industryCategory: 'Retail',
      isB2B: false,
      isB2C: true,
      competitors: ['Amazon', 'Target', 'Costco'],
    },
    'target': {
      industries: ['retail', 'e-commerce', 'consumer'],
      industryCategory: 'Retail',
      isB2B: false,
      isB2C: true,
      competitors: ['Walmart', 'Amazon', 'Costco'],
    },
    'costco': {
      industries: ['retail', 'consumer'],
      industryCategory: 'Wholesale Retail',
      isB2B: true,
      isB2C: true,
      competitors: ['Walmart', 'Target', 'Amazon'],
    },
    'linkedin': {
      industries: ['technology', 'social-media', 'B2B', 'professional-services'],
      industryCategory: 'Professional Networking',
      isB2B: true,
      isB2C: true,
      competitors: ['Indeed', 'Glassdoor', 'ZipRecruiter'],
    },
    'twitter': {
      industries: ['technology', 'social-media', 'advertising', 'consumer'],
      industryCategory: 'Social Media',
      isB2B: false,
      isB2C: true,
      competitors: ['Meta', 'TikTok', 'Snap'],
    },
    'x': {
      industries: ['technology', 'social-media', 'advertising', 'consumer'],
      industryCategory: 'Social Media',
      isB2B: false,
      isB2C: true,
      competitors: ['Meta', 'TikTok', 'Snap'],
    },
    'tiktok': {
      industries: ['technology', 'social-media', 'entertainment', 'consumer'],
      industryCategory: 'Social Media / Entertainment',
      isB2B: false,
      isB2C: true,
      competitors: ['Instagram', 'YouTube', 'Snap'],
    },
    'openai': {
      industries: ['technology', 'AI', 'enterprise-software', 'B2B'],
      industryCategory: 'Artificial Intelligence',
      isB2B: true,
      isB2C: true,
      competitors: ['Anthropic', 'Google', 'Microsoft'],
    },
    'anthropic': {
      industries: ['technology', 'AI', 'enterprise-software', 'B2B'],
      industryCategory: 'Artificial Intelligence',
      isB2B: true,
      isB2C: true,
      competitors: ['OpenAI', 'Google', 'Microsoft'],
    },
  };

  // Check for matches
  for (const [key, info] of Object.entries(knownCompanies)) {
    if (name.includes(key)) {
      return {
        company: companyName,
        industries: info.industries || [],
        industryCategory: info.industryCategory || 'unknown',
        isB2B: info.isB2B ?? false,
        isB2C: info.isB2C ?? false,
        competitors: info.competitors || [],
        confidence: 'high',
        source: 'known company database',
      };
    }
  }

  return {
    company: companyName,
    industries: [],
    industryCategory: 'unknown',
    isB2B: false,
    isB2C: false,
    competitors: [],
    confidence: 'low',
    source: 'none',
  };
}
