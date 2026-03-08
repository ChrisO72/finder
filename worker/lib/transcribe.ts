import { Mistral } from "@mistralai/mistralai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { withRetry } from "./retry";

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });

export type TranscriptSegment = {
  text: string;
  startSeconds: number;
  endSeconds: number;
};

export async function transcribeChunk(
  filePath: string,
  chunkOffsetSeconds: number = 0,
): Promise<TranscriptSegment[]> {
  const fileBuffer = await readFile(filePath);
  const fileName = path.basename(filePath);

  const file = new File([fileBuffer], fileName, { type: "audio/webm" });

  const result = await withRetry(
    () =>
      client.audio.transcriptions.complete({
        model: "voxtral-mini-latest",
        file,
        timestampGranularities: ["segment"],
        language: "en",
      }),
    `transcribe ${fileName}`,
  );

  if (!result.segments || result.segments.length === 0) {
    if (result.text && result.text.trim()) {
      return [
        {
          text: result.text.trim(),
          startSeconds: chunkOffsetSeconds,
          endSeconds: chunkOffsetSeconds + 300,
        },
      ];
    }
    return [];
  }

  return result.segments.map((seg) => ({
    text: (seg.text ?? "").trim(),
    startSeconds: (seg.start ?? 0) + chunkOffsetSeconds,
    endSeconds: (seg.end ?? 0) + chunkOffsetSeconds,
  }));
}
