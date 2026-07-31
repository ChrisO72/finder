import { createOrganization } from "~/db/repositories/organizations";
import { createUser, ensureAdminExists, getUserById } from "~/db/repositories/users";
import { hashPassword } from "./password.server";

export async function createUserWithPassword(email: string, password: string, firstname?: string) {
  const passwordHash = await hashPassword(password);
  const [organization] = await createOrganization({
    name: `${firstname || email}'s Organization`,
  });

  const [user] = await createUser({
    email: email.toLowerCase(),
    passwordHash,
    firstName: firstname || null,
    organizationId: organization.id,
    role: "user",
  });

  await ensureAdminExists();
  const registeredUser = await getUserById(user.id);
  if (!registeredUser) {
    throw new Error("Registered user could not be loaded");
  }
  return registeredUser;
}
