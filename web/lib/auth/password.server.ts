import bcrypt from "bcrypt";
import { ensureAdminExists, getUserByEmail, getUserById } from "~/db/repositories/users";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function validateLogin(email: string, password: string) {
  const user = await getUserByEmail(email);
  if (!user || !user.passwordHash) return null;

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;
  await ensureAdminExists();
  return getUserById(user.id);
}
