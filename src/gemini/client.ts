// gemini-2.0-flash foi aposentado (free tier limit:0 → 429). A linha ZX Control usa 2.5-flash.
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

type FetchLike = (
  url: string,
  init: RequestInit,
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export async function geminiFlash(
  prompt: string,
  env: { GEMINI_API_KEY: string },
  opts: {
    timeoutMs?: number;
    retries?: number;
    _fetch?: FetchLike;
    _delay?: (ms: number) => Promise<void>;
  } = {},
): Promise<string> {
  const { timeoutMs = 10_000, retries = 3 } = opts;
  const fetchFn: FetchLike = opts._fetch ?? ((url, init) => fetch(url, init));
  const delayFn = opts._delay ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  const url = `${GEMINI_URL}?key=${env.GEMINI_API_KEY}`;
  const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });
  const headers = { "Content-Type": "application/json" };

  let lastStatus: number | undefined;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const res = await fetchFn(url, {
        method: "POST",
        headers,
        body,
        signal: ctrl.signal as AbortSignal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new GeminiError("Resposta Gemini sem texto");
        return text;
      }

      lastStatus = res.status;
      if (attempt < retries) await delayFn(500 * 2 ** (attempt - 1));
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof GeminiError) throw err;
      if ((err as { name?: string }).name === "AbortError") {
        throw new GeminiError(`Gemini timeout (${timeoutMs}ms)`);
      }
      if (attempt < retries) {
        await delayFn(500 * 2 ** (attempt - 1));
      } else {
        throw new GeminiError(`Gemini falhou: ${String(err)}`);
      }
    }
  }

  throw new GeminiError(`Gemini HTTP ${lastStatus} após ${retries} tentativas`, lastStatus);
}
