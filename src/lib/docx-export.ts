import {
  Document,
  Paragraph,
  TextRun,
  AlignmentType,
  convertInchesToTwip,
  PageOrientation,
  TabStopPosition,
  TabStopType,
  BorderStyle,
} from 'docx';
import { stripMarks } from './render-highlights';

interface HeaderData {
  name: string;
  title: string;
  location: string;
  phone: string;
  email: string;
}

interface PositionData {
  title: string;
  company: string;
  location: string;
  dates: string;
  overview: string;
  bullets: string[];
}

interface ResumeData {
  header: HeaderData;
  summary: string;
  highlights: string[];
  positions: { [key: number]: PositionData };
  education: {
    degree: string;
    field: string;
    school: string;
  };
  format: 'long' | 'short';
}

// Font settings
const FONT_MAJOR = 'Aptos Display';
const FONT_MINOR = 'Aptos';

// Style settings (in half-points for font size, twips for spacing)
const STYLES = {
  name: { size: 32, bold: true }, // 16pt
  title: { size: 24, bold: false }, // 12pt
  contact: { size: 22, bold: false, after: 180 }, // 11pt, 9pt after
  sectionHeader: { size: 24, bold: true, before: 180, after: 60 }, // 12pt, 9pt before, 3pt after
  positionTitle: { size: 22, bold: true, before: 120 }, // 11pt, 6pt before
  company: { size: 22, bold: false, after: 60 }, // 11pt, 3pt after
  body: { size: 22, bold: false, before: 120, after: 120 }, // 11pt, 6pt before/after
  bullet: { size: 22, bold: false, before: 60, after: 144 }, // 11pt, 3pt before, 7.2pt after
  highlight: { size: 22, bold: false, before: 100, after: 60 }, // 11pt, 5pt before, 3pt after
};

function createNameParagraph(name: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: name,
        font: { name: FONT_MAJOR },
        size: STYLES.name.size,
        bold: STYLES.name.bold,
      }),
    ],
    alignment: AlignmentType.LEFT,
  });
}

function createTitleParagraph(title: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: title,
        font: { name: FONT_MINOR },
        size: STYLES.title.size,
        bold: STYLES.title.bold,
      }),
    ],
    alignment: AlignmentType.LEFT,
  });
}

function createContactParagraph(location: string, phone: string, email: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: `${location} | ${phone} | ${email}`,
        font: { name: FONT_MINOR },
        size: STYLES.contact.size,
      }),
    ],
    spacing: { after: STYLES.contact.after },
    alignment: AlignmentType.LEFT,
  });
}

function createSectionHeader(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: text.toUpperCase(),
        font: { name: FONT_MAJOR },
        size: STYLES.sectionHeader.size,
        bold: STYLES.sectionHeader.bold,
      }),
    ],
    spacing: {
      before: STYLES.sectionHeader.before,
      after: STYLES.sectionHeader.after,
    },
    border: {
      bottom: {
        color: '000000',
        space: 1,
        size: 6,
        style: BorderStyle.SINGLE,
      },
    },
  });
}

function createSummaryParagraph(summary: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: stripMarks(summary),
        font: { name: FONT_MINOR },
        size: STYLES.body.size,
      }),
    ],
    spacing: {
      before: STYLES.body.before,
      after: STYLES.body.after,
    },
  });
}

function createHighlightParagraph(highlight: string): Paragraph {
  // Strip mark tags before processing
  const cleanHighlight = stripMarks(highlight);

  // Parse for bold hook phrase (text before the colon)
  const colonIndex = cleanHighlight.indexOf(':');
  const children: TextRun[] = [];

  if (colonIndex > 0 && colonIndex < 60) {
    // Has a hook phrase
    const hook = cleanHighlight.substring(0, colonIndex + 1);
    const rest = cleanHighlight.substring(colonIndex + 1);

    children.push(
      new TextRun({
        text: hook,
        font: { name: FONT_MINOR },
        size: STYLES.highlight.size,
        bold: true,
      }),
      new TextRun({
        text: rest,
        font: { name: FONT_MINOR },
        size: STYLES.highlight.size,
      })
    );
  } else {
    children.push(
      new TextRun({
        text: cleanHighlight,
        font: { name: FONT_MINOR },
        size: STYLES.highlight.size,
      })
    );
  }

  return new Paragraph({
    children,
    bullet: { level: 0 },
    spacing: {
      before: STYLES.highlight.before,
      after: STYLES.highlight.after,
    },
  });
}

