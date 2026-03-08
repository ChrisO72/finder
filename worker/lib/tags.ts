import { Mistral } from "@mistralai/mistralai";
import { withRetry } from "./retry";

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });

export async function generateTags(summary: string): Promise<string[]> {
  const result = await withRetry(
    () =>
      client.chat.complete({
        model: "mistral-small-latest",
        messages: [
          {
            role: "system",
            content:
              "Extract 3-8 short topic tags from the following video summary. " +
              "Each tag should be 1-3 words, lowercase, and descriptive of a key topic. " +
              "IMPORTANT: Write the tags in the same language as the summary. " +
              'Respond with ONLY a JSON array of strings, e.g. ["machine learning", "python", "data science"]. ' +
              "No explanation, no markdown, just the JSON array.",
          },
          { role: "user", content: summary },
        ],
        maxTokens: 256,
      }),
    "generate tags",
  );

  const choice = result.choices?.[0];
  if (!choice || typeof choice.message.content !== "string") {
    throw new Error("Failed to generate tags: empty response from Mistral");
  }

  const raw = choice.message.content.trim();
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`Failed to parse tags JSON from response: ${raw}`);
  }

  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed) || !parsed.every((t) => typeof t === "string")) {
    throw new Error(`Unexpected tags format: ${JSON.stringify(parsed)}`);
  }

  return parsed.map((t: string) => t.trim().toLowerCase()).filter(Boolean);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
