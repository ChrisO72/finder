import { Form, redirect, useActionData, useNavigation } from "react-router";
import { z } from "zod";
import { FieldError } from "~/components/field-error";
import { FormError } from "~/components/form-error";
import { AuthLayout } from "~/components/ui-kit/auth-layout";
import { Button } from "~/components/ui-kit/button";
import { Field, Label } from "~/components/ui-kit/fieldset";
import { Heading } from "~/components/ui-kit/heading";
import { Input } from "~/components/ui-kit/input";
import { Strong, Text, TextLink } from "~/components/ui-kit/text";
import { getSiteSettings } from "~/db/repositories/settings";
import { validateLogin } from "~/lib/auth/password.server";
import { createTokens, verifyAccessToken } from "~/lib/auth/tokens.server";
import { parseForm, type ActionData } from "~/lib/form";
import { readAccessTokenCookie, setAuthCookies } from "~/lib/session.server";
import type { Route } from "./+types/login";

const loginSchema = z.object({
  email: z.email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function loader({ request }: Route.LoaderArgs) {
  const accessToken = await readAccessTokenCookie(request);
  if (accessToken && verifyAccessToken(accessToken)) {
    return redirect("/admin");
  }
  return null;
}

export async function action({ request }: Route.ActionArgs): Promise<ActionData | Response> {
  const formData = await request.formData();
  const { data, fieldErrors } = parseForm(formData, loginSchema);
  if (fieldErrors) return { fieldErrors };

  const user = await validateLogin(data.email, data.password);
  if (!user) {
    return { formError: "Invalid email or password" };
  }

  const settings = await getSiteSettings();
  if (settings.requireMailConfirmation && !user.emailConfirmedAt) {
    return redirect(`/check-email?email=${encodeURIComponent(data.email)}`);
  }

  const { accessToken, refreshToken } = await createTokens(user.id, user.email);
  const cookies = await setAuthCookies(accessToken, refreshToken);

  return redirect(user.role === "admin" ? "/admin" : "/", {
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
        <Heading>Sign in to Finder</Heading>
        <FormError actionData={actionData} />
        <Field>
          <Label>Email</Label>
          <Input type="email" name="email" invalid={!!actionData?.fieldErrors?.email} />
          <FieldError name="email" actionData={actionData} />
        </Field>
        <Field>
          <Label>Password</Label>
          <Input type="password" name="password" invalid={!!actionData?.fieldErrors?.password} />
          <FieldError name="password" actionData={actionData} />
        </Field>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Logging in..." : "Login"}
        </Button>
        <Text>
          Don&apos;t have an account?{" "}
          <TextLink href="/signup">
            <Strong>Sign up</Strong>
          </TextLink>
        </Text>
      </Form>
    </AuthLayout>
  );
}
