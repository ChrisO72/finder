const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const status = extractStatus(err);
      const retryable = status !== undefined && (status === 429 || status >= 500);

      if (!retryable || attempt === MAX_RETRIES) throw err;

      const delay = BASE_DELAY_MS * 2 ** attempt;
      console.warn(
        `[Retry] ${label} failed (status ${status}), attempt ${attempt + 1}/${MAX_RETRIES} — retrying in ${delay}ms`,
      );
      await sleep(delay);
    }
  }

  throw new Error("unreachable");
}

function extractStatus(err: unknown): number | undefined {
  if (err && typeof err === "object" && "statusCode" in err) {
    return (err as { statusCode: number }).statusCode;
  }
  if (err && typeof err === "object" && "status" in err) {
    return (err as { status: number }).status;
  }
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/Status (\d{3})/);
  return match ? Number(match[1]) : undefined;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
