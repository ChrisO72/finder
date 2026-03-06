import type { Route } from "./+types/index";
import {
  listItemsByOrgPaginated,
  countItemsByOrg,
  createItem,
  softDeleteItem,
} from "~/db/repositories/items";
import { requireAuth } from "~/lib/session.server";
import { getUserById } from "~/db/repositories/users";
import { Heading } from "../../components/ui-kit/heading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui-kit/table";
import { CreateItemDialog } from "./CreateItemDialog";
import { Pagination } from "./Pagination";
import { redirect, useSubmit } from "react-router";
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownMenu,
} from "../../components/ui-kit/dropdown";
import { EllipsisHorizontalIcon } from "@heroicons/react/16/solid";
import { z } from "zod";

const createItemSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title too long"),
  description: z.string().max(1000, "Description too long").optional(),
});

const deleteItemSchema = z.object({
  id: z.coerce.number({ message: "Invalid item ID" }).positive("Invalid item ID"),
});

export type ActionData =
  | { success: false; errors: Record<string, string[] | undefined> }
  | undefined;

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await requireAuth(request);
  const user = await getUserById(auth.userId);
  if (!user) throw new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const pageParam = url.searchParams.get("page");
  const pageSizeParam = url.searchParams.get("pageSize");

  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const requestedPageSize = parseInt(pageSizeParam ?? "", 10);
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize)
    ? requestedPageSize
    : DEFAULT_PAGE_SIZE;

  const [items, totalCount] = await Promise.all([
    listItemsByOrgPaginated(user.organizationId, page, pageSize),
    countItemsByOrg(user.organizationId),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    items,
    organizationId: user.organizationId,
    page,
    totalPages,
    totalCount,
    pageSize,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const auth = await requireAuth(request);
  const user = await getUserById(auth.userId);
  if (!user) throw new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const redirectUrl = url.search ? `.${url.search}` : ".";

  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  // Handle DELETE
  if (request.method === "DELETE") {
    const result = deleteItemSchema.safeParse(data);
    if (!result.success) {
      return { success: false, errors: z.flattenError(result.error).fieldErrors };
    }
    await softDeleteItem(result.data.id, user.organizationId);
    return redirect(redirectUrl);
  }

  // Handle POST (create)
  const result = createItemSchema.safeParse(data);
  if (!result.success) {
    return { success: false, errors: z.flattenError(result.error).fieldErrors };
  }

  await createItem({
    organizationId: user.organizationId,
    title: result.data.title,
    description: result.data.description ?? null,
  });

  return redirect(redirectUrl);
}

export default function ManageItemsPage({ loaderData, actionData }: Route.ComponentProps) {
  const { items, page, totalPages, totalCount, pageSize, pageSizeOptions } = loaderData;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col lg:h-[calc(100vh-6rem)]">
      <div className="mb-6 flex shrink-0 items-start justify-between">
        <Heading>
          Manage Items
          {totalCount > 0 && (
            <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">
              ({totalCount} total)
            </span>
          )}
        </Heading>
        <CreateItemDialog />
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg bg-zinc-50 py-12 text-center dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">No items found.</p>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>ID</TableHeader>
                  <TableHeader>Title</TableHeader>
                  <TableHeader>Description</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Priority</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.id}</TableCell>
                    <TableCell>{item.title}</TableCell>
                    <TableCell>{item.description || "-"}</TableCell>
                    <TableCell>{item.status}</TableCell>
                    <TableCell>{item.priority || 0}</TableCell>
                    <TableCell>
                      <ItemActions itemId={item.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="shrink-0">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              limit={pageSize}
              pageSizeOptions={pageSizeOptions}
            />
          </div>
        </>
      )}
    </div>
  );
}

function ItemActions({ itemId }: { itemId: number }) {
  const submit = useSubmit();

  const handleDelete = () => {
    const formData = new FormData();
    formData.append("id", itemId.toString());
    submit(formData, { method: "DELETE" });
  };

  return (
    <Dropdown>
      <DropdownButton plain aria-label="More options">
        <EllipsisHorizontalIcon data-slot="icon" />
      </DropdownButton>
      <DropdownMenu>
        <DropdownItem href={`/manage-items/${itemId}`}>View</DropdownItem>
        <DropdownItem onClick={handleDelete}>Delete</DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
