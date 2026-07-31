import { redirect } from "react-router";
import { AuthLayout } from "~/components/ui-kit/auth-layout";
import { Heading } from "~/components/ui-kit/heading";
import { Strong, Text, TextLink } from "~/components/ui-kit/text";
import { confirmUserEmail } from "~/lib/auth/email-confirmation.server";
import { createTokens } from "~/lib/auth/tokens.server";
import { setAuthCookies } from "~/lib/session.server";
import type { Route } from "./+types/confirm-email";

export async function loader({ request }: Route.LoaderArgs) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return { error: "No confirmation token provided." };
  }

  const user = await confirmUserEmail(token);
  if (!user) {
    return { error: "This confirmation link is invalid or has expired." };
  }

  const { accessToken, refreshToken } = await createTokens(user.id, user.email);
  const cookies = await setAuthCookies(accessToken, refreshToken);

  return redirect("/", {
    headers: cookies.map((cookie) => ["Set-Cookie", cookie] as [string, string]),
  });
}

export default function ConfirmEmailPage({ loaderData }: Route.ComponentProps) {
  return (
    <AuthLayout>
      <div className="grid w-full max-w-sm grid-cols-1 gap-6 text-center">
        <Heading>Email confirmation</Heading>
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {loaderData.error}
        </div>
        <Text>
          <TextLink href="/signup">
            <Strong>Sign up again</Strong>
          </TextLink>
          {" or "}
          <TextLink href="/login">
            <Strong>sign in</Strong>
          </TextLink>
        </Text>
      </div>
    </AuthLayout>
  );
}
