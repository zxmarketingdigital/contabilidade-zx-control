---
name: validar-dod
description: "Valida mecanicamente os 6 itens do DoD Setup de Nicho v2 antes de abrir o PR: instalação guiada no CLAUDE.md, painel com tokens ZX Control, CRUD completo no painel, demo local populada sem credencial, docs/apresentacao.html, docs/proposta.html com preço preenchido, e zero placeholders restantes. Imprime relatório ✅/❌ por item. Use SEMPRE que o usuário disser: validar dod, checar entrega, pronto pro PR?, validar antes do PR, conferir dod, rodar dod, checklist de entrega, /validar-dod."
model: haiku
effort: medium
---

# /validar-dod — checagem mecânica do DoD Setup de Nicho v2

Rode TODAS as checagens abaixo a partir da **raiz do repo** e imprima um relatório final
com ✅/❌ por item (N1-N6 + transversal). **Não corrija nada nesta skill** — só reporte.
Se algum item der ❌, diga exatamente o que faltou e em qual arquivo. O PR só deve ser
aberto com 6/6 ✅ (mesmas regras que o CI perfil `nicho-dod` valida).

## N1 — Instalação guiada (CLAUDE.md conduz conversando)

O CLAUDE.md de **instalação** (o que o aluno usa — na raiz do produto entregue, ou o
arquivo de instalação indicado no repo, ex. `docs/CLAUDE-instalacao.md`):

```bash
F=CLAUDE.md  # ajuste se o CLAUDE.md de instalação estiver em outro path
test -f "$F" || echo "❌ N1: CLAUDE.md de instalação não existe"
grep -qiE "conversando|uma (credencial|de cada vez)|conduza" "$F" || echo "❌ N1: sem condução conversacional"
grep -qiE "clone deste reposit|cole o link do repo" "$F" docs/apresentacao.html 2>/dev/null || echo "❌ N1: instrução de instalação fora do padrão 'cole o link do repo e peça o clone'"
```

❌ também se um wizard `.mjs` aparecer como **caminho principal** de instalação: se
`grep -n "configure.mjs" "$F"` achar algo, a menção precisa estar marcada como alternativa
("alternativa", "quem prefere", "opcional"). Wizard como passo 1 = reprovado (caso Álvaro 09/Jun).

## N2 — Painel premium (tokens ZX Control)

```bash
for tok in '#0D0D0D' '#D97706' 'JetBrains Mono' 'Inter' '.badge'; do
  grep -qF "$tok" painel/style.css || echo "❌ N2: token ausente em painel/style.css: $tok"
done
```

Conferir também (leitura rápida do CSS): badges por estado nos 6 grupos de cor do
`docs/DESIGN-TOKENS.md` (verde/indigo/âmbar/âmbar-bright/vermelho/muted).

## N3 — CRUD completo (toda entidade tem "+ Novo" + modal)

```bash
grep -c "Novo" painel/index.html        # ≥ nº de entidades listadas no painel
grep -qE "modal" painel/index.html painel/app.js || echo "❌ N3: sem modal de cadastro"
```

Liste as abas/tabelas de entidade do `painel/index.html` e confirme 1 botão "+ Novo" por
entidade, com handler em `painel/app.js` que faz POST na API (não `alert`/stub).

## N4 — Demo local (populada, sem credencial)

```bash
node --check demo/server.mjs && node --check demo/data.mjs || echo "❌ N4: sintaxe quebrada"
# ≥10 registros por entidade principal:
node -e 'import("./demo/data.mjs").then(d => { for (const [k,v] of Object.entries(d)) if (Array.isArray(v)) console.log(k, v.length); })'
# zero credencial necessária:
grep -nE "SUPABASE|GEMINI_API|API_KEY|service_role" demo/*.mjs && echo "❌ N4: demo referencia credencial"
```

Suba `node demo/server.mjs` e confira: `GET /` devolve o painel, `GET /api/<entidade>` sem
Bearer → 401, com Bearer → dados. Derrube o processo ao final.
❌ se alguma entidade principal tiver <10 registros ou dados não-realistas ("Teste", "Foo", lorem).

## N5 — docs/apresentacao.html (LP do setup pro aluno)

```bash
test -f docs/apresentacao.html || echo "❌ N5: arquivo não existe"
for sec in "agente" "instala" "stack" "conta" "Copiar prompt" "clone deste reposit"; do
  grep -qi "$sec" docs/apresentacao.html || echo "❌ N5: seção/elemento ausente: $sec"
done
```

Deve cobrir: o que é, agentes, como funciona, stack, passos da instalação, contas
necessárias, operação, CTA com prompt de clone copiável (botão + clipboard).

## N6 — docs/proposta.html (comercial white-label, preço preenchido)

```bash
test -f docs/proposta.html || echo "❌ N6: arquivo não existe"
grep -qE 'R\$ ?[0-9]' docs/proposta.html || echo "❌ N6: precificação não preenchida"
grep -qiE "zx lab|zx control" docs/proposta.html && echo "⚠️ N6: marca ZX vazou na página white-label"
```

## Transversal — zero placeholders

```bash
grep -rn "{{" --include="*.html" --include="*.mjs" --include="*.md" --include="*.css" --include="*.js" \
  --exclude-dir=node_modules --exclude-dir=.git . | grep -v ".github/" || echo "✅ sem placeholders"
```

Qualquer `{{...}}` em arquivo entregue (fora `.github/`, que é território do dono) = ❌.

## Relatório final

```
DoD Setup de Nicho v2 — relatório
 N1 Instalação guiada ........ ✅/❌ (motivo)
 N2 Painel premium ........... ✅/❌
 N3 CRUD completo ............ ✅/❌
 N4 Demo local ............... ✅/❌
 N5 apresentacao.html ........ ✅/❌
 N6 proposta.html ............ ✅/❌
 TR Zero placeholders ........ ✅/❌
→ 7/7 = pronto pro PR. Qualquer ❌ = corrija antes de abrir.
```
