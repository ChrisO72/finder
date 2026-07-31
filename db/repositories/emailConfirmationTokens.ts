import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db";
import { emailConfirmationTokens, type InsertEmailConfirmationToken, users } from "../schema/auth";

export async function insertEmailConfirmationToken(data: InsertEmailConfirmationToken) {
  const [row] = await db.insert(emailConfirmationTokens).values(data).returning();
  return row;
}

export async function consumeEmailConfirmationToken(token: string) {
  return db.transaction(async (tx) => {
    const [tokenRow] = await tx
      .select({ userId: emailConfirmationTokens.userId })
      .from(emailConfirmationTokens)
      .where(
        and(
          eq(emailConfirmationTokens.token, token),
          gt(emailConfirmationTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!tokenRow) return null;

    const [confirmedUser] = await tx
      .update(users)
      .set({ emailConfirmedAt: new Date() })
      .where(and(eq(users.id, tokenRow.userId), isNull(users.emailConfirmedAt)))
      .returning({ id: users.id, email: users.email });

    if (!confirmedUser) return null;

    await tx
      .delete(emailConfirmationTokens)
      .where(eq(emailConfirmationTokens.userId, tokenRow.userId));
    return confirmedUser;
  });
}

export async function getLatestEmailConfirmationTokenCreatedAt(
  userId: number,
): Promise<Date | null> {
  const [row] = await db
    .select({ createdAt: emailConfirmationTokens.createdAt })
    .from(emailConfirmationTokens)
    .where(eq(emailConfirmationTokens.userId, userId))
    .orderBy(desc(emailConfirmationTokens.createdAt))
    .limit(1);
  return row?.createdAt ?? null;
}
