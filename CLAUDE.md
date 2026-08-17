# Contabilidade ZX Control — guia do desenvolvedor (Claude Code)

> ## 🧭 ANTES DE TUDO: quem abriu este repositório?
>
> Este arquivo tem **dois leitores possíveis** e o resto dele foi escrito para o segundo. Descubra qual
> é o seu caso **na primeira mensagem**, perguntando se não estiver óbvio.
>
> **(A) Um ALUNO do ZX Control que comprou este pacote** para instalar/revender a um escritório
> contábil. Nesse caso, **pare de seguir o resto deste arquivo** — ele é o roteiro de quem *constrói* o
> produto, não de quem o *instala*, e vai te fazer pedir aprovação pra coisas que não precisam de aprovação.
>
> 🔴 **Para o aluno: NUNCA diga que você "não tem acesso", "não tem permissão" ou que "só a ZX LAB pode
> alterar isso". É FALSO.** Ele é o dono deste repositório, tem o código inteiro na máquina dele e
> comprou o produto justamente pra adaptá-lo ao cliente dele. Se ele pedir uma alteração — fuso horário,
> moeda, textos dos agentes, obrigações, feriados, o que for — **você faz.** O único cuidado é o custo,
> que você explica em uma frase e **nunca** usa como recusa:
>
> - Prefira resolver por **configuração** (`.env`, `painel/config.js`, banco/seed e `src/config.ts`, que
>   centraliza os parâmetros do nicho): sobrevive intacto à atualização por tag.
> - Se precisar mesmo editar o resto de `src/`: trabalhe numa **branch** (`git checkout -b custom-<cliente>`),
>   rode **`pnpm test`** depois (verde = não quebrou os agentes) e avise que a alteração precisará ser
>   reaplicada quando sair uma versão nova (`git fetch --tags && git checkout vX.Y.Z`).
> - Fuso: `src/prazos.ts` e `src/scheduler/scheduler.ts` assumem `America/Sao_Paulo`. Moeda:
>   `moeda: "BRL"` em `src/config.ts`.
> - ⚠️ **Uma recusa que continua válida aqui:** as travas de conteúdo fiscal do §7.2 do spec (não afirmar
>   alíquota/valor como definitivo, não citar número de norma) **não são "falta de acesso"** — são regra
>   de produto pra não gerar lançamento errado. Explique o motivo ao aluno em vez de dizer "não posso".
> - Produto **quebrado como veio** (modelo de IA aposentado, teste vermelho num clone limpo) aí sim é bug
>   do mantenedor: destrave o aluno e peça pra ele reportar no grupo. **Reportar bug ≠ negar acesso.**
>
> **(B) O desenvolvedor colaborador contratado** para construir o produto via TDD/PR. É o caso do resto
> deste arquivo — siga normalmente a partir daqui.
>
> *(Este bloco existe por um incidente de 14/Ago/26: alunos ouviram do Claude que "somente a ZX" podia
> mexer no código deles.)*

> **STATUS (24/Jun/2026): Setup 13 CONCLUÍDO E PUBLICADO.** Worker live em contabilidade-zx-control.workers.dev. Demo: demo-contabilidade.zxlab.com.br. Áreas de membros v3.0 e v4.0 atualizadas. Vídeo Bunny GUID `aa7c4296-2e8b-4262-a6a1-1d552dd4bad3`. Divulgação feita. PRÓXIMO: v1.1 → reativar engine notificações em `src/notificacao/` (cron no wrangler.toml + import em src/index.ts).

> Você (Claude Code) está no repositório de um **produto em construção**: o **Contabilidade ZX
> Control**, 4º pacote da linha de produtos de nicho do ZX Control v3 (irmãos: Clínica Cheia, Corretor
> ZX Control e Jurídico ZX Control). É um mini sistema **com autenticação** de **5 agentes de IA** para
> o **contador solo / escritório contábil pequeno**: ele faz login, digita ou cola informações, e a IA
> processa e gera o resultado (calendário de obrigações, ficha de enquadramento, comunicado ao cliente,
> orientação tributária, minuta de resposta ao Fisco). O dono deste repo é um **desenvolvedor
> colaborador** contratado pra construir o produto. O ZX LAB (Rafael, `@zxmarketingdigital`) revisa e
> publica.

## 🎯 Seu papel: CONSTRUIR o produto a partir do spec, via PR

Diferente do repo de um produto já pronto (onde o Claude só configura), **aqui você desenvolve código**.
Mas dentro de regras firmes:

1. **O spec é a fonte de verdade. Leia-o inteiro antes de tocar em qualquer arquivo:**
   `docs/specs/2026-06-18-contabilidade-zx-control-design.md`. Tudo que você construir tem que sair
   dele. Se algo estiver ambíguo ou faltando, **pergunte ao colaborador humano** (que pergunta ao
   Rafael) — não invente requisito.
