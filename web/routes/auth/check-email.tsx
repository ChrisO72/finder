import { useEffect, useState } from "react";
import { redirect, useFetcher } from "react-router";
import { FormError } from "~/components/form-error";
import { AuthLayout } from "~/components/ui-kit/auth-layout";
import { Button } from "~/components/ui-kit/button";
import { Heading } from "~/components/ui-kit/heading";
import { Strong, Text, TextLink } from "~/components/ui-kit/text";
import { getLatestEmailConfirmationTokenCreatedAt } from "~/db/repositories/emailConfirmationTokens";
import { getUserByEmail } from "~/db/repositories/users";
import { createEmailConfirmationToken } from "~/lib/auth/email-confirmation.server";
import { verifyAccessToken } from "~/lib/auth/tokens.server";
import type { ActionData } from "~/lib/form";
import { sendConfirmationEmail } from "~/lib/mail/confirmation.server";
import { readAccessTokenCookie } from "~/lib/session.server";
import type { Route } from "./+types/check-email";

type ResendActionData = ActionData & { resentAt?: string };

const RESEND_COOLDOWN_MS = 5 * 60 * 1000;

export async function loader({ request }: Route.LoaderArgs) {
  const accessToken = await readAccessTokenCookie(request);
  if (accessToken && verifyAccessToken(accessToken)) {
    return redirect("/");
  }

  const email = new URL(request.url).searchParams.get("email");
  if (!email) {
    return { email: null, lastSentAt: null };
  }

  const user = await getUserByEmail(email);
  if (!user || user.emailConfirmedAt) {
    return { email: null, lastSentAt: null };
  }

  const lastSentAt = await getLatestEmailConfirmationTokenCreatedAt(user.id);
  return { email, lastSentAt: lastSentAt?.toISOString() ?? null };
}

export async function action({ request }: Route.ActionArgs): Promise<ResendActionData> {
  const formData = await request.formData();
  const email = String(formData.get("email") || "");
  if (!email) return { formError: "Missing email." };

  const user = await getUserByEmail(email);
  if (!user || user.emailConfirmedAt) {
    return { formError: "No pending confirmation for this email." };
  }

  const lastSentAt = await getLatestEmailConfirmationTokenCreatedAt(user.id);
  if (lastSentAt && Date.now() - lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    return { formError: "Please wait before requesting another email." };
  }

  const token = await createEmailConfirmationToken(user.id);
  try {
    await sendConfirmationEmail(email, token);
  } catch {
    return { formError: "Failed to send email. Please try again later." };
  }

  return { resentAt: new Date().toISOString() };
}

function useCountdown(targetMs: number | null) {
  const [remaining, setRemaining] = useState(() =>
    targetMs ? Math.max(0, Math.ceil((targetMs - Date.now()) / 1000)) : 0,
  );

  useEffect(() => {
    if (!targetMs) {
      setRemaining(0);
      return;
    }
    setRemaining(Math.max(0, Math.ceil((targetMs - Date.now()) / 1000)));
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil((targetMs - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [targetMs]);

  return remaining;
}

export default function CheckEmailPage({ loaderData }: Route.ComponentProps) {
  const { email, lastSentAt } = loaderData;
  const fetcher = useFetcher<typeof action>();
  const actionData = fetcher.data;
  const resentAt = actionData?.resentAt ?? null;
  const effectiveLastSent = resentAt ?? lastSentAt;
  const cooldownEnd = effectiveLastSent
    ? new Date(effectiveLastSent).getTime() + RESEND_COOLDOWN_MS
    : null;
  const remaining = useCountdown(cooldownEnd);
  const isSending = fetcher.state !== "idle";
  const canResend = !!email && remaining <= 0 && !isSending;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <AuthLayout>
      <div className="grid w-full max-w-sm grid-cols-1 gap-6 text-center">
        <Heading>Check your email</Heading>
        <Text>
          We sent you a Finder confirmation link. Check your inbox and click the link to verify your
          email address.
        </Text>
        <FormError actionData={actionData} />
        {resentAt && (
          <div className="rounded-md bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
            Confirmation email resent.
          </div>
        )}
        {email && (
          <fetcher.Form method="POST">
            <input type="hidden" name="email" value={email} />
            <Button type="submit" outline className="w-full" disabled={!canResend}>
              {isSending
                ? "Sending..."
                : remaining > 0
                  ? `Resend in ${minutes}:${String(seconds).padStart(2, "0")}`
                  : "Resend confirmation email"}
            </Button>
          </fetcher.Form>
        )}
        <Text>
          Already confirmed?{" "}
          <TextLink href="/login">
            <Strong>Sign in</Strong>
          </TextLink>
        </Text>
      </div>
    </AuthLayout>
  );
}
