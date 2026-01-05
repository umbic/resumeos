import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { contentItems } from '@/drizzle/schema';
import { eq, and, notInArray, or, isNull } from 'drizzle-orm';

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
      // First, get the current item to determine its base_id and position
      const currentItem = await db
        .select({
          id: contentItems.id,
          baseId: contentItems.baseId,
          position: contentItems.position,
        })
        .from(contentItems)
        .where(eq(contentItems.id, currentId))
        .limit(1);

      if (currentItem.length > 0) {
        const current = currentItem[0];
        // Determine the base ID: if current has a baseId, use it; otherwise current IS the base
        const baseId = current.baseId || current.id;

        // Get the base item to get its brandTags (for variants that don't have them)
        const baseItem = await db
          .select({
            id: contentItems.id,
            brandTags: contentItems.brandTags,
          })
          .from(contentItems)
          .where(eq(contentItems.id, baseId))
          .limit(1);

        const baseBrandTags = baseItem[0]?.brandTags || null;

        // Find all items that share this base (the base itself + all its variants)
        // Exclude the current item being edited
        const variantItems = await db
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

        // If variants found, add base's brandTags to variants that don't have them
        if (variantItems.length > 0) {
          const itemsWithBrandTags = variantItems.map(item => ({
            ...item,
            // Use base's brandTags if item has no brandTags (null or empty array)
            brandTags: (item.brandTags && item.brandTags.length > 0) ? item.brandTags : baseBrandTags,
          }));
          return NextResponse.json({ items: itemsWithBrandTags, hasVariants: true });
        }

        // No variants - fall back to showing all OTHER base items (different achievements)
        // For bullets, filter by position
        const fallbackConditions = [
          eq(contentItems.type, type),
          isNull(contentItems.baseId), // Only base items, not variants
          notInArray(contentItems.id, [currentId]), // Exclude current
        ];

        if (type === 'bullet' && current.position) {
          fallbackConditions.push(eq(contentItems.position, current.position));
        }

        const fallbackItems = await db
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
          .where(and(...fallbackConditions));

        return NextResponse.json({ items: fallbackItems, hasVariants: false });
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
