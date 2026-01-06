// ============================================================
// ResumeOS V2.1: Content Bank API Endpoint
// Returns structured content from master-content.json
// ============================================================

import { NextResponse } from 'next/server';
import masterContent from '@/data/master-content.json';

interface ContentItem {
  id: string;
  title: string;
  category: string;
  content: string;
  variants?: { id: string; label: string; content: string }[];
  tags?: {
    industry?: string[];
    function?: string[];
    theme?: string[];
  };
}

export async function GET() {
  try {
    const content: ContentItem[] = [];

    // Process summaries
    if (masterContent.summaries) {
      for (const summary of masterContent.summaries) {
        content.push({
          id: summary.id,
          title: summary.title,
          category: 'Summary',
          content: summary.contentLong,
          tags: {
            industry: summary.industryTags,
            function: summary.functionTags,
            theme: summary.themeTags,
          },
        });
      }
    }

    // Process career highlights
    if (masterContent.careerHighlights) {
      for (const ch of masterContent.careerHighlights) {
        const variants = ch.variants?.map((v: { id: string; label: string; content: string; themeTags?: string[] }) => ({
          id: v.id,
          label: v.label,
          content: v.content,
        }));

        content.push({
          id: ch.id,
          title: ch.title,
          category: 'Career Highlight',
          content: ch.contentLong,
          variants,
          tags: {
            industry: ch.industryTags,
            function: ch.functionTags,
          },
        });
      }
    }

    // Process position bullets
    const bulletCategories = [
      { key: 'position1Bullets', label: 'Position 1 Bullet' },
      { key: 'position2Bullets', label: 'Position 2 Bullet' },
      { key: 'position3Bullets', label: 'Position 3 Bullet' },
      { key: 'position4Bullets', label: 'Position 4 Bullet' },
      { key: 'position5Bullets', label: 'Position 5 Bullet' },
      { key: 'position6Bullets', label: 'Position 6 Bullet' },
    ];

    for (const { key, label } of bulletCategories) {
      const bullets = (masterContent as Record<string, unknown>)[key] as Array<{
        id: string;
        title: string;
        contentLong: string;
        industryTags?: string[];
        functionTags?: string[];
        variants?: Array<{ id: string; label: string; content: string }>;
      }> | undefined;

      if (bullets) {
        for (const bullet of bullets) {
          const variants = bullet.variants?.map((v) => ({
            id: v.id,
            label: v.label,
            content: v.content,
          }));

          content.push({
            id: bullet.id,
            title: bullet.title,
            category: label,
            content: bullet.contentLong,
            variants,
            tags: {
              industry: bullet.industryTags,
              function: bullet.functionTags,
            },
          });
        }
      }
    }

    // Process overviews
    if ((masterContent as Record<string, unknown>).overviews) {
      const overviews = (masterContent as Record<string, unknown>).overviews as Array<{
        id: string;
        title: string;
        position: number;
        contentLong: string;
        industryTags?: string[];
        functionTags?: string[];
        variants?: Array<{ id: string; label: string; content: string }>;
      }>;

      for (const overview of overviews) {
        const variants = overview.variants?.map((v) => ({
          id: v.id,
          label: v.label,
          content: v.content,
        }));

        content.push({
          id: overview.id,
          title: overview.title,
          category: `Position ${overview.position} Overview`,
          content: overview.contentLong,
          variants,
          tags: {
            industry: overview.industryTags,
            function: overview.functionTags,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      content,
      count: content.length,
    });
  } catch (error) {
    console.error('Error loading content bank:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load content bank' },
      { status: 500 }
    );
  }
}
