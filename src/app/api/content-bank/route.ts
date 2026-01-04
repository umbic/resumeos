import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { contentItems } from '@/drizzle/schema';
import { eq, and, notInArray } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const position = searchParams.get('position');
  const exclude = searchParams.get('exclude')?.split(',').filter(Boolean) || [];

  if (!type) {
    return NextResponse.json({ error: 'Missing type parameter' }, { status: 400 });
  }

  try {
    // Build the query conditions
    const conditions = [eq(contentItems.type, type)];

    if (position) {
      conditions.push(eq(contentItems.position, parseInt(position)));
    }

    // Execute query with conditions
    let items;
    if (exclude.length > 0) {
      items = await db
        .select({
          id: contentItems.id,
          type: contentItems.type,
          position: contentItems.position,
          contentShort: contentItems.contentShort,
          contentMedium: contentItems.contentMedium,
          contentLong: contentItems.contentLong,
          contentGeneric: contentItems.contentGeneric,
          categoryTags: contentItems.categoryTags,
          outcomeTags: contentItems.outcomeTags,
          functionTags: contentItems.functionTags,
          brandTags: contentItems.brandTags,
        })
        .from(contentItems)
        .where(and(...conditions, notInArray(contentItems.id, exclude)));
    } else {
      items = await db
        .select({
          id: contentItems.id,
          type: contentItems.type,
          position: contentItems.position,
          contentShort: contentItems.contentShort,
          contentMedium: contentItems.contentMedium,
          contentLong: contentItems.contentLong,
          contentGeneric: contentItems.contentGeneric,
          categoryTags: contentItems.categoryTags,
          outcomeTags: contentItems.outcomeTags,
          functionTags: contentItems.functionTags,
          brandTags: contentItems.brandTags,
        })
        .from(contentItems)
        .where(and(...conditions));
    }

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error fetching content bank:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content bank' },
      { status: 500 }
    );
  }
}