function createPositionTitleParagraph(title: string, dates: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: title,
        font: { name: FONT_MINOR },
        size: STYLES.positionTitle.size,
        bold: STYLES.positionTitle.bold,
      }),
      new TextRun({
        text: '\t',
      }),
      new TextRun({
        text: dates,
        font: { name: FONT_MINOR },
        size: STYLES.positionTitle.size,
        bold: false,
      }),
    ],
    tabStops: [
      {
        type: TabStopType.RIGHT,
        position: TabStopPosition.MAX,
      },
    ],
    spacing: { before: STYLES.positionTitle.before },
  });
}

function createCompanyParagraph(company: string, location: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: `${company} | ${location}`,
        font: { name: FONT_MINOR },
        size: STYLES.company.size,
      }),
    ],
    spacing: { after: STYLES.company.after },
  });
}

function createOverviewParagraph(overview: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: stripMarks(overview),
        font: { name: FONT_MINOR },
        size: STYLES.body.size,
      }),
    ],
    spacing: {
      before: STYLES.body.before,
      after: STYLES.body.after,
    },
  });
}

function createBulletParagraph(bullet: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: stripMarks(bullet),
        font: { name: FONT_MINOR },
        size: STYLES.bullet.size,
      }),
    ],
    bullet: { level: 0 },
    spacing: {
      before: STYLES.bullet.before,
      after: STYLES.bullet.after,
    },
    indent: { left: convertInchesToTwip(0.25) },
  });
}

function createEducationParagraph(degree: string, field: string, school: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: `${school}: `,
        font: { name: FONT_MINOR },
        size: STYLES.body.size,
        bold: false,
      }),
      new TextRun({
        text: `${degree} | ${field}`,
        font: { name: FONT_MINOR },
        size: STYLES.body.size,
      }),
    ],
    spacing: { before: STYLES.body.before },
  });
}

export function generateResumeDocument(data: ResumeData): Document {
  const sections: Paragraph[] = [];

  // Header
  sections.push(createNameParagraph(data.header.name));
  sections.push(createTitleParagraph(data.header.title));
  sections.push(createContactParagraph(
    data.header.location,
    data.header.phone,
    data.header.email
  ));

  // Summary (if provided)
  if (data.summary) {
    sections.push(createSummaryParagraph(data.summary));
  }

  // Career Highlights
  if (data.highlights && data.highlights.length > 0) {
    sections.push(createSectionHeader('Career Highlights'));
    for (const highlight of data.highlights) {
      sections.push(createHighlightParagraph(highlight));
    }
  }

  // Professional Experience
  sections.push(createSectionHeader('Professional Experience'));

  // Sort positions by number
  const positionNumbers = Object.keys(data.positions)
    .map(Number)
    .sort((a, b) => a - b);

  for (const posNum of positionNumbers) {
    const pos = data.positions[posNum];
    if (!pos) continue;

    sections.push(createPositionTitleParagraph(pos.title, pos.dates));
    sections.push(createCompanyParagraph(pos.company, pos.location));

    if (pos.overview) {
      sections.push(createOverviewParagraph(pos.overview));
    }

    if (pos.bullets && pos.bullets.length > 0) {
      for (const bullet of pos.bullets) {
        sections.push(createBulletParagraph(bullet));
      }
    }
  }

  // Education
  sections.push(createSectionHeader('Education'));
  sections.push(createEducationParagraph(
    data.education.degree,
    data.education.field,
    data.education.school
  ));

  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertInchesToTwip(8.27), // A4 width
              height: convertInchesToTwip(11.69), // A4 height
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: convertInchesToTwip(0.75),
              right: convertInchesToTwip(0.75),
              bottom: convertInchesToTwip(0.75),
              left: convertInchesToTwip(0.75),
            },
          },
        },
        children: sections,
      },
    ],
  });

  return doc;
}
