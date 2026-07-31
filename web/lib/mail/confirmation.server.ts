import { env } from "~/env.server";
import { CONFIRMATION_TOKEN_EXPIRY_HOURS } from "../auth/email-confirmation.server";
import { sendEmail } from "./client.server";

export async function sendConfirmationEmail(to: string, token: string) {
  const confirmUrl = `${env.APP_URL}/confirm-email?token=${token}`;

  await sendEmail({
    to,
    subject: "Confirm your Finder email address",
    html: [
      "<h2>Confirm your Finder email</h2>",
      "<p>Click the link below to confirm your email address:</p>",
      `<p><a href="${confirmUrl}">${confirmUrl}</a></p>`,
      `<p>This link expires in ${CONFIRMATION_TOKEN_EXPIRY_HOURS} hours.</p>`,
    ].join("\n"),
    text: `Confirm your Finder email address: ${confirmUrl}\n\nThis link expires in ${CONFIRMATION_TOKEN_EXPIRY_HOURS} hours.`,
  });
}
