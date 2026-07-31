import type { ActionData } from "~/lib/form";

export function FormError({ actionData }: { actionData?: ActionData | null }) {
  if (!actionData?.formError) return null;
  return (
    <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
      {actionData.formError}
    </div>
  );
}
