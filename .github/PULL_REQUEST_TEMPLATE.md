## O que este PR faz

<!-- Em 1-2 frases. Aponte a seção do spec (docs/specs/) que ele implementa. -->

## Tamanho e escopo

- [ ] PR tem **menos de ~1.000 linhas** de diff (fora lockfile/snapshot). Se passou, divida em fatias — 1 PR por unidade coerente.
- [ ] **Não** editei nada fora do escopo do PR
- [ ] CI verde local: `pnpm ci` passou antes de abrir

## Auto-review adversarial (obrigatório — ver CONTRIBUINDO.md)

- [ ] Rodei o auto-review com as 4 lentes (segurança/RLS · persistência grava-vs-lê · anti-ban · fix completo) **antes** de abrir
- [ ] Colei abaixo o resultado: achados + o que corrigi

<!-- resultado do auto-review aqui -->

## DoD — Setup de Nicho v2 (rode `/validar-dod` antes de abrir o PR)

> PR de entrega final só é aceito com os 6 itens. O CI (perfil `nicho-dod`) valida N1-N6
> mecanicamente. Em PR parcial (uma fatia do produto), marque o que o PR toca e diga o que falta.

- [ ] **N1 · Instalação guiada** — CLAUDE.md de instalação conduz o aluno conversando; instrução de instalação no padrão "cole o link do repo no Claude Code e peça o clone" (nunca wizard `.mjs` como caminho principal)
- [ ] **N2 · Painel premium** — `painel/style.css` usa os tokens do design system ZX Control (`#0D0D0D`, `#D97706`, Inter + JetBrains Mono, badges/estados conforme `DESIGN-TOKENS.md`)
- [ ] **N3 · CRUD completo** — toda entidade listada no painel tem botão "+ Novo" com modal de cadastro funcional
- [ ] **N4 · Demo local** — `demo/server.mjs` + `demo/data.mjs` com dados fictícios REALISTAS do nicho (≥10 registros por entidade principal); `node demo/server.mjs` sobe o painel populado sem nenhuma credencial
- [ ] **N5 · docs/apresentacao.html** — LP do setup pro aluno (o que é, agentes, como funciona, stack, passos da instalação, contas necessárias, operação, CTA com prompt de clone copiável)
- [ ] **N6 · docs/proposta.html** — apresentação comercial white-label pro cliente final, com precificação preenchida (sem placeholder)
- [ ] **Transversal** — ZERO placeholders `{{...}}` sobrando em arquivo entregue

## Checklist de invariantes (linha ZX Control de nicho)

> Cada item abaixo já furou em produção/review. Não marque sem verificar de verdade.

- [ ] Segue o spec em `docs/specs/`
- [ ] **Rota HTTP nova exige auth** (Bearer/secret) — confira que ela passa pelo check, não só que o check existe em outra rota
- [ ] **Auth falha-fechado**: token/secret ausente ou vazio → 401 (nunca aceitar `Bearer ` vazio)
- [ ] Disparo proativo (se tocado): dedup (chave distingue toques) + janela inf/sup em **America/Sao_Paulo** + **rate-cap GLOBAL da linha emissora** (a instância que envia, NUNCA contado por destinatário) + jitter entre envios + opt-out "SAIR"
- [ ] **Coluna gravada = coluna lida**: todo campo que um fluxo grava (import/webhook) é o MESMO que o outro fluxo lê (match/cron). Teste de integração cobrindo o caminho completo, com dados reais do parser
- [ ] **Teste de invariante real**: para cada invariante tocado, existe um teste que **falha se eu reverter meu código** (critério: reverta e rode — se continuar verde, o teste é teatro)
- [ ] **Fix de valor/ID**: rodei `grep -rn` do valor antigo no repo INTEIRO (incluindo `setup/`, `painel/`, docs) — zero ocorrências restantes
- [ ] **Um valor, um lugar**: model ids, janelas, caps e afins em constante única exportada (nunca literal repetido)
- [ ] Matching oferta×perfil é **SQL** (Gemini só pra NL/redação)
- [ ] RLS habilitado nas tabelas novas (o CI `smoke-db` valida)
- [ ] Migration nova é **idempotente** (roda 2× sem erro — o CI valida)
- [ ] Sem segredo/credencial commitada; sem ID interno do ZX LAB

## Como testar

<!-- comandos / passos -->
