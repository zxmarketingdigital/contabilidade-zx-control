import type { IncomingMessage, WhatsAppAdapter, WhatsAppStatus } from "./types";

export class WhatsAppError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "WhatsAppError";
  }
}

type EvolutionEnv = {
  EVOLUTION_URL: string;
  EVOLUTION_INSTANCE: string;
  EVOLUTION_API_KEY: string;
};

type FetchLike = (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export class EvolutionAdapter implements WhatsAppAdapter {
  private readonly url: string;
  private readonly instance: string;
  private readonly key: string;
  private readonly fetchFn: FetchLike;

  constructor(env: EvolutionEnv, fetchFn?: FetchLike) {
    this.url = env.EVOLUTION_URL.replace(/\/$/, "");
    this.instance = env.EVOLUTION_INSTANCE;
    this.key = env.EVOLUTION_API_KEY;
    this.fetchFn = fetchFn ?? ((u, i) => fetch(u, i));
  }

  async send(numero: string, mensagem: string): Promise<void> {
    const res = await this.fetchFn(
      `${this.url}/message/sendText/${this.instance}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: this.key,
        },
        body: JSON.stringify({ number: numero, text: mensagem }),
      },
    );
    if (!res.ok) throw new WhatsAppError(`Evolution send falhou: HTTP ${res.status}`, res.status);
  }

  async status(): Promise<WhatsAppStatus> {
    const res = await this.fetchFn(
      `${this.url}/instance/fetchInstances`,
      { headers: { apikey: this.key } } as RequestInit,
    );
    if (!res.ok) return "disconnected";

    // Evolution v2 retorna formato plano {name, connectionStatus}; v1 usava
    // {instance:{instanceName,status}}. Suportamos os dois.
    const data = (await res.json()) as Array<{
      name?: string;
      connectionStatus?: string;
      instance?: { instanceName?: string; status?: string };
    }>;
    const found = data.find(
      (d) => (d.name ?? d.instance?.instanceName) === this.instance,
    );
    if (!found) return "disconnected";
    const s = found.connectionStatus ?? found.instance?.status;
    if (s === "open") return "connected";
    if (s === "connecting") return "qr_needed";
    return "disconnected";
  }

  parseWebhook(body: unknown): IncomingMessage | null {
    if (!body || typeof body !== "object") return null;

    const b = body as Record<string, unknown>;
    if (b["event"] !== "messages.upsert") return null;

    const data = b["data"] as Record<string, unknown> | undefined;
    if (!data) return null;

    const key = data["key"] as Record<string, unknown> | undefined;
    const message = data["message"] as Record<string, unknown> | undefined;
    if (!key || !message) return null;

    const remoteJid = key["remoteJid"];
    const messageId = key["id"];
    if (typeof remoteJid !== "string" || typeof messageId !== "string") return null;

    const text =
      (message["conversation"] as string | undefined) ??
      ((message["extendedTextMessage"] as Record<string, unknown> | undefined)?.["text"] as string | undefined);
    if (!text) return null;

    const from = remoteJid.replace(/@s\.whatsapp\.net$/, "").replace(/@.*$/, "");
    return { from, text, messageId };
  }
}
