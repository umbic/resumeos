# Content Database JSON Schema

This document defines the exact JSON structure for the content database that will be seeded into Vercel Postgres with pgvector embeddings.

---

## Top-Level Structure

```json
{
  "metadata": {
    "version": "4.0",
    "last_updated": "2025-01-02",
    "total_items": 80
  },
  "static_content": {
    "header": { ... },
    "education": { ... }
  },
  "conflict_rules": [ ... ],
  "items": [ ... ]
}
```

---

## Static Content

### Header
```json
{
  "header": {
    "name": "Umberto Castaldo",
    "location": "New York, NY",
    "phone": "917 435 2003",
    "email": "Umberto.Castaldo@gmail.com"
  }
}
```

### Education
```json
{
  "education": {
    "degree": "Bachelor of Arts in Communications",
    "school": "Fordham University",
    "location": "New York, NY"
  }
}
```

---

## Conflict Rules

Defines which content items cannot appear together in the same resume.

```json
{
  "conflict_rules": [
    {
      "item_id": "CH-01",
      "conflicts_with": ["P1-B02"],
      "reason": "Both use $40M practice and 35+ strategists metrics"
    },
    {
      "item_id": "CH-02",
      "conflicts_with": ["P2-B08"],
      "reason": "Both use NWSL 50% attendance and $60M media deal metrics"
    },
    {
      "item_id": "CH-03",
      "conflicts_with": ["P1-B04"],
      "reason": "Both use OOFOS 191% sales and 54% acquisition metrics"
    },
    {
      "item_id": "CH-04",
      "conflicts_with": ["P1-B09"],
      "reason": "Both use Deloitte 43% lead gen and 33% relevancy metrics"
    },
    {
      "item_id": "CH-05",
      "conflicts_with": ["P2-B09"],
      "reason": "Both use PfizerForAll $727M revenue metric"
    },
    {
      "item_id": "CH-06",
      "conflicts_with": ["P1-B08"],
      "reason": "Both use LTK $2.8B to $5B scaling metric"
    },
    {
      "item_id": "CH-07",
      "conflicts_with": ["P1-B05"],
      "reason": "Both use NYU Langone 1.6M appointments metric"
    },
    {
      "item_id": "CH-08",
      "conflicts_with": ["P1-B07"],
      "reason": "Both use Gateway 30K members metric"
    },
    {
      "item_id": "CH-09",
      "conflicts_with": ["P1-B03"],
      "reason": "Both use Amex 5% retention and 12% cross-sell metrics"
    },
    {
      "item_id": "CH-10",
      "conflicts_with": ["P4-B01", "P4-B02"],
      "reason": "All use GE innovation and Cannes Grand Prix metrics"
    }
  ]
}
```

---

## Content Items Schema

Each item in the `items` array follows this structure:

```json
{
  "id": "string",           // Unique identifier (e.g., "CH-01", "P1-B05", "SUM-BR-02")
  "type": "string",         // "summary" | "career_highlight" | "bullet" | "overview"
  "position": "number|null", // 1-6 for position-specific, null for highlights/summaries
  
  "content_short": "string|null",
  "content_medium": "string|null", 
  "content_long": "string|null",
  "content_generic": "string|null",  // Unbranded version
  
  "brand_tags": ["string"],          // Companies explicitly named
  "category_tags": ["string"],       // Industry categories
  "function_tags": ["string"],       // What kind of work
  "outcome_tags": ["string"],        // What results achieved
  
  "exclusive_metrics": ["string"]    // Metrics unique to this item (for deduplication display)
}
```

---

## Item Type Definitions

### Summaries (type: "summary")

ID Pattern: `SUM-{category}-{number}`
Categories: BR (Brand), CA (Campaign), B2B, GE (Generic)

```json
{
  "id": "SUM-BR-01",
  "type": "summary",
  "position": null,
  
  "content_long": "Umberto is a visionary brand strategist who helps organizations...",
  "content_medium": null,
  "content_short": null,
  "content_generic": null,
  
  "brand_tags": [],
  "category_tags": ["brand-platform", "identity-systems"],
  "function_tags": ["brand-strategy", "platform-development"],
  "outcome_tags": ["brand-transformation", "market-leadership"],
  
  "exclusive_metrics": []
}
```

### Career Highlights (type: "career_highlight")

ID Pattern: `CH-{number}` (01-11)

