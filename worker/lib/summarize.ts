import { Mistral } from "@mistralai/mistralai";
import { withRetry } from "./retry";

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });

export async function generateSummary(transcript: string): Promise<string> {
  const result = await withRetry(
    () =>
      client.chat.complete({
        model: "mistral-small-latest",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that summarizes video transcripts. " +
              "Produce a concise summary of 2-3 paragraphs covering the key topics, " +
              "takeaways, and themes. Write in plain prose, no bullet points or headings. " +
              "IMPORTANT: Write the summary in the same language as the transcript.",
          },
          { role: "user", content: transcript },
        ],
        maxTokens: 1024,
      }),
    "generate summary",
  );

  const choice = result.choices?.[0];
  if (!choice || typeof choice.message.content !== "string") {
    throw new Error("Failed to generate summary: empty response from Mistral");
  }

  return choice.message.content.trim();
}
