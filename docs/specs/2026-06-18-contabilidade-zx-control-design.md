# Contabilidade ZX Control — Spec de Produto (Design aprovado)

> Data: 18/Jun/2026 · Aprovado por Rafael Castro
> 4º produto de nicho da linha ZX Control v3 (irmãos: Clínica Cheia, Corretor ZX Control, Jurídico ZX Control)
> Desenvolvimento: colaborador externo via PR · DoD: Setup de Nicho v2

## 1. O que é

Mini sistema **white-label** que o aluno ZX Control instala e revende para **contadores solo e
escritórios contábeis pequenos**. O contador faz login, escolhe um dos **5 agentes de IA**, digita ou
cola informações, e a IA processa e gera o resultado (calendário de obrigações, ficha de enquadramento,
comunicado ao cliente, orientação tributária, minuta de resposta ao Fisco) — acelerando tarefas
manuais e burocráticas do dia a dia contábil.

**Persona do comprador final:** contador(a) autônomo ou escritório contábil com 1–10 pessoas, sem
equipe de TI, que atende uma **carteira de empresas-cliente** e perde horas com controle de prazos
fiscais, enquadramento, comunicação com o cliente e redação de respostas a notificações.

## 2. Variante B2 — produto sem upload/leitura de documento (decisão-chave)

Diferente do irmão Jurídico, este produto **não recebe upload de documentos nem usa IA pra ler
PDF/XML**. Motivo: na contabilidade a saída é **quantitativa** (um número mal lido vira lançamento
errado, propaga pra escrituração e pro imposto) — risco que disclaimer não cobre. Portanto:

- **Todos os 5 agentes são texto→texto** (input por formulário/seleção/texto colado, output texto).
- **Nenhum agente lê documento financeiro pela IA.** A IA nunca emite valor extraído de um arquivo.
- Leitura/parse de documento (OFX, XML de NF-e, extrato), apuração fiscal oficial e geração de guias
  ficam **fora da v1** (candidatos a versões futuras, com parser determinístico, nunca via IA).

## 3. Stack (padrão da linha — inegociável)

- **Cloudflare Workers** (API) + **Cloudflare Pages** (painel)
- **Supabase**: Postgres com **RLS obrigatório em toda tabela**, Auth, Storage
- **IA**: Gemini Flash como provider default, **trocável pelo aluno** — model id e provider em
  **constante única** ("um valor, um lugar"), nunca espalhado
- **Vitest** + pnpm + TypeScript
- Estrutura: `src/ tests/ supabase/migrations/ painel/ setup/ demo/ docs/`

## 4. Autenticação (igual ao Jurídico)

- **Supabase Auth email/senha, multi-usuário**: cada pessoa do escritório tem login próprio.
- **Toda rota do Worker é fail-closed**: valida o JWT do Supabase; sem token válido → 401. Nenhuma
  rota nova nasce sem auth.
- Tela de login no painel + logout + indicação do usuário logado.
- Dados compartilhados entre os usuários do mesmo escritório (uma instalação = um escritório). Sem
  multi-tenancy entre escritórios na v1 — cada cliente final recebe a própria instalação.
- **Demo local continua sem credencial**: mock server com login fake (qualquer email/senha entra).

## 5. Os 5 agentes

Cada agente é um card no painel com formulário/texto → resultado renderizado no painel + salvo no
histórico (tabela `saidas_geradas` ou equivalente), exportável. **Todos texto→texto, sem upload.**

### 5.1 Calendário de Obrigações Fiscais
- Input: **regime tributário** + **competência** (mês/ano) da empresa-cliente (seleção/form).
- Output: lista de **obrigações aplicáveis** (DAS, DCTFWeb, EFD-Contribuições, eSocial, etc.) com
  **data fatal calculada em dias úteis** (timezone **America/Sao_Paulo**, feriados nacionais,
  **antecipação de vencimento** quando cai em fim de semana/feriado) + **gravação automática na agenda
  de prazos** do painel.
- O cálculo de dias úteis/feriados/antecipação é função pura testada (Vitest), incluindo casos com
  feriado no meio e vencimento caindo em fim de semana.

### 5.2 Triagem / Enquadramento de Empresa
- Input: dados da empresa em texto livre (atividade/CNAE, faturamento estimado, nº de sócios, etc.).
- Output: **ficha da empresa**, **regime tributário sugerido** (Simples Nacional / Lucro Presumido /
  Lucro Real) com justificativa, **obrigações aplicáveis**, **documentos a solicitar** ao cliente e
  **parecer preliminar de enquadramento** (com ressalva de conferência).

### 5.3 Gerador de Comunicado ao Cliente
- Input: situação do mês digitada pelo contador (valores a pagar, pendências, observações).
- Output: **texto pronto em linguagem simples** pro empresário (o que pagar, prazos, pendências,
  próximos passos), renderizado no painel e exportável (copiar/baixar).