```json
{
  "id": "CH-01",
  "type": "career_highlight",
  "position": null,
  
  "content_short": "Built Deloitte's brand strategy practice from ground up to $40M with 35+ strategists",
  "content_medium": "Built and scaled Deloitte's brand strategy practice from ground up to $40M, assembling 35+ strategists and achieving 3x growth in Fortune 500 initiatives",
  "content_long": "Recruited to launch Deloitte's brand strategy practice from the ground up. Built a $40M offering by assembling and leading a team of 35+ strategists, securing executive-level client relationships, and expanding brand transformation work across industries. The practice achieved 3x growth in Fortune 500 initiatives and established Deloitte as a leader in strategic brand consulting.",
  "content_generic": "Built a consulting firm's brand strategy practice from ground up to $40M, assembling 35+ strategists and achieving 3x growth in Fortune 500 initiatives",
  
  "brand_tags": ["Deloitte"],
  "category_tags": ["Professional-Services-Consulting", "Internal-Practice-Building"],
  "function_tags": ["Practice-Launch", "Team-Building", "P&L-Management", "Business-Development"],
  "outcome_tags": ["Revenue-Growth", "Team-Scale", "Market-Leadership"],
  
  "exclusive_metrics": ["$40M", "$15M", "35+ strategists", "3x growth"]
}
```

### Position Bullets (type: "bullet")

ID Pattern: `P{position}-B{number}` (e.g., P1-B01, P2-B05)

```json
{
  "id": "P1-B01",
  "type": "bullet",
  "position": 1,
  
  "content_short": "Repositioned regional bank driving 64.3% revenue growth",
  "content_medium": "Developed brand strategy for regional banking provider, driving 9% customer acquisition and 64.3% revenue growth",
  "content_long": "Developed a differentiated brand strategy and creative platform to reposition Synovus as a relationship-driven B2B banking partner amid declining market share. Led messaging, identity refresh, and agency-led campaign storytelling. The new platform drove a 9% increase in new customer acquisition, lifted brand favorability by 12%, boosted digital engagement by 11%, and contributed to 64.3% revenue growth between 2021 and 2023.",
  "content_generic": "Developed brand strategy for regional financial institution, driving 9% customer acquisition and 64.3% revenue growth",
  
  "brand_tags": ["Synovus"],
  "category_tags": ["Financial-Services-B2B", "Regional-Bank"],
  "function_tags": ["Brand-Repositioning", "Messaging-Strategy", "Campaign-Development"],
  "outcome_tags": ["Customer-Acquisition", "Brand-Favorability", "Revenue-Growth"],
  
  "exclusive_metrics": ["9% customer acquisition", "12% brand favorability", "64.3% revenue growth", "11% digital engagement"]
}
```

### Position Overviews (type: "overview")

ID Pattern: `OV-P{position}` (e.g., OV-P1, OV-P2)

```json
{
  "id": "OV-P1",
  "type": "overview",
  "position": 1,
  
  "content_long": "Promoted to lead Deloitte's Brand Strategy & Activation practice during a time when CMOs faced increasing pressure to tie brand investment to enterprise value. Became a trusted advisor to Fortune 500 executives, repositioning brand from a marketing function to a business growth engine—and transforming how organizations define, express, and scale brand equity across the enterprise.",
  "content_medium": "Leads Deloitte's Brand Strategy & Activation practice, serving as trusted advisor to Fortune 500 executives on repositioning brand as a business growth engine. Oversees a team of 35+ strategists delivering enterprise-scale brand transformation.",
  "content_short": "Leads Deloitte's $40M Brand Strategy & Activation practice, advising Fortune 500 executives on brand transformation.",
  "content_generic": "Leads a major consulting firm's brand strategy practice, advising Fortune 500 executives on brand transformation and enterprise positioning.",
  
  "brand_tags": ["Deloitte"],
  "category_tags": ["Professional-Services-Consulting"],
  "function_tags": ["Practice-Leadership", "Executive-Advisory", "Team-Management"],
  "outcome_tags": ["Enterprise-Transformation", "Market-Leadership"],
  
  "exclusive_metrics": []
}
```

---

## Position Metadata

For reference, each position has these fixed attributes:

