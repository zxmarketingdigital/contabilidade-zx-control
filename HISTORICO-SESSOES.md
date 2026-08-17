# Histórico de Sessões — contabilidade-zx-control

> Registro do que foi feito a cada sessão de trabalho neste projeto (mais recente no topo).
> Mantido pelo `/encerrar` via `zx-worklog.py`. Ler no início pra recuperar contexto.

---

## 2026-08-13 — Fix Gemini aposentado (404)

**Feito:** Mesmo defeito do gemini-2.5-flash/2.0-flash aposentado encontrado e corrigido nos 4 repos irmaos da linha de nicho + no setup Semana 1, apos achar na Clinica Cheia (aluno Diogo reportou).
**Fix:** modelo default trocado p/ alias gemini-flash-lite-latest, GEMINI_MODEL opcional com trim+fallback, parser resiliente a part sem text e a thought:true (raciocinio interno).
**Arquivos:** src/gemini/client.ts (contabilidade, corretor) · src/config.ts+src/ia.ts (juridico) · scripts/agent_bant.py+setup/setup_agent.py (semana1) · setup/configure.mjs+setup/smoke.mjs (corretor).
**Deploy:** push origin/main nos 4 (CI verde: 101/164/84 testes). Cascas geradoras (~/.claude/skills/criar-repo-setup-colaborador/templates/) corrigidas junto p/ setup novo nao nascer quebrado; regra registrada na SKILL.md.
**Pendencias:** nenhuma. Aviso enviado no grupo ZX Control 5 com instrucao de git pull + wrangler deploy.

## 2026-07-28 — Demo pública entra direto (sem login) + fonte versionada

**Feito:** a demo publica (demo-contabilidade.zxlab.com.br) passou a abrir direto no painel, sem tela de login — é material de venda que o aluno manda pro cliente. Bypass guardado por `ZX.mode === 'demo'`: script inline pre-paint no <head> marca `html.zx-demo`, CSS esconde #login/#logout e revela #app. Form de login continua no DOM como fallback; logout() remove a classe antes de deslogar.

**Dívida fechada:** a demo publicada NAO tinha fonte no repo (só existiam painel/ e demo/). Criada `demo-publica/` com `build.mjs` que GERA o bundle a partir de painel/ (fonte unica) + o que e exclusivo da demo (mock-api.js, proposta.html, config.js de demo).

**Bug pré-existente corrigido:** GET /prazos sem empresaId devolvia 400 nos mocks, divergindo do Worker real (src/app.ts trata o caso de proposito). As abas Inicio e Relatorio ficavam em spinner eterno — ja estava no ar, escondido atras do login.

**Cache busting:** assets ganham ?v=<hash sha256 do conteudo> no build. Sem isso, quem ja tinha visitado a demo ficava horas com o CSS antigo (max-age=14400, nome fixo) e continuava vendo o login. Foi verificado ao vivo: o CSSOM do browser nao trazia nenhuma regra zx-demo depois do 1o deploy.

**Arquivos:** painel/{app.js,index.html,style.css}, demo/server.mjs, demo-publica/ (nova: build.mjs, mock-api.js, proposta.html, README.md)
**Commits:** 8b497ef, 8988236 na branch feat/demo-visivel (main e protegida/PR-only — branch pushada, PR pendente)
**Deploy:** wrangler pages deploy demo-publica/dist --project-name demo-contabilidade-zx-control — VERIFICADO no browser (abre direto, 12 clientes, agenda populada) e proposta.html intacta (17361 bytes)
**Guard:** pnpm test 101/101. Instalacao real do aluno inalterada (sem a flag, login segue obrigatorio)
**Pendências:** abrir PR de feat/demo-visivel para a main