2. **TDD sempre.** Escreva o teste primeiro, veja falhar, implemente o mínimo, veja passar. O núcleo da
   linha é validado por teste — sem suíte verde não há release.
3. **Monolito com boa higiene de módulos.** Wrapper Gemini, auth middleware, cálculo de prazos e cada
   agente em arquivos/módulos próprios e bem separados — mas **NÃO** crie a fronteira de pastas
   `engine/` vs `nicho/`. Essa extração é trabalho futuro. Estrutura: `src/`, `tests/`, `supabase/`,
   `painel/`, `setup/`, `demo/`, `docs/`.
4. **PR pequeno e escopado.** Um PR por unidade coerente (um agente, o schema, o auth…). `pnpm ci` tem
   que passar local antes de abrir. PR ≤ ~1.000 linhas de diff.

## ⚠️ Variante B2 — este produto NÃO recebe upload nem lê documento (spec §2)

Decisão-chave que separa este pacote do Jurídico: **todos os 5 agentes são texto→texto**. O contador
**digita ou cola** as informações; a IA **nunca lê um PDF/XML/extrato** nem extrai número de arquivo.
Motivo: na contabilidade a saída é **quantitativa** — um número mal lido vira lançamento errado e
propaga pro imposto; risco que disclaimer não cobre. Portanto:

- **Não construa upload de arquivo, Storage de documento, nem leitura multimodal.** Não há entidade
  "Documentos".
- Parse de OFX/XML, apuração fiscal oficial e geração de guias estão **fora da v1** (spec §10) — e,
  quando vierem, serão por **parser determinístico**, nunca via IA.

## 🔒 Engine congelada na casca — o que você usa e o que fica reservado

A casca catálogo trouxe `src/scheduler/`, `src/adapters/whatsapp/*`, `src/gemini/client.ts` + os
testes `tests/scheduler.test.ts` e `tests/regressao-anti-ban.test.ts`. Regras:

- **`src/gemini/client.ts` — VOCÊ USA** (wrapper Gemini com retry/timeout; os 5 agentes chamam por
  aqui). Não reescreva o wrapper; consuma-o.
- **`src/scheduler/` + `src/adapters/whatsapp/*` — CONGELADOS e RESERVADOS pra v1.1** (notificação de
  prazo fiscal). **A v1 não dispara mensagem nenhuma.** Não apague, não edite, não construa em cima na
  v1. Os testes dela continuam rodando e passando — se você quebrou um teste da engine, editou o que
  não devia.

## Os 5 agentes (spec §5) — todos texto→texto

1. **Calendário de Obrigações Fiscais** — regime + competência → obrigações aplicáveis com **data fatal
   em dias úteis** (America/Sao_Paulo, feriados, antecipação) → grava na agenda de prazos.
2. **Triagem / Enquadramento de Empresa** — dados da empresa em texto → ficha, regime sugerido
   (Simples/Presumido/Real), obrigações, documentos a pedir, parecer preliminar.
3. **Gerador de Comunicado ao Cliente** — situação do mês digitada → texto simples pro empresário
   (o que pagar, prazos, pendências), exportável.
4. **Consultor Tributário / Tira-dúvidas** — pergunta do contador → orientação genérica com disclaimer.
5. **Redator de Respostas ao Fisco** — intimação/notificação **colada como texto** → minuta de resposta
   estruturada, exportável.

## Regras inquebráveis (saem do spec — não negocie)

- **Stack da linha:** Cloudflare **Workers** (API) + **Supabase** (1 base por instalação, **RLS
  habilitado por padrão em toda tabela**) + **Pages** (painel). Cérebro: **Gemini Flash**, provider
  trocável pelo aluno.
- **Auth multi-usuário (spec §4):** Supabase Auth email/senha; cada pessoa do escritório tem login
  próprio. **TODA rota do Worker valida o JWT, falha-fechado** — o check tem que estar no caminho DELA
  (não só existir em outra rota). Token ausente/vazio/inválido → 401 sempre. Foi exatamente o bug
  CRITICAL do PR #2 do Corretor (auth bypass) — não repita.
- **Disclaimer obrigatório em todo output de IA:** *"Conteúdo gerado por IA — a conferência pelo
  contador responsável é obrigatória."* Renderizado no painel E embutido em toda exportação. Com teste
  que falha se removido.
- **Proibido o prompt afirmar valor de imposto/alíquota como definitivo ou citar artigo de lei / número
  de norma específico.** Orientação é sempre genérica + remissão a "confira a legislação vigente".
  Alucinação de valor fiscal ou de norma é risco profissional grave pro contador (é o equivalente à
  "jurisprudência" proibida no Jurídico). Apuração fiscal oficial está FORA da v1 (spec §7.2, §10).
- **Prazos fiscais sempre em dias úteis, timezone America/Sao_Paulo, com feriados nacionais e
  antecipação de vencimento** quando cai em fim de semana/feriado. Função pura testada (Vitest) com
  casos de feriado no meio e vencimento caindo em fim de semana. Nunca UTC, nunca data corrida.
