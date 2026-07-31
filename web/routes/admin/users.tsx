import { EllipsisHorizontalIcon } from "@heroicons/react/16/solid";
import { redirect, useFetcher, useSubmit } from "react-router";
import { z } from "zod";
import { Dropdown, DropdownButton, DropdownItem, DropdownMenu } from "~/components/ui-kit/dropdown";
import { Heading } from "~/components/ui-kit/heading";
import { Select } from "~/components/ui-kit/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui-kit/table";
import { listUsers, softDeleteUser, updateUser } from "~/db/repositories/users";
import { parseForm } from "~/lib/form";
import { requireAdmin } from "~/lib/session.server";
import type { Route } from "./+types/users";

const ROLES = ["admin", "user", "viewer"] as const;

const deleteUserSchema = z.object({
  id: z.coerce.number({ message: "Invalid user ID" }).positive("Invalid user ID"),
});

const updateRoleSchema = z.object({
  id: z.coerce.number({ message: "Invalid user ID" }).positive("Invalid user ID"),
  role: z.enum(ROLES, { message: "Invalid role" }),
});

export async function loader({ context }: Route.LoaderArgs) {
  const { user: currentUser } = requireAdmin(context);
  return {
    users: await listUsers(),
    currentUserId: currentUser.id,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { user } = requireAdmin(context);
  const formData = await request.formData();

  if (request.method === "DELETE") {
    const { data, fieldErrors } = parseForm(formData, deleteUserSchema);
    if (fieldErrors) return { fieldErrors };
    if (data.id === user.id) {
      return { fieldErrors: { id: ["Cannot delete yourself"] } };
    }
    await softDeleteUser(data.id);
    return redirect(".");
  }

  if (request.method === "PATCH") {
    const { data, fieldErrors } = parseForm(formData, updateRoleSchema);
    if (fieldErrors) return { fieldErrors };
    if (data.id === user.id) {
      return { fieldErrors: { id: ["Cannot change your own role"] } };
    }
    await updateUser(data.id, { role: data.role });
    return redirect(".");
  }

  return null;
}

export default function AdminUsersPage({ loaderData }: Route.ComponentProps) {
  const { users, currentUserId } = loaderData;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <Heading>
          Users
          {users.length > 0 && (
            <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">
              ({users.length} total)
            </span>
          )}
        </Heading>
      </div>
      {users.length === 0 ? (
        <div className="rounded-lg bg-zinc-50 py-12 text-center dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">No users found.</p>
        </div>
      ) : (
        <div className="overflow-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>ID</TableHeader>
                <TableHeader>Email</TableHeader>
                <TableHeader>Name</TableHeader>
                <TableHeader>Role</TableHeader>
                <TableHeader>Created</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.id}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {[user.firstName, user.lastName].filter(Boolean).join(" ") || "-"}
                  </TableCell>
                  <TableCell>
                    <RoleSelect
                      userId={user.id}
                      currentRole={user.role}
                      disabled={user.id === currentUserId}
                    />
                  </TableCell>
                  <TableCell>{user.createdAt.toLocaleDateString()}</TableCell>
                  <TableCell>
                    <UserActions userId={user.id} disabled={user.id === currentUserId} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function RoleSelect({
  userId,
  currentRole,
  disabled,
}: {
  userId: number;
  currentRole: string;
  disabled: boolean;
}) {
  const fetcher = useFetcher();
  const optimisticRole = fetcher.formData ? String(fetcher.formData.get("role")) : currentRole;

  return (
    <Select
      name="role"
      value={optimisticRole}
      disabled={disabled}
      onChange={(event) => {
        fetcher.submit({ id: userId.toString(), role: event.target.value }, { method: "PATCH" });
      }}
    >
      {ROLES.map((role) => (
        <option key={role} value={role}>
          {role.charAt(0).toUpperCase() + role.slice(1)}
        </option>
      ))}
    </Select>
  );
}

function UserActions({ userId, disabled }: { userId: number; disabled: boolean }) {
  const submit = useSubmit();
  return (
    <Dropdown>
      <DropdownButton plain aria-label="More options" disabled={disabled}>
        <EllipsisHorizontalIcon data-slot="icon" />
      </DropdownButton>
      <DropdownMenu>
        <DropdownItem onClick={() => submit({ id: userId.toString() }, { method: "DELETE" })}>
          Delete
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
