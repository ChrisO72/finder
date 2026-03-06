import { Mistral } from "@mistralai/mistralai";

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });

const EMBEDDING_MODEL = "mistral-embed";
const BATCH_SIZE = 64;

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const result = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      inputs: batch,
    });

    for (const item of result.data) {
      embeddings.push(item.embedding as number[]);
    }
  }

  return embeddings;
}

export async function embedQuery(text: string): Promise<number[]> {
  const result = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    inputs: [text],
  });

  return result.data[0].embedding as number[];
}
