import { Form, useLoaderData, useActionData, useNavigation } from "react-router";
import { requireAuth } from "../lib/session.server";
import { getUserById } from "../../db/repositories/users";
import { getOrganizationById, updateOrganization } from "../../db/repositories/organizations";
import { redirect } from "react-router";
import { Heading } from "../components/ui-kit/heading";
import { Text } from "../components/ui-kit/text";
import { Input } from "../components/ui-kit/input";
import { Textarea } from "../components/ui-kit/textarea";
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
    youtubeCookies: org.youtubeCookies ?? "",
  };
}

export async function action({ request }: Route.ActionArgs) {
  const auth = await requireAuth(request);
  const user = await getUserById(auth.userId);
  if (!user) throw redirect("/login");

  const formData = await request.formData();
  const webshareProxyUrl = (formData.get("webshareProxyUrl") as string)?.trim() || null;
  const youtubeCookies = (formData.get("youtubeCookies") as string)?.trim() || null;

  await updateOrganization(user.organizationId, { webshareProxyUrl, youtubeCookies });

  return { success: true };
}

export default function Settings() {
  const { webshareProxyUrl, defaultProxyUrl, youtubeCookies } = useLoaderData<typeof loader>();
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

        <Field>
          <Label>YouTube Cookies</Label>
          <Description>
            Cookies from an authenticated YouTube session, in Netscape cookies.txt format.
            Required when YouTube blocks downloads with bot detection.{" "}
            <a
              href="https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 underline hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Get YouTube Cookies
            </a>{" "}
            — install this Chrome extension, go to youtube.com while signed in, and export your cookies.
          </Description>
          <Textarea
            name="youtubeCookies"
            rows={6}
            resizable
            placeholder={"# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tSID\t..."}
            defaultValue={youtubeCookies}
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
