import type { ActionData } from "~/lib/form";
import { ErrorMessage } from "./ui-kit/fieldset";

export function FieldError({ name, actionData }: { name: string; actionData?: ActionData | null }) {
  const message = actionData?.fieldErrors?.[name]?.[0];
  if (!message) return null;
  return <ErrorMessage>{message}</ErrorMessage>;
}
