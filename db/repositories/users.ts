import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { type InsertUser, type SelectUser, users } from "../schema/auth";

export type SafeUser = Pick<
  SelectUser,
  | "id"
  | "email"
  | "firstName"
  | "lastName"
  | "role"
  | "organizationId"
  | "emailConfirmedAt"
  | "createdAt"
  | "updatedAt"
>;

const safeUserColumns = {
  id: users.id,
  email: users.email,
  firstName: users.firstName,
  lastName: users.lastName,
  role: users.role,
  organizationId: users.organizationId,
  emailConfirmedAt: users.emailConfirmedAt,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
} as const;

export async function createUser(user: InsertUser) {
  return await db.insert(users).values(user).returning();
}

export async function getUserById(id: number) {
  const [user] = await db
    .select(safeUserColumns)
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .limit(1);
  return user ?? null;
}

export async function getUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email.toLowerCase()), isNull(users.deletedAt)))
    .limit(1);
  return user ?? null;
}

export async function getUserByEmailIncludingDeleted(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
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
  return await db.select(safeUserColumns).from(users).where(isNull(users.deletedAt));
}

export async function getUsersByOrganizationId(organizationId: number) {
  return await db
    .select()
    .from(users)
    .where(and(eq(users.organizationId, organizationId), isNull(users.deletedAt)));
}

export async function ensureAdminExists() {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(708341920)`);

    const [admin] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "admin"), isNull(users.deletedAt)))
      .limit(1);

    if (!admin) {
      const [oldestUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(isNull(users.deletedAt))
        .orderBy(asc(users.createdAt), asc(users.id))
        .limit(1);

      if (!oldestUser) return;

      await tx
        .update(users)
        .set({ role: "admin" })
        .where(and(eq(users.id, oldestUser.id), isNull(users.deletedAt)));
    }
  });
}
