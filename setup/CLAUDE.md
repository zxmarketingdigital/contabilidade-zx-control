# Instalação guiada — Contabilidade ZX Control (você, Claude Code, conduz o aluno)

> Este arquivo é o **roteiro de INSTALAÇÃO** (diferente do `CLAUDE.md` da raiz, que é o guia de
> desenvolvimento). Quando alguém clonou este repositório e pediu pra "instalar o setup", **você
> conduz a instalação conversando** — um passo de cada vez, uma credencial de cada vez, explicando
> onde pegar cada coisa. **Nunca** rode um wizard `.mjs` como caminho principal: a instalação é
> guiada por você, no diálogo. (O `setup/smoke.mjs` é só o teste final, não um instalador.)

## Tom e ritmo (importante)

- Fale como quem está ao lado do aluno. Pergunte **uma coisa de cada vez** e espere a resposta.
- O aluno **não programa**. Você escreve os arquivos e roda os comandos; ele só cola credenciais e confirma.
- A cada passo, diga **o que vai fazer**, faça, e **mostre o resultado** antes de seguir.
- Se algo falhar, **pare e conserte** com ele — não empurre pro próximo passo.

## Antes de começar — confirme as 3 contas

Este produto é **texto→texto, com login, sem WhatsApp na v1**. Você precisa de 3 contas (pergunte se o
aluno tem todas em mãos antes de prosseguir):

1. **Supabase** — banco + login do escritório (Project URL + `service_role` key + `anon` key).
2. **Cloudflare** — hospeda o Worker (API dos agentes) e o painel (Pages). Wrangler logado.
3. **Google Gemini** — chave em `aistudio.google.com/apikey` (tem free tier).

> Não há Evolution/WhatsApp na v1. Se o aluno perguntar, explique que a notificação de prazo é uma
> versão futura (v1.1) — a engine vem reservada, mas o produto v1 não dispara mensagem.

## Passo a passo (conduza um de cada vez)

1. **Boas-vindas e checagem.** Apresente o produto em 2 frases e confirme as 3 contas.
2. **Nome do escritório.** Pergunte o nome (vai no painel e nas saídas) → `ESCRITORIO_NOME`.
3. **Supabase.** Peça, **uma de cada vez**: `SUPABASE_URL` (Project Settings ▸ API ▸ Project URL),
   `SUPABASE_SERVICE_KEY` (mesma tela ▸ service_role — secreta) e a `anon` key (pro painel).
4. **Gemini.** Peça `GEMINI_API_KEY` e explique onde gerar.
5. **Escreva os configs.** Crie o `.env` (a partir de `.env.example`). Para o painel, **copie o
   template** `cp painel/config.example.js painel/config.js` e preencha os 5 campos de `window.ZX`:
   `mode: "prod"`, `apiBase` (URL do Worker + `/api`), `supabaseUrl`, `supabaseAnonKey` (a `anon` key —
   pública por design) e `prazoAlertaDias`. **`.env` e `painel/config.js` não vão pro git** (já no
   `.gitignore`); o `config.example.js` SIM é versionado. Nunca commite credencial.
6. **Aplique o banco.** Rode as migrations de `supabase/migrations/` no Supabase do escritório
   (RLS já vem habilitado em toda tabela). Confirme que as **8 tabelas** existem: `empresas_cliente`,
   `competencias`, `prazos`, `saidas_geradas` (núcleo) + `leads`, `receitas`, `custos` (CRM/Financeiro)
   + `disparos` (reservado v1.1, fica vazio na v1).
7. **Deploy.** `wrangler deploy` (Worker) e `wrangler pages deploy painel/` (painel). Configure os
   secrets do Worker (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GEMINI_API_KEY`) com `wrangler secret put`.
8. **Primeiro usuário.** Crie o primeiro login do escritório no Supabase Auth (email/senha) e mostre
   ao aluno como adicionar os demais.
9. **Smoke test.** Rode `node setup/smoke.mjs` apontando pro Worker no ar (veja o cabeçalho do arquivo).
   Ele confirma que a auth está **fail-closed** (sem token → 401). Se passar, a instalação está pronta.

## Regras inquebráveis (não negocie)

- **Sem credencial no git.** `.env` e chaves vivem fora do repositório (gitignored / `wrangler secret`).
- **Não toque em `src/`** — o núcleo é congelado e versionado por tag.
- **RLS em toda tabela** — não desabilite. Confirme que ficou ligado após as migrations.
- **Disclaimer e "não afirma valor/lei"** já estão embutidos no produto — não remova.

Ao terminar, mostre ao aluno o painel no ar e a `docs/apresentacao.html` para ele revender.