```json
{
  "positions": [
    {
      "number": 1,
      "title_default": "SVP Brand Strategy / Head of Brand Strategy Practice",
      "title_options": ["Head of Brand Strategy & Activation", "SVP Brand Strategy"],
      "company": "Deloitte Digital",
      "location": "New York, NY",
      "dates": "May 2021 - Present",
      "max_bullets_long": 4,
      "max_bullets_short": 0
    },
    {
      "number": 2,
      "title_default": "Sr. Director of Brand Strategy",
      "title_options": ["Director of Brand Strategy"],
      "company": "Deloitte Digital",
      "location": "New York, NY", 
      "dates": "Apr 2018 - May 2021",
      "max_bullets_long": 3,
      "max_bullets_short": 0
    },
    {
      "number": 3,
      "title_default": "VP of Innovation",
      "title_options": ["Director of Innovation"],
      "company": "Omnicom Media Group",
      "location": "New York, NY",
      "dates": "May 2016 - Apr 2018",
      "max_bullets_long": 0,
      "max_bullets_short": 0
    },
    {
      "number": 4,
      "title_default": "Head of Media Innovation",
      "title_options": ["Director of Media Innovation and Brand Partnerships"],
      "company": "OMD Worldwide",
      "location": "New York, NY",
      "dates": "Apr 2015 - May 2016",
      "max_bullets_long": 0,
      "max_bullets_short": 0
    },
    {
      "number": 5,
      "title_default": "Senior Brand Strategist",
      "title_options": [],
      "company": "Straightline International",
      "location": "New York, NY",
      "dates": "Jul 2014 - Apr 2015",
      "max_bullets_long": 0,
      "max_bullets_short": 0
    },
    {
      "number": 6,
      "title_default": "Brand Strategist",
      "title_options": ["Creative Strategist"],
      "company": "Berlin Cameron, WPP Cultural Agency",
      "location": "New York, NY",
      "dates": "Jun 2011 - Jul 2014",
      "max_bullets_long": 0,
      "max_bullets_short": 0
    }
  ]
}
```

---

## Format Rules

```json
{
  "format_rules": {
    "long": {
      "summary_lines": "4-5",
      "career_highlights_count": 5,
      "career_highlights_version": "medium",
      "position_1_bullets": 4,
      "position_2_bullets": 3,
      "position_3_6_bullets": 0,
      "bullet_version": "long"
    },
    "short": {
      "summary_lines": "3-4",
      "career_highlights_count": 5,
      "career_highlights_version": "short",
      "position_1_bullets": 0,
      "position_2_bullets": 0,
      "position_3_6_bullets": 0,
      "bullet_version": null
    }
  }
}
```

---

## Branding Rules

```json
{
  "branding_rules": {
    "competitor_conflicts": {
      "McKinsey": ["Deloitte"],
      "BCG": ["Deloitte"],
      "Bain": ["Deloitte"],
      "Accenture": ["Deloitte"],
      "EY": ["Deloitte"],
      "KPMG": ["Deloitte"],
      "PwC": ["Deloitte"],
      "WPP": ["Omnicom", "OMD"],
      "Publicis": ["Omnicom", "OMD"],
      "IPG": ["Omnicom", "OMD"],
      "Dentsu": ["Omnicom", "OMD"]
    },
    "always_generic": ["SAP"],
    "notes": "When applying to a company in competitor_conflicts keys, use content_generic for any item with conflicting brand_tags"
  }
}
```

---

## Complete Item Count

| Type | ID Pattern | Count | Notes |
|------|------------|-------|-------|
| Summaries | SUM-* | 20 | 5 each: BR, CA, B2B, GE |
| Career Highlights | CH-* | 11 | CH-01 through CH-11 |
| Position 1 Bullets | P1-B* | 10 | P1-B01 through P1-B10 |
| Position 2 Bullets | P2-B* | 9 | P2-B01 through P2-B09 |
| Position 3 Bullets | P3-B* | 3 | P3-B01 through P3-B03 |
| Position 4 Bullets | P4-B* | 2 | P4-B01, P4-B02 |
| Position 5 Bullets | P5-B* | 2 | P5-B01, P5-B02 |
| Position 6 Bullets | P6-B* | 1 | P6-B01 |
| Position Overviews | OV-P* | 6 | OV-P1 through OV-P6 |
| **Total** | | **64** | Plus 20 summaries = 84 items |

---

## Embedding Strategy

When generating embeddings for semantic search, concatenate:

```javascript
const textToEmbed = [
  item.content_long || item.content_medium || item.content_short,
  item.function_tags?.join(', '),
  item.outcome_tags?.join(', '),
  item.category_tags?.join(', ')
].filter(Boolean).join(' | ');
```

This ensures the embedding captures both the content AND the metadata for better matching.
