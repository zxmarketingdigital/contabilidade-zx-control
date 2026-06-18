# Contabilidade ZX Control

4º pacote da **linha de produtos de nicho do ZX Control v3** (irmãos: Clínica Cheia, Corretor ZX
Control e Jurídico ZX Control). Um mini sistema **com autenticação** de **5 agentes de IA** para o
**contador solo / escritório contábil pequeno**, que o aluno do ZX Control instala e revende ao
escritório.

> **Status:** em desenvolvimento (`v0.x`). O design está aprovado e congelado em
> [`docs/specs/2026-06-18-contabilidade-zx-control-design.md`](docs/specs/2026-06-18-contabilidade-zx-control-design.md).

## Os 5 agentes

1. **Calendário de Obrigações Fiscais** — regime + competência → obrigações aplicáveis com data fatal em dias úteis (feriados + antecipação), gravada na agenda.
2. **Triagem / Enquadramento de Empresa** — dados da empresa em texto → ficha, regime sugerido, obrigações, documentos a pedir, parecer preliminar.
3. **Gerador de Comunicado ao Cliente** — situação do mês → texto simples pro empresário (o que pagar, prazos, pendências).
4. **Consultor Tributário / Tira-dúvidas** — pergunta do contador → orientação com disclaimer.
5. **Redator de Respostas ao Fisco** — intimação colada como texto → minuta de resposta estruturada.

> **Variante B2:** todos os agentes são **texto→texto**. O produto **não recebe upload nem lê
> documento** — na contabilidade um número mal lido pela IA propaga pro imposto. Ver spec §2.

## Stack

Cloudflare Workers + Supabase (Auth multi-usuário, RLS) · Cloudflare Pages (painel) · Gemini Flash
(provider trocável) · Vitest.

## Desenvolvimento

Se você é o desenvolvedor colaborador: **leia o [`CLAUDE.md`](CLAUDE.md)** — ele te conduz. Fluxo de
contribuição em [`CONTRIBUINDO.md`](CONTRIBUINDO.md). Processo de release em [`RELEASING.md`](RELEASING.md).

```bash
pnpm install
pnpm ci      # typecheck + testes + wrangler dry-run
```
