import { z } from "zod";

export type FieldErrors = Record<string, string[] | undefined>;

export type ActionData = {
  fieldErrors?: FieldErrors;
  formError?: string;
};

export type ParseFormResult<T> =
  { data: T; fieldErrors: null } | { data: null; fieldErrors: FieldErrors };

export function parseForm<T extends z.ZodType>(
  formData: FormData,
  schema: T,
): ParseFormResult<z.infer<T>> {
  const result = schema.safeParse(Object.fromEntries(formData));
  if (result.success) {
    return { data: result.data, fieldErrors: null };
  }
  return {
    data: null,
    fieldErrors: z.flattenError(result.error).fieldErrors as FieldErrors,
  };
}
