import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { type InsertUser, users } from "../schema";

export async function createUser(user: InsertUser) {
  return await db.insert(users).values(user).returning();
}

export async function getUserById(id: number) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .limit(1);
  return user ?? null;
}

export async function updateUser(id: number, data: Partial<InsertUser>) {
  return await db
    .update(users)
    .set({
      ...data,
    })
    .where(eq(users.id, id))
    .returning();
}

export async function softDeleteUser(id: number) {
  return await db
    .update(users)
    .set({
      deletedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();
}

export async function listUsers() {
  return await db.select().from(users).where(isNull(users.deletedAt));
}

export async function getUsersByOrganizationId(organizationId: number) {
  return await db
    .select()
    .from(users)
    .where(and(eq(users.organizationId, organizationId), isNull(users.deletedAt)));
}
