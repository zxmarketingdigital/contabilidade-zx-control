# Design Tokens — ZX Control (resumo de 1 página)

> Extraído de `zx-control-lp/DESIGN.md` (fonte de verdade) + `painel/style.css` do Contabilidade ZX Control.
> Tudo que o painel, a LP de apresentação e a proposta usam DEVE sair daqui — **nunca inventar
> cor, fonte ou espaçamento**. Estética: console de missão crítica — dark quase-preto, âmbar
> como ÚNICO acento ativo, mono pra dados.

## Cores (CSS custom properties)

```css
:root {
  --primary: #D97706;        /* âmbar — acento único do sistema */
  --primary-light: #F59E0B;  /* hover / destaque */
  --primary-bright: #FCD34D; /* texto âmbar brilhante (mono) */
  --primary-dark: #92400e;   /* bordas âmbar discretas */
  --bg: #0D0D0D;             /* fundo base (quase preto) */
  --bg-alt: #0A0A0A;         /* fundo alternativo / headers de tabela */
  --surface: #1A1A1A;        /* cards, modais */
  --surface2: #222222;       /* camada acima do surface (inputs, btn neutro) */
  --border: #2A2A2A;  --border-light: #333333;
  --text: #E2E8F0;  --text-secondary: #9CA3AF;  --muted: #6B7280;
  --green: #4ADE80;  --red: #EF4444;  --indigo: #818CF8;
  --radius: 10px;  --radius-card: 14px;
}
```

## Tipografia

| Uso | Fonte | Como |
|---|---|---|
| UI / corpo | **Inter** (400/600/700/800/900) | body 14px; h1 800-900 com `letter-spacing:-.01em` |
| Dados, labels, código, métricas | **JetBrains Mono** (400/500/700) | th de tabela, badges, eyebrows, números, terminal |
| Eyebrow/kicker | JetBrains Mono | `.74-.8rem`, uppercase, `letter-spacing:.16em`, cor `--primary` |

Import: `fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;500;700`

## Badges de estado (pill, mono 10px uppercase, fundo a 10% + borda a 30%)

| Cor | Estados |
|---|---|
| 🟢 `--green` | ativo, fechado, realizada, enviado |
| 🟣 `--indigo` | vendido, visita_agendada, visitou, confirmada |
| 🟠 `--primary-light` | qualificado, desatualizado, agendada, bloqueado |
| 🟡 `--primary-bright` | negociacao |
| 🔴 `--red` | perdido, no_show, falhou |
| ⚪ muted | inativo, novo, cancelada |

```css
.badge { padding:3px 10px; border-radius:999px; font-family:var(--mono); font-size:10px;
  font-weight:600; text-transform:uppercase; letter-spacing:.08em; border:1px solid transparent; }
.badge.ativo { background:rgba(74,222,128,.10); color:var(--green); border-color:rgba(74,222,128,.30); }
```

## Botões

```css
.btn { padding:8px 16px; border-radius:var(--radius); border:1px solid var(--border-light);
  background:var(--surface2); color:var(--text); font-size:13px; font-weight:600; }
.btn-primary { background:var(--primary); border-color:var(--primary); color:#0D0D0D; font-weight:700; }
.btn-primary:hover { background:var(--primary-light); }
.btn-danger { background:transparent; border-color:rgba(239,68,68,.45); color:var(--red); }
```

CTA de LP: fundo `--primary`, texto `#000`, radius 10-12px, hover `--primary-light`.

## Tabelas

- `th`: JetBrains Mono 10.5px uppercase `letter-spacing:.12em`, cor `--muted`, fundo `--bg-alt`.
- `td`: 13px `--text-secondary`; primeira coluna `--text` weight 500.
- Zebra sutil `rgba(255,255,255,.012)`; hover de linha `rgba(217,119,6,.045)`.

## Inputs / Formulários

- Fundo `--bg-alt`, borda `--border-light`, radius `--radius`; campos numéricos/tel/data em mono.
- Focus: borda `--primary` + `box-shadow: 0 0 0 3px rgba(217,119,6,.18)`.
- Label: 11px uppercase weight 700 `--text-secondary`.

## Modal + Toast

- Modal: `--surface`, borda `--border-light`, radius `--radius-card`, max-width 540px,
  backdrop `rgba(0,0,0,.65)` com `blur(6px)`, animação `modalIn .18s`.
- Toast: canto inferior direito, `--surface2` com borda âmbar a 50%.

## Assinaturas visuais (use, não invente)

- Header sticky com `backdrop-filter: blur(12px)` e h1 mono uppercase com cursor `_` piscando.
- Status dot com glow (`box-shadow` colorido) — verde connected, âmbar qr_needed, vermelho disconnected.
- Hero de LP: `radial-gradient(... rgba(217,119,6,.13), transparent)` sobre `--bg-alt`.
- Log de operação estilo terminal: fundo `--bg-alt`, mono 12px, linha colorida por status.
- Nav em pills: ativa = `rgba(217,119,6,.14)` + borda `rgba(217,119,6,.35)` + texto `--primary-bright`.

**Padrão-ouro completo:** `painel/style.css` do repo do Contabilidade ZX Control — copie e adapte os
nomes de estado do seu nicho aos 6 grupos de badge acima.
