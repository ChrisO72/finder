import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { type InsertSubItem, subItems, items } from "../schema";

export async function createSubItem(subItem: InsertSubItem, organizationId: number) {
  // Verify parent item belongs to the organization
  const [item] = await db
    .select()
    .from(items)
    .where(
      and(
        eq(items.id, subItem.itemId),
        eq(items.organizationId, organizationId),
        isNull(items.deletedAt),
      ),
    )
    .limit(1);

  if (!item) return null;

  return await db.insert(subItems).values(subItem).returning();
}

export async function getSubItemById(id: number, organizationId: number) {
  const [subItem] = await db
    .select({ subItem: subItems })
    .from(subItems)
    .innerJoin(items, eq(subItems.itemId, items.id))
    .where(
      and(
        eq(subItems.id, id),
        eq(items.organizationId, organizationId),
        isNull(subItems.deletedAt),
        isNull(items.deletedAt),
      ),
    )
    .limit(1);
  return subItem?.subItem ?? null;
}

export async function updateSubItem(
  id: number,
  organizationId: number,
  data: Partial<InsertSubItem>,
) {
  // First verify the subItem belongs to an item in the organization
  const existing = await getSubItemById(id, organizationId);
  if (!existing) return [];

  return await db
    .update(subItems)
    .set(data)
    .where(and(eq(subItems.id, id), isNull(subItems.deletedAt)))
    .returning();
}

export async function softDeleteSubItem(id: number, organizationId: number) {
  // First verify the subItem belongs to an item in the organization
  const existing = await getSubItemById(id, organizationId);
  if (!existing) return [];

  return await db
    .update(subItems)
    .set({ deletedAt: new Date() })
    .where(and(eq(subItems.id, id), isNull(subItems.deletedAt)))
    .returning();
}

export async function listSubItemsByOrg(organizationId: number) {
  return await db
    .select({ subItem: subItems })
    .from(subItems)
    .innerJoin(items, eq(subItems.itemId, items.id))
    .where(
      and(
        eq(items.organizationId, organizationId),
        isNull(subItems.deletedAt),
        isNull(items.deletedAt),
      ),
    )
    .then((rows) => rows.map((r) => r.subItem));
}

export async function getSubItemsByItemId(itemId: number, organizationId: number) {
  return await db
    .select({ subItem: subItems })
    .from(subItems)
    .innerJoin(items, eq(subItems.itemId, items.id))
    .where(
      and(
        eq(subItems.itemId, itemId),
        eq(items.organizationId, organizationId),
        isNull(subItems.deletedAt),
        isNull(items.deletedAt),
      ),
    )
    .then((rows) => rows.map((r) => r.subItem));
}
