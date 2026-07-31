import { Lettermint } from "lettermint";
import { env } from "~/env.server";

const lettermint = new Lettermint({
  apiToken: env.LETTERMINT_API_KEY,
});

const from = env.MAIL_FROM;

type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail({ to, subject, html, text }: Email) {
  console.log(`[mail] sending email to ${to}`);

  let response;
  try {
    response = await lettermint.email
      .from(from)
      .to(to)
      .subject(subject)
      .html(html)
      .text(text)
      .send();
  } catch (error) {
    console.error(`[mail] Failed to send email to ${to}:`, error);
    throw error;
  }

  console.log(`[mail] sent to ${to} — id: ${response.message_id}, status: ${response.status}`);
}
