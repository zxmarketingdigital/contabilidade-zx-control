# Notificação de prazo por WhatsApp (v1.1)

Resumo diário dos prazos (vencidos + vencendo em ≤5 dias) no WhatsApp do contador.

## Arquitetura: poller local (pull)

A nuvem **não** alcança a máquina do escritório. Em vez disso, a **máquina puxa**:

```
Cron local (hora em hora)
  └─ poller.mjs  ── GET /notificacao/pendente (Bearer NOTIF_PULL_TOKEN) ─►  Worker
                                                                             │ janela BRT 8–18
                                                                             │ dedup 1x/dia
                                                                             │ rate-cap global
                       ◄──────────── { enviar, texto } ──────────────────────┘
  └─ se enviar: POST /message/sendText  ─►  Evolution LOCAL (localhost) ─► WhatsApp
```

Vantagens para Evolution local: sem túnel, sem expor nada na internet, sem domínio,
e a **chave do WhatsApp nunca sai da máquina**. A decisão anti-ban continua no Worker
(engine congelada `src/scheduler`); o poller é só o transporte.

## Lado do Worker (já no deploy)

- Endpoint `GET /notificacao/pendente`, autenticado por `NOTIF_PULL_TOKEN` (secret).
- Fica **fora** do prefixo `/api` para não tocar no gate JWT do painel.

## Lado da máquina

Config local (fora do repo) em `~/.zx-notif/config.json`:

```json
{
  "workerUrl": "https://<seu-worker>.workers.dev",
  "pullToken": "<NOTIF_PULL_TOKEN>",
  "evolutionUrl": "http://localhost:8080",
  "evolutionInstance": "<instancia>",
  "evolutionApiKey": "<apikey-da-evolution>",
  "numero": "55DDDNUMERO"
}
```

Rodar manualmente: `node setup/notificacao/poller.mjs`
Agendado: Tarefa do Windows chamando o mesmo comando de hora em hora (o Worker
gateia para 1 envio/dia dentro da janela). Requer o PC ligado no horário.
