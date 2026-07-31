import crypto from "crypto";
import {
  consumeEmailConfirmationToken,
  insertEmailConfirmationToken,
} from "~/db/repositories/emailConfirmationTokens";

export const CONFIRMATION_TOKEN_EXPIRY_HOURS = 24;

export async function createEmailConfirmationToken(userId: number): Promise<string> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + CONFIRMATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await insertEmailConfirmationToken({ userId, token, expiresAt });
  return token;
}

export async function confirmUserEmail(token: string) {
  return consumeEmailConfirmationToken(token);
}
