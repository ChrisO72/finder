import { Form, useLoaderData, useActionData, useNavigation } from "react-router";
import { requireAuth } from "../lib/session.server";
import { getUserById } from "../../db/repositories/users";
import { getOrganizationById, updateOrganization } from "../../db/repositories/organizations";
import { redirect } from "react-router";
import { Heading } from "../components/ui-kit/heading";
import { Text } from "../components/ui-kit/text";
import { Input } from "../components/ui-kit/input";
import { Button } from "../components/ui-kit/button";
import { Field, Label, Description } from "../components/ui-kit/fieldset";
import type { Route } from "./+types/settings";

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await requireAuth(request);
  const user = await getUserById(auth.userId);
  if (!user) throw redirect("/login");

  const org = await getOrganizationById(user.organizationId);
  if (!org) throw redirect("/login");

  return {
    webshareProxyUrl: org.webshareProxyUrl ?? "",
    defaultProxyUrl: process.env.WEBSHARE_PROXY_URL ?? "",
  };
}

export async function action({ request }: Route.ActionArgs) {
  const auth = await requireAuth(request);
  const user = await getUserById(auth.userId);
  if (!user) throw redirect("/login");

  const formData = await request.formData();
  const webshareProxyUrl = (formData.get("webshareProxyUrl") as string)?.trim() || null;

  await updateOrganization(user.organizationId, { webshareProxyUrl });

  return { success: true };
}

export default function Settings() {
  const { webshareProxyUrl, defaultProxyUrl } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="mx-auto max-w-2xl">
      <Heading>Settings</Heading>
      <Text className="mt-1">Organization-level configuration.</Text>

      <Form method="post" className="mt-8 space-y-8">
        <Field>
          <Label>Webshare Proxy URL</Label>
          <Description>
            Proxy used for YouTube downloads. Leave empty to use the server default
            {defaultProxyUrl ? " (configured via environment variable)" : " (none configured)"}.
          </Description>
          <Input
            name="webshareProxyUrl"
            type="url"
            placeholder={defaultProxyUrl || "http://user:pass@host:port"}
            defaultValue={webshareProxyUrl}
          />
        </Field>

        <div className="flex items-center gap-4">
          <Button type="submit" color="dark/zinc" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
          {actionData?.success && !isSubmitting && (
            <Text className="text-green-600 dark:text-green-400">Settings saved.</Text>
          )}
        </div>
      </Form>
    </div>
  );
}
