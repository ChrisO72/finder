import { Form, redirect, useActionData, useNavigation } from "react-router";
import { z } from "zod";
import { AuthLayout } from "../../components/ui-kit/auth-layout";
import { Button } from "../../components/ui-kit/button";
import { ErrorMessage, Field, Label } from "../../components/ui-kit/fieldset";
import { Heading } from "../../components/ui-kit/heading";
import { Input } from "../../components/ui-kit/input";
import { Strong, Text, TextLink } from "../../components/ui-kit/text";
import { validateLogin, createTokens } from "../../../db/repositories/auth";
import { setAuthCookies } from "../../lib/session.server";
import type { Route } from "./+types/login";

const loginSchema = z.object({
  email: z.email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type ActionData = {
  fieldErrors?: { email?: string[]; password?: string[] };
  formError?: string;
};

export async function loader({ request }: Route.LoaderArgs) {
  const cookieHeader = request.headers.get("Cookie") || "";
  if (cookieHeader.includes("accessToken=")) {
    return redirect("/");
  }
  return null;
}

export async function action({ request }: Route.ActionArgs): Promise<ActionData | Response> {
  const formData = await request.formData();
  const result = loginSchema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    const fieldErrors: ActionData["fieldErrors"] = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof NonNullable<ActionData["fieldErrors"]>;
      if (!fieldErrors[field]) fieldErrors[field] = [];
      fieldErrors[field].push(issue.message);
    }
    return { fieldErrors };
  }

  const { email, password } = result.data;

  const user = await validateLogin(email, password);
  if (!user) {
    return { formError: "Invalid email or password" };
  }

  const { accessToken, refreshToken } = await createTokens(user.id, user.email);
  const cookies = setAuthCookies(accessToken, refreshToken);

  return redirect("/", {
    headers: cookies.map((cookie) => ["Set-Cookie", cookie] as [string, string]),
  });
}

export default function LoginPage() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <AuthLayout>
      <Form method="POST" className="grid w-full max-w-sm grid-cols-1 gap-8">
        <Heading>Sign in to your account</Heading>

        {actionData?.formError && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {actionData.formError}
          </div>
        )}

        <Field>
          <Label>Email</Label>
          <Input type="email" name="email" invalid={!!actionData?.fieldErrors?.email} />
          {actionData?.fieldErrors?.email && (
            <ErrorMessage>{actionData.fieldErrors.email[0]}</ErrorMessage>
          )}
        </Field>
        <Field>
          <Label>Password</Label>
          <Input type="password" name="password" invalid={!!actionData?.fieldErrors?.password} />
          {actionData?.fieldErrors?.password && (
            <ErrorMessage>{actionData.fieldErrors.password[0]}</ErrorMessage>
          )}
        </Field>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Logging in..." : "Login"}
        </Button>
        <Text>
          Don't have an account?{" "}
          <TextLink href="/signup">
            <Strong>Sign up</Strong>
          </TextLink>
        </Text>
      </Form>
    </AuthLayout>
  );
}
