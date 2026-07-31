import { XMarkIcon } from "@heroicons/react/16/solid";
import { useState } from "react";
import { useFetcher } from "react-router";
import { z } from "zod";
import { Badge } from "~/components/ui-kit/badge";
import { Button } from "~/components/ui-kit/button";
import { Description, Field, FieldGroup, Fieldset, Label } from "~/components/ui-kit/fieldset";
import { Heading } from "~/components/ui-kit/heading";
import { Input } from "~/components/ui-kit/input";
import { Switch, SwitchField } from "~/components/ui-kit/switch";
import { getSiteSettings, updateSiteSettings } from "~/db/repositories/settings";
import type { ActionData, FieldErrors } from "~/lib/form";
import { requireAdmin } from "~/lib/session.server";
import type { Route } from "./+types/index";

const settingsSchema = z.object({
  allowedDomains: z.array(z.string().trim().min(1)).default([]),
  requireMailConfirmation: z.boolean().default(false),
});

export async function loader({ context }: Route.LoaderArgs) {
  requireAdmin(context);
  return { settings: await getSiteSettings() };
}

export async function action({ request, context }: Route.ActionArgs): Promise<ActionData> {
  requireAdmin(context);

  const formData = await request.formData();
  const result = settingsSchema.safeParse({
    allowedDomains: formData.getAll("allowedDomains").map(String),
    requireMailConfirmation: formData.get("requireMailConfirmation") === "true",
  });
  if (!result.success) {
    return {
      fieldErrors: z.flattenError(result.error).fieldErrors as FieldErrors,
    };
  }

  await updateSiteSettings(result.data);
  return {};
}

export default function AdminSettingsPage({ loaderData }: Route.ComponentProps) {
  const { settings } = loaderData;
  const fetcher = useFetcher<typeof action>();
  const [domains, setDomains] = useState<string[]>(settings.allowedDomains ?? []);
  const [domainInput, setDomainInput] = useState("");
  const [mailConfirmation, setMailConfirmation] = useState(settings.requireMailConfirmation);

  const addDomain = () => {
    const value = domainInput.trim().toLowerCase();
    if (value && !domains.includes(value)) {
      setDomains([...domains, value]);
    }
    setDomainInput("");
  };

  const isSaving = fetcher.state !== "idle";
  const saved =
    fetcher.state === "idle" &&
    fetcher.data !== undefined &&
    !fetcher.data.fieldErrors &&
    !fetcher.data.formError;

  return (
    <div>
      <Heading>Site settings</Heading>
      <fetcher.Form method="PUT" className="mt-8 max-w-2xl">
        <Fieldset>
          <FieldGroup>
            <Field>
              <Label>Allowed signup domains</Label>
              <Description>
                Only users with email addresses from these domains can create an account. Leave
                empty to allow all domains.
              </Description>
              <div className="mt-3 flex gap-2">
                <Input
                  value={domainInput}
                  onChange={(event) => setDomainInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addDomain();
                    }
                  }}
                  placeholder="example.com"
                  className="flex-1"
                />
                <Button type="button" onClick={addDomain} outline>
                  Add
                </Button>
              </div>
              {domains.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {domains.map((domain) => (
                    <Badge key={domain} color="zinc">
                      {domain}
                      <button
                        type="button"
                        onClick={() => setDomains(domains.filter((item) => item !== domain))}
                        className="-mr-0.5 ml-1 inline-flex items-center"
                      >
                        <XMarkIcon className="size-3.5" />
                      </button>
                      <input type="hidden" name="allowedDomains" value={domain} />
                    </Badge>
                  ))}
                </div>
              )}
            </Field>
            <SwitchField>
              <Label>Require mail confirmation</Label>
              <Description>
                New users must confirm their email address before they can sign in.
              </Description>
              <Switch
                name="requireMailConfirmation"
                checked={mailConfirmation}
                onChange={setMailConfirmation}
                color="dark/zinc"
              />
              <input
                type="hidden"
                name="requireMailConfirmation"
                value={String(mailConfirmation)}
              />
            </SwitchField>
          </FieldGroup>
        </Fieldset>
        <div className="mt-8 flex items-center gap-4">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save settings"}
          </Button>
          {saved && (
            <span className="text-sm text-green-600 dark:text-green-400">Settings saved.</span>
          )}
        </div>
      </fetcher.Form>
    </div>
  );
}
