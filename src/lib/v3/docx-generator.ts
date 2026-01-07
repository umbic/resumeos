// src/lib/v3/docx-generator.ts
// Generates DOCX document from ResumeV3

import {
  Document,
  Paragraph,
  TextRun,
  AlignmentType,
  TabStopType,
  TabStopPosition,
  convertInchesToTwip,
} from 'docx';
import type { ResumeV3 } from './types';

export function generateDocx(resume: ResumeV3): Document {
  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.5),
              bottom: convertInchesToTwip(0.5),
              left: convertInchesToTwip(0.6),
              right: convertInchesToTwip(0.6),
            },
          },
        },
        children: [
          ...buildHeader(resume.header),
          ...buildSummary(resume.summary),
          ...buildCareerHighlights(resume.careerHighlights),
          ...buildExperience(resume.positions),
          ...buildEducation(resume.education),
        ],
      },
    ],
  });
}

function buildHeader(header: ResumeV3['header']): Paragraph[] {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: header.name,
          bold: true,
          size: 28,
          font: 'Calibri',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: header.targetTitle,
          size: 22,
          font: 'Calibri',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${header.location} | ${header.phone} | ${header.email}`,
          size: 20,
          font: 'Calibri',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
  ];
}

function buildSummary(summary: string): Paragraph[] {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: summary,
          size: 20,
          font: 'Calibri',
        }),
      ],
      spacing: { after: 200 },
    }),
  ];
}

function buildCareerHighlights(highlights: ResumeV3['careerHighlights']): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: 'CAREER HIGHLIGHTS',
          bold: true,
          size: 22,
          font: 'Calibri',
        }),
      ],
      spacing: { before: 200, after: 100 },
    }),
  ];

  for (const ch of highlights) {
    // Parse content to separate headline from body
    const contentWithoutHeadline = ch.content.replace(/\*\*[^*]+\*\*:\s*/, '');

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: '• ', size: 20, font: 'Calibri' }),
          new TextRun({ text: ch.headline, bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: ': ', bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: contentWithoutHeadline, size: 20, font: 'Calibri' }),
        ],
        spacing: { after: 80 },
        indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.25) },
      })
    );
  }

  return paragraphs;
}

function buildExperience(positions: ResumeV3['positions']): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: 'PROFESSIONAL EXPERIENCE',
          bold: true,
          size: 22,
          font: 'Calibri',
        }),
      ],
      spacing: { before: 200, after: 100 },
    }),
  ];

  for (const pos of positions) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: pos.title, bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: '\t', size: 20 }),
          new TextRun({ text: `${pos.startDate} - ${pos.endDate}`, size: 20, font: 'Calibri' }),
        ],
        tabStops: [
          {
            type: TabStopType.RIGHT,
            position: TabStopPosition.MAX,
          },
        ],
        spacing: { before: 150 },
      })
    );

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${pos.company} | ${pos.location}`, size: 20, font: 'Calibri' }),
        ],
        spacing: { after: 80 },
      })
    );

    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: pos.overview, size: 20, font: 'Calibri' })],
        spacing: { after: 80 },
      })
    );

    if (pos.bullets) {
      for (const bullet of pos.bullets) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: '• ', size: 20, font: 'Calibri' }),
              new TextRun({ text: bullet, size: 20, font: 'Calibri' }),
            ],
            indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.25) },
            spacing: { after: 60 },
          })
        );
      }
    }
  }

  return paragraphs;
}

function buildEducation(education: ResumeV3['education']): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: 'EDUCATION',
          bold: true,
          size: 22,
          font: 'Calibri',
        }),
      ],
      spacing: { before: 200, after: 100 },
    }),
  ];

  for (const edu of education) {
    const yearPart = edu.year ? ` (${edu.year})` : '';
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${edu.institution}: ${edu.degree} | ${edu.field}${yearPart}`,
            size: 20,
            font: 'Calibri',
          }),
        ],
      })
    );
  }

  return paragraphs;
}
