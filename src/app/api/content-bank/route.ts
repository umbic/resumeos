import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { contentItems } from '@/drizzle/schema';
import { eq, and, notInArray, or } from 'drizzle-orm';
import { CONFLICT_MAP, REVERSE_CONFLICT_MAP } from '@/lib/rules';

// Get the conflict pair for an item (the item that shares the same achievement)
function getConflictPair(itemId: string): string | null {
  // Check if this item has a direct conflict (CH → P-B)
  const directConflicts = CONFLICT_MAP[itemId];
  if (directConflicts && directConflicts.length > 0) {
    return directConflicts[0]; // Return the first conflict pair
  }

  // Check reverse conflict (P-B → CH)
  const reverseConflicts = REVERSE_CONFLICT_MAP[itemId];
  if (reverseConflicts && reverseConflicts.length > 0) {
    return reverseConflicts[0]; // Return the first conflict pair
  }

  return null;
}

// Find all CH base IDs that conflict with bullets at a specific position
function getCHItemsForPosition(positionNumber: number): string[] {
  const chItems: string[] = [];
  const positionPrefix = `P${positionNumber}-B`;

  // Look through CONFLICT_MAP to find CH items that conflict with this position's bullets
  for (const [chId, bulletIds] of Object.entries(CONFLICT_MAP)) {
    if (chId.startsWith('CH-')) {
      const hasPositionConflict = bulletIds.some(bid => bid.startsWith(positionPrefix));
      if (hasPositionConflict) {
        chItems.push(chId);
      }
    }
  }

  return chItems;
}

// Standard select fields for content items
const contentSelectFields = {
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
};

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
    // If currentId is provided, find variants of the same base or conflict pair
    if (currentId && (type === 'career_highlight' || type === 'bullet')) {
      // First, get the current item to determine its base_id
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

        // STEP 1: Try to find direct variants of this item's base
        const directVariants = await fetchVariantsForBase(baseId, currentId);

        if (directVariants.length > 0) {
          return NextResponse.json({ items: directVariants, hasVariants: true });
        }

        // STEP 2: No direct variants - check for conflict pair
        const conflictPairId = getConflictPair(baseId);

        if (conflictPairId) {
          // Fetch variants of the conflict pair instead
          const conflictVariants = await fetchVariantsForBase(conflictPairId, currentId);

          if (conflictVariants.length > 0) {
            return NextResponse.json({
              items: conflictVariants,
              hasVariants: true,
              fromConflictPair: true
            });
          }
        }

        // STEP 3: No variants found and no conflict pair variants - return empty
        return NextResponse.json({ items: [], hasVariants: false });
      }
    }

    // Fallback: original behavior for summaries/overviews or when no currentId
    const conditions = [eq(contentItems.type, type)];

    if (position) {
      conditions.push(eq(contentItems.position, parseInt(position)));
    }

    // Execute query with conditions - use full content fields for proper grouping
    let items;
    if (exclude.length > 0) {
      items = await db
        .select(contentSelectFields)
        .from(contentItems)
        .where(and(...conditions, notInArray(contentItems.id, exclude)));
    } else {
      items = await db
        .select(contentSelectFields)
        .from(contentItems)
        .where(and(...conditions));
    }

    // For bullet queries with position, also include CH items that conflict with bullets at that position
    // This allows users to choose between a Position bullet and its related CH category
    if (type === 'bullet' && position) {
      const positionNumber = parseInt(position);
      const relatedCHIds = getCHItemsForPosition(positionNumber);

      if (relatedCHIds.length > 0) {
        // Fetch CH items (base + variants) that conflict with this position's bullets
        const chItemsQuery = await db
          .select(contentSelectFields)
          .from(contentItems)
          .where(
            or(
              // Base CH items
              ...relatedCHIds.map(chId => eq(contentItems.id, chId)),
              // Variants of those CH items
              ...relatedCHIds.map(chId => eq(contentItems.baseId, chId))
            )
          );

        // Filter out excluded items and merge with bullet items
        const filteredCHItems = exclude.length > 0
          ? chItemsQuery.filter(item => !exclude.includes(item.id))
          : chItemsQuery;

        items = [...items, ...filteredCHItems];
      }
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

// Helper function to fetch variants for a given base ID
async function fetchVariantsForBase(baseId: string, excludeId: string) {
  // Get the base item to get its brandTags
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
    .select(contentSelectFields)
    .from(contentItems)
    .where(
      and(
        or(
          eq(contentItems.id, baseId), // The base item itself
          eq(contentItems.baseId, baseId) // All variants of this base
        ),
        notInArray(contentItems.id, [excludeId]) // Exclude current item
      )
    );

  // Add base's brandTags to variants that don't have them
  if (variantItems.length > 0) {
    return variantItems.map(item => ({
      ...item,
      // Use base's brandTags if item has no brandTags (null or empty array)
      brandTags: (item.brandTags && item.brandTags.length > 0) ? item.brandTags : baseBrandTags,
    }));
  }

  return [];
}
