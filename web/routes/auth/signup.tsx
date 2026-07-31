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
import { getUserByEmailIncludingDeleted } from "~/db/repositories/users";
import { createEmailConfirmationToken } from "~/lib/auth/email-confirmation.server";
import { createUserWithPassword } from "~/lib/auth/registration.server";
import { createTokens, verifyAccessToken } from "~/lib/auth/tokens.server";
import { parseForm, type ActionData } from "~/lib/form";
import { sendConfirmationEmail } from "~/lib/mail/confirmation.server";
import { readAccessTokenCookie, setAuthCookies } from "~/lib/session.server";
import type { Route } from "./+types/signup";

const signupSchema = z.object({
  email: z.email("Please enter a valid email address"),
  firstname: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function loader({ request }: Route.LoaderArgs) {
  const accessToken = await readAccessTokenCookie(request);
  if (accessToken && verifyAccessToken(accessToken)) {
    return redirect("/");
  }
  return null;
}

export async function action({ request }: Route.ActionArgs): Promise<ActionData | Response> {
  const formData = await request.formData();
  const { data, fieldErrors } = parseForm(formData, signupSchema);
  if (fieldErrors) return { fieldErrors };

  const { email, firstname, password } = data;
  const settings = await getSiteSettings();

  if (settings.allowedDomains.length > 0) {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain || !settings.allowedDomains.includes(domain)) {
      return { formError: "Signups from this email domain are not allowed" };
    }
  }

  const existing = await getUserByEmailIncludingDeleted(email);
  if (existing) {
    if (existing.deletedAt) {
      return { formError: "This account has been deactivated. Contact an administrator." };
    }
    if (settings.requireMailConfirmation && !existing.emailConfirmedAt) {
      return redirect(`/check-email?email=${encodeURIComponent(email)}`);
    }
    return { fieldErrors: { email: ["An account with this email already exists"] } };
  }

  const user = await createUserWithPassword(email, password, firstname);

  if (settings.requireMailConfirmation) {
    const token = await createEmailConfirmationToken(user.id);
    try {
      await sendConfirmationEmail(email, token);
    } catch {
      return {
        formError: "Something went wrong sending the confirmation email. Please try again later.",
      };
    }
    return redirect(`/check-email?email=${encodeURIComponent(email)}`);
  }

  const { accessToken, refreshToken } = await createTokens(user.id, user.email);
  const cookies = await setAuthCookies(accessToken, refreshToken);

  return redirect("/", {
    headers: cookies.map((cookie) => ["Set-Cookie", cookie] as [string, string]),
  });
}

export default function SignupPage() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <AuthLayout>
      <Form method="POST" className="grid w-full max-w-sm grid-cols-1 gap-8">
        <Heading>Create your Finder account</Heading>
        <FormError actionData={actionData} />
        <Field>
          <Label>Email</Label>
          <Input type="email" name="email" invalid={!!actionData?.fieldErrors?.email} />
          <FieldError name="email" actionData={actionData} />
        </Field>
        <Field>
          <Label>First name</Label>
          <Input name="firstname" invalid={!!actionData?.fieldErrors?.firstname} />
          <FieldError name="firstname" actionData={actionData} />
        </Field>
        <Field>
          <Label>Password</Label>
          <Input
            type="password"
            name="password"
            autoComplete="new-password"
            invalid={!!actionData?.fieldErrors?.password}
          />
          <FieldError name="password" actionData={actionData} />
        </Field>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Create account"}
        </Button>
        <Text>
          Already have an account?{" "}
          <TextLink href="/login">
            <Strong>Sign in</Strong>
          </TextLink>
        </Text>
      </Form>
    </AuthLayout>
  );
}
