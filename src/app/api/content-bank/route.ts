import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { contentItems } from '@/drizzle/schema';
import { eq, and, notInArray, or } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const position = searchParams.get('position');
  const exclude = searchParams.get('exclude')?.split(',').filter(Boolean) || [];
  const currentId = searchParams.get('currentId'); // ID of the item being edited

  if (!type) {
    return NextResponse.json({ error: 'Missing type parameter' }, { status: 400 });
  }

  try {
    // If currentId is provided, find variants of the same base
    if (currentId && (type === 'career_highlight' || type === 'bullet')) {
      // First, get the current item to determine its base_id
      const currentItem = await db
        .select({
          id: contentItems.id,
          baseId: contentItems.baseId,
        })
        .from(contentItems)
        .where(eq(contentItems.id, currentId))
        .limit(1);

      if (currentItem.length > 0) {
        const current = currentItem[0];
        // Determine the base ID: if current has a baseId, use it; otherwise current IS the base
        const baseId = current.baseId || current.id;

        // Find all items that share this base (the base itself + all its variants)
        // Exclude the current item being edited
        const items = await db
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
            baseId: contentItems.baseId,
            variantLabel: contentItems.variantLabel,
            themeTags: contentItems.themeTags,
          })
          .from(contentItems)
          .where(
            and(
              eq(contentItems.type, type),
              or(
                eq(contentItems.id, baseId), // The base item itself
                eq(contentItems.baseId, baseId) // All variants of this base
              ),
              notInArray(contentItems.id, [currentId]) // Exclude current item
            )
          );

        return NextResponse.json({ items });
      }
    }

    // Fallback: original behavior for summaries/overviews or when no currentId
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
