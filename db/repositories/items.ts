import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { type InsertItem, items } from "../schema";

export async function createItem(item: InsertItem) {
  return await db.insert(items).values(item).returning();
}

export async function getItemById(id: number, organizationId: number) {
  const [item] = await db
    .select()
    .from(items)
    .where(and(eq(items.id, id), eq(items.organizationId, organizationId), isNull(items.deletedAt)))
    .limit(1);
  return item ?? null;
}

export async function updateItem(id: number, organizationId: number, data: Partial<InsertItem>) {
  return await db
    .update(items)
    .set(data)
    .where(and(eq(items.id, id), eq(items.organizationId, organizationId), isNull(items.deletedAt)))
    .returning();
}

export async function softDeleteItem(id: number, organizationId: number) {
  return await db
    .update(items)
    .set({ deletedAt: new Date() })
    .where(and(eq(items.id, id), eq(items.organizationId, organizationId), isNull(items.deletedAt)))
    .returning();
}

export async function listItemsByOrg(organizationId: number) {
  return await db
    .select()
    .from(items)
    .where(and(eq(items.organizationId, organizationId), isNull(items.deletedAt)));
}

export async function getItemsByOrganizationId(organizationId: number) {
  return await db
    .select()
    .from(items)
    .where(and(eq(items.organizationId, organizationId), isNull(items.deletedAt)));
}

export async function listItemsByOrgPaginated(organizationId: number, page: number, limit: number) {
  const offset = (page - 1) * limit;
  return await db
    .select()
    .from(items)
    .where(and(eq(items.organizationId, organizationId), isNull(items.deletedAt)))
    .limit(limit)
    .offset(offset);
}

export async function countItemsByOrg(organizationId: number) {
  const [result] = await db
    .select({ count: count() })
    .from(items)
    .where(and(eq(items.organizationId, organizationId), isNull(items.deletedAt)));
  return result?.count ?? 0;
}
