# Como contribuir (passo a passo)

Este repositório segue o modelo **"você propõe, o ZX LAB publica"**. Você desenvolve numa branch e abre
um **Pull Request (PR)**; o Rafael (`@zxmarketingdigital`) revisa, aprova e faz o merge. Você **não**
consegue (nem deve) dar push direto na `main` — ela é protegida.

## Pré-requisitos (uma vez)

1. Tenha uma **conta GitHub própria** (não a do ZX LAB) e **aceite o convite** de colaborador que
   chegou no seu email/GitHub.
2. Abra o repositório no **claude.ai/code** (ou Claude Code local) com a **sua** conta.

## O fluxo de cada tarefa

1. **Diga ao Claude:** *"leia o CLAUDE.md e me conduza"*. Ele lê o `CLAUDE.md` + o spec e propõe o plano.
2. **Crie uma branch** pra tarefa (nunca trabalhe direto na `main`):
   ```bash
   git checkout -b feat/agente-1-atendente
   ```
3. **Desenvolva via TDD** (teste primeiro). Mantenha o PR pequeno e focado num pedaço coerente —
   **máximo ~1.000 linhas de diff** (fora lockfile). Se a feature é maior, abra uma fatia por PR
   (ex.: "camada de dados", "crons", "painel" = 3 PRs, não 1).
4. **Garanta o CI verde local** antes de abrir:
   ```bash
   pnpm ci
   ```
5. **Auto-review adversarial (obrigatório).** Antes de abrir o PR, peça ao SEU Claude Code uma
   revisão tentando **derrubar** o próprio trabalho — não confirmar que está bom. Use este prompt:

   > Revise o diff deste branch contra a main como um revisor adversarial. Para cada lente, tente
   > encontrar um bug real, lendo o código de verdade:
   > (1) **Segurança**: alguma rota nova passa sem auth? Auth falha-aberto com token vazio? RLS faltando?
   > (2) **Persistência**: alguma coluna é gravada com um nome e lida com outro? Algum fluxo
   >     grava-vs-lê só funciona porque o teste mocka os dois lados?
   > (3) **Anti-ban**: o rate-cap conta a linha EMISSORA (global da instância) ou o destinatário?
   >     Há delay/jitter entre envios? Dedup distingue toques diferentes do mesmo agente?
   > (4) **Fix completo**: se troquei algum valor/ID, faça grep do valor antigo no repo INTEIRO
   >     (incluindo setup/, painel/, docs/) e confirme zero ocorrências.
   > Para cada teste novo, responda: "se o código for revertido, esse teste falha?" Se não, é teatro.

   Corrija o que ele achar e **cole o resultado (achados + correções) na descrição do PR**. Custo
   da primeira revisão é seu; o Rafael só revisa o que sobreviveu a ela.
6. **Abra o PR:**
   ```bash
   git push -u origin feat/agente-1-atendente
   gh pr create --fill
   ```
   Preencha o checklist do template.
7. **Avise o Rafael** que o PR está pronto. Ele revisa, comenta ou aprova+mergeia.
8. Se ele pedir ajustes, **faça na mesma branch** e dê push — o PR atualiza sozinho.

## Regras que o CI e a proteção da branch garantem

- Todo PR roda o **CI** (typecheck + testes + wrangler dry-run) e o **smoke-db** (migrations
  aplicadas 2× num Postgres real + RLS obrigatório em toda tabela).
- Todo PR precisa de **1 aprovação do dono do código** (`@zxmarketingdigital`).
- **Sem push direto** na `main`, **sem force-push**, **sem mexer em `.github/`**.
- **Sem segredo** commitado (secret scanning bloqueia).

## Dúvidas de escopo

Se o spec estiver ambíguo ou faltando algo, **pergunte antes de inventar**. Decisão de produto é do
Rafael — registre a dúvida no PR ou avise por fora.