### 5.4 Consultor Tributário / Tira-dúvidas
- Input: pergunta do contador em texto livre.
- Output: **orientação fundamentada** de forma genérica, com disclaimer. **Nunca afirma valor/alíquota
  como definitivo nem cita artigo de lei específico** — sempre remete à conferência da legislação
  vigente (ver §7.2).

### 5.5 Redator de Respostas ao Fisco
- Input: intimação/notificação **colada como texto** (sem upload de arquivo).
- Output: **minuta de resposta/defesa estruturada**, exportável (copiar/baixar), com disclaimer.

## 6. Entidades do painel (CRUD completo — DoD item 3)

Toda entidade listada tem botão "+ Novo" com modal funcional:

1. **Empresas-cliente** (razão social, CNPJ, regime tributário, porte)
2. **Competências** (empresa, mês/ano de referência, status)
3. **Obrigações/Prazos** — agenda com destaque visual para prazos vencendo em **≤5 dias** e vencidos
4. **Saídas geradas** — histórico dos outputs dos agentes (tipo, empresa, data, conteúdo)

> **Não há entidade "Documentos"** — o produto não recebe upload (decisão §2).

## 7. Regras inquebráveis do nicho

1. **Disclaimer obrigatório** em todo output de IA: *"Conteúdo gerado por IA — a conferência pelo
   contador responsável é obrigatória."* Renderizado no painel E embutido em qualquer exportação.
   Teste que falha se remover.
2. **Equivalente à "jurisprudência" do Jurídico:** proibido o prompt **afirmar valor de imposto ou
   alíquota como definitivo** e **inventar artigo de lei / número de norma específico**. Orientação é
   sempre genérica + remissão a "confira a legislação vigente". Alucinação de valor fiscal ou de norma
   é risco profissional grave pro contador. Apuração fiscal oficial e cálculo definitivo de guias
   ficam **explicitamente fora da v1**.
3. **Prazos fiscais sempre em dias úteis, America/Sao_Paulo**, com feriados nacionais e **antecipação
   de vencimento** quando cai em fim de semana/feriado. Nunca usar UTC ou data corrida. Função pura
   testada (Vitest).
4. **LGPD + sigilo fiscal**: dados de empresa/cliente **nunca em log** (nem console.log do Worker, nem
   log do painel). RLS em todas as tabelas.
5. Invariantes da linha (já nos templates): auth fail-closed em toda rota, "um valor, um lugar", DoD
   com teste-que-falha-se-reverter + caminho grava-vs-lê, monolito com higiene (sem split `engine/`
   vs `nicho/`).

> Nota: este produto **não dispara mensagens proativas** (WhatsApp/email) na v1 — os invariantes de
> disparo (rate-cap, dedup, janela, opt-out) não se aplicam, mas a engine de disparo vem congelada na
> casca e permanece reservada para uma futura **notificação de prazo fiscal** (v1.1).

## 8. Demo local (DoD item 4)

`node demo/server.mjs` sobe o painel populado sem credencial:
- Login fake (qualquer email/senha).
- Dados fictícios **realistas do nicho**: ≥10 empresas-cliente (regimes variados: Simples, Presumido,
  MEI, Real), ≥10 competências, ≥10 prazos (alguns vencendo, um vencido), ≥10 saídas geradas com
  conteúdo plausível.
- Agentes respondem com outputs mock pré-gravados (sem chamada de IA real).

## 9. DoD — Setup de Nicho v2 (critério de aceite do PR final)

1. Instalação **guiada** via CLAUDE.md (aluno cola o link do repo no Claude Code; nunca wizard `.mjs`
   como caminho principal)
2. Painel **premium** nos tokens ZX Control (`#0D0D0D`, `#D97706`, Inter + JetBrains Mono — ver
   `docs/DESIGN-TOKENS.md`)
3. **CRUD completo** (§6)
4. **Demo local populada** (§8)
5. **`docs/apresentacao.html`** — LP do setup pro aluno
6. **`docs/proposta.html`** — apresentação comercial white-label com precificação preenchida

Regra transversal: **zero placeholders `{{...}}`** em arquivo entregue. O dev roda `/validar-dod`
antes de abrir o PR; CI perfil `nicho-dod` valida N1–N6.

## 10. Fora de escopo da v1

- Upload/leitura de documentos (decisão §2)
- Apuração fiscal oficial / cálculo definitivo e geração de guias (DAS/DARF reais)
- Integração com SEFAZ / Receita Federal / eSocial / PJe / push de andamentos
- Importação automática de XML/OFX em lote
- Disparo de WhatsApp/email (notificação de prazo) — candidato a v1.1
- Multi-tenancy entre escritórios
