export type WhatsAppStatus = "connected" | "disconnected" | "qr_needed";

export interface IncomingMessage {
  from: string;    // número normalizado (só dígitos)
  text: string;
  messageId: string;
}

export interface WhatsAppAdapter {
  send(numero: string, mensagem: string): Promise<void>;
  status(): Promise<WhatsAppStatus>;
  parseWebhook(body: unknown): IncomingMessage | null;
}
