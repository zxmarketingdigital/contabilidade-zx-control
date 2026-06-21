// ════════════════════════════════════════════════════════════════════════
// Adapter de CAPTURA para o modelo "poller local". No fluxo pull, quem envia o
// WhatsApp é a máquina do escritório (Evolution local), não o Worker. Mas o
// envio continua passando pela engine anti-ban congelada (dispatch): ela faz
// janela + dedup + rate-cap e, em vez de mandar pela rede, "entrega" a mensagem
// aqui. O Worker então devolve o texto capturado para o poller transportar.
//
// Consequência: o registro de "enviado" acontece no hand-off (a engine registra
// ao passar pelos checks). Para um resumo diário 1x/dia é o trade-off certo —
// simples e fiel ao contrato "todo envio proativo passa pela engine".
// ════════════════════════════════════════════════════════════════════════

import type { AdapterLike } from "../scheduler/types";

export class CaptureAdapter implements AdapterLike {
  numero: string | null = null;
  mensagem: string | null = null;
  async send(numero: string, mensagem: string): Promise<void> {
    this.numero = numero;
    this.mensagem = mensagem;
  }
}