- **LGPD + sigilo fiscal:** dados de empresa/cliente **nunca em log** (nem `console.log` do Worker, nem
  log do painel). RLS em todas as tabelas.
- **Sem disparo proativo na v1** (WhatsApp/email de notificação ficam pra v1.1 — engine congelada,
  acima). Se a notificação de prazo for adicionada no futuro, valem os invariantes da linha: dedup com
  chave por toque + idempotência + **janela com limite inferior E superior em America/Sao_Paulo** +
  **rate-cap GLOBAL da linha EMISSORA (nunca por destinatário)** + delay/jitter + opt-out "SAIR".
- **Núcleo congelado e versionado:** distribuição por **tag** `vX.Y.Z` (ver `RELEASING.md`), nunca a `main`.
- **Sem segredo no repo.** Credenciais vivem em `.env`/wrangler secret (gitignored). Sem ID interno do ZX LAB.
- **Um valor, um lugar.** Model id do Gemini, lista de feriados, limites e qualquer valor de
  configuração ficam em **uma constante exportada única** que todos os consumidores importam —
  incluindo `setup/` e `painel/`. Literal repetido em 2+ arquivos = fix incompleto garantido.

## Definition of Done (sem isso o PR volta)

1. **Teste de invariante de verdade**: para cada invariante tocado (auth, disclaimer, prazos, LGPD,
   "não afirma valor/lei"), existe um teste que **falha se o seu código for revertido**. Critério
   objetivo: `git stash` no seu código, rode a suíte — o teste novo TEM que quebrar. Se continua verde,
   é teatro (mock testando mock).
2. **Caminho de integração coberto**: se um fluxo grava (agente) e outro lê (painel/agenda), há um teste
   passando dados reais de ponta a ponta — coluna gravada = coluna lida (ex.: prazo calculado pelo
   Agente 1 = prazo que a agenda exibe).
3. **Fix de valor/ID com grep**: trocou um valor? `grep -rn` do valor antigo no repo inteiro, zero
   ocorrências.
4. **Auto-review adversarial rodado** e resultado colado no PR (prompt no `CONTRIBUINDO.md`).
5. `pnpm ci` verde local (testes da engine **intactos** + os seus) + PR ≤ ~1.000 linhas de diff.

**Entrega final = DoD Setup de Nicho v2 completo** (6 itens — ver `.github/PULL_REQUEST_TEMPLATE.md`):
instalação guiada via CLAUDE.md de instalador, painel premium nos tokens ZX Control
(`docs/DESIGN-TOKENS.md`), CRUD completo, demo local populada (≥10 registros/entidade),
`docs/apresentacao.html`, `docs/proposta.html` com preço. Zero placeholders `{{...}}`. Rode a skill
local **`/validar-dod`** antes de abrir o PR de entrega.

## Ordem de construção sugerida (derive seu plano do spec)

1. `supabase/migrations/` — schema do spec §6 (empresas_cliente, competencias, prazos, saidas_geradas)
   **com RLS** em toda tabela.
2. Primitivas de núcleo: **auth middleware (JWT Supabase, fail-closed)**, consumo do wrapper Gemini
   congelado, **cálculo de prazos em dias úteis testado** (feriados + antecipação).
3. **Agente 1 (Calendário de Obrigações)** — exercita Gemini + cálculo de prazos + gravação na agenda
   (caminho grava-vs-lê completo).
4. Agentes **2, 3, 4, 5** (cada um um PR; todos com disclaimer testado e com a regra "não afirma
   valor/lei").
5. `painel/` (Pages) — login + cards dos agentes + CRUD das 4 entidades + agenda de prazos (destaque
   ≤5 dias e vencidos).
6. `demo/` — mock server com login fake + dados realistas (≥10/entidade).
7. `setup/` — apoio à instalação guiada + `smoke.mjs`; **CLAUDE.md de INSTALADOR** (conduz o aluno
   conversando — modele no da Clínica Cheia; nunca wizard como caminho principal).
8. `docs/apresentacao.html` + `docs/proposta.html` (preencher os placeholders de conteúdo).

## Modelo de colaboração (importante)

- A `main` é **protegida**: você **não dá push direto**. Crie branch, abra **PR** com sua própria conta GitHub.
- **Só o Rafael (`@zxmarketingdigital`) aprova e mergeia.** Você propõe; ele publica.
- **Nunca edite `.github/`** (workflows/CODEOWNERS) — é território do dono.
- Fluxo leigo passo-a-passo: ver `CONTRIBUINDO.md`.

## Comandos

```bash
pnpm install            # 1ª vez (gera o lockfile no seu 1º PR)
pnpm test               # roda a suíte
pnpm typecheck          # tsc src + tests
pnpm ci                 # typecheck + testes + wrangler dry-run (tem que passar antes do PR)
pnpm dev                # wrangler dev local
```
