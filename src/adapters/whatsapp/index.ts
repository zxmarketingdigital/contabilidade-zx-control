import { EvolutionAdapter } from "./evolution";
import type { WhatsAppAdapter } from "./types";

export type { IncomingMessage, WhatsAppAdapter, WhatsAppStatus } from "./types";
export { EvolutionAdapter, WhatsAppError } from "./evolution";

export function createAdapter(env: {
  WHATSAPP_PROVIDER: string;
  EVOLUTION_URL: string;
  EVOLUTION_INSTANCE: string;
  EVOLUTION_API_KEY: string;
}): WhatsAppAdapter {
  switch (env.WHATSAPP_PROVIDER) {
    case "evolution":
    default:
      return new EvolutionAdapter(env);
  }
}
