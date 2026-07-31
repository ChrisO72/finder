import { Form, useActionData, useNavigation } from "react-router";
import { z } from "zod";
import { FieldError } from "~/components/field-error";
import { FormError } from "~/components/form-error";
import { getAuthenticatedUser } from "~/lib/session.server";
import { getOrganizationById, updateOrganization } from "~/db/repositories/organizations";
import { redirect } from "react-router";
import { Heading } from "~/components/ui-kit/heading";
import { Text } from "~/components/ui-kit/text";
import { Input } from "~/components/ui-kit/input";
import { Textarea } from "~/components/ui-kit/textarea";
import { Button } from "~/components/ui-kit/button";
import { Field, Label, Description } from "~/components/ui-kit/fieldset";
import { env } from "~/env.server";
import { parseForm, type ActionData } from "~/lib/form";
import type { Route } from "./+types/settings";

const settingsSchema = z.object({
  webshareProxyUrl: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() || null : null),
    z.union([z.url("Please enter a valid proxy URL"), z.null()]),
  ),
  youtubeCookies: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() || null : null),
    z.union([z.string(), z.null()]),
  ),
});

type SettingsActionData = ActionData & { success?: boolean };

export async function loader({ context }: Route.LoaderArgs) {
  const user = getAuthenticatedUser(context);

  const org = await getOrganizationById(user.organizationId);
  if (!org) throw redirect("/login");

  return {
    webshareProxyUrl: org.webshareProxyUrl ?? "",
    defaultProxyUrl: env.WEBSHARE_PROXY_URL ?? "",
    youtubeCookies: org.youtubeCookies ?? "",
  };
}

export async function action({ request, context }: Route.ActionArgs): Promise<SettingsActionData> {
  const user = getAuthenticatedUser(context);

  const formData = await request.formData();
  const { data, fieldErrors } = parseForm(formData, settingsSchema);
  if (fieldErrors) return { fieldErrors };

  await updateOrganization(user.organizationId, data);

  return { success: true };
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  const { webshareProxyUrl, defaultProxyUrl, youtubeCookies } = loaderData;
  const actionData = useActionData<SettingsActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="mx-auto max-w-2xl">
      <Heading>Settings</Heading>
      <Text className="mt-1">Organization-level configuration.</Text>

      <Form method="post" className="mt-8 space-y-8">
        <FormError actionData={actionData} />
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
            invalid={!!actionData?.fieldErrors?.webshareProxyUrl}
          />
          <FieldError name="webshareProxyUrl" actionData={actionData} />
        </Field>

        <Field>
          <Label>YouTube Cookies</Label>
          <Description>
            Cookies from an authenticated YouTube session, in Netscape cookies.txt format. Required
            when YouTube blocks downloads with bot detection.{" "}
            <a
              href="https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 underline hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Get YouTube Cookies
            </a>{" "}
            — install this Chrome extension, go to youtube.com while signed in, and export your
            cookies.
          </Description>
          <Textarea
            name="youtubeCookies"
            rows={6}
            resizable
            placeholder={"# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tSID\t..."}
            defaultValue={youtubeCookies}
          />
          <FieldError name="youtubeCookies" actionData={actionData} />
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
