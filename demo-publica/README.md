# demo-publica/ — fonte da demo pública do Contabilidade ZX Control

Esta pasta é a **fonte de verdade** do que está no ar em
**https://demo-contabilidade.zxlab.com.br** (projeto Cloudflare Pages:
`demo-contabilidade-zx-control`).

Antes dela o site publicado **não era reproduzível a partir do repo** — só existiam
`painel/` (o produto real) e `demo/` (mock server Node). Quem quisesse alterar a demo
tinha que baixar o HTML de produção. Esta pasta fecha esse buraco.

## O painel é GERADO, não copiado

`index.html`, `style.css` e `app.js` **não vivem aqui** — `build.mjs` copia os três de
`painel/` a cada build. É o mesmo desenho da demo do Jurídico (`demo/build-pages.mjs`).

```
demo-publica/
  build.mjs       # monta dist/ a partir de painel/ + os arquivos abaixo
  mock-api.js     # exclusivo da demo: API 100% no browser
  proposta.html   # exclusivo da demo: proposta comercial
  dist/           # GERADO — é o que vai pro Pages (não versionar)
```

Manter uma cópia de `app.js` aqui garantiria drift: correção no produto não chegaria na
demo, e mexer na demo não corrigiria o produto. O custo aparece rápido — o fix do
`GET /prazos` sem `empresaId` (abaixo) já teve de ser escrito duas vezes, em
`demo/server.mjs` e em `mock-api.js`, porque são mocks genuinamente independentes.

## O que é

Demo **100% estática e pública**, feita pro aluno mandar o link direto pro cliente dele.

- Sem servidor, sem Supabase, sem credencial, sem IA real.
- `mock-api.js` faz monkey-patch de `window.fetch` e responde `/api/*` a partir de um
  store em memória semeado com dados fictícios. Recarregar a página restaura o seed.
- `config.js` (escrito pelo `build.mjs`) marca `mode: "demo"` — é essa flag que liga
  todo o comportamento de demo.

## Por que ela entra direto, sem login

O visitante é o **cliente do aluno**: pedir e-mail e senha pra ver uma demonstração
mata a demo. O bypass mora em `painel/`, **inteiro guardado por `ZX.mode === "demo"`**:

1. `painel/index.html` marca `<html class="zx-demo">` num script inline no `<head>`,
   **antes do 1º paint** → zero flash da tela de login.
2. `painel/style.css` (bloco "Demo pública") esconde `#login`, revela `#app.hidden` e
   esconde o botão **Sair** (não faz sentido em demonstração). O elemento do Sair
   **continua no DOM** — `app.js` faz `addEventListener` nele e removê-lo quebraria com `null`.
3. `painel/app.js` dispara um auto-login logo após registrar os handlers e chama `startApp()`.
4. O `<form>` de login **continua no DOM de propósito**, como fallback silencioso: se o
   auto-login falhar, o `.catch` chama `logout()`.
5. `logout()` em modo demo **tira a classe `zx-demo` do `<html>`** antes de reexibir o
   `#login`. Sem isso o CSS do item 2 manteria a tela de acesso em `display:none` e o
   visitante ficaria preso num shell logado, sem login e sem botão de sair — que é o que
   aconteceria com um 401 do mock chegando **depois** do boot.

> ⚠️ **Isto vale SÓ para a demo pública.** O produto real que o aluno instala é o mesmo
> `painel/`, mas com `config.js` de produção (`mode: "prod"`): a classe `zx-demo` nunca é
> aplicada, o auto-login nunca roda e a auth continua Supabase Auth + Worker fail-closed.
> **Nunca** trocar essa guarda por algo que ligue fora da demo.

## Bug corrigido junto (divergência do mock)

`GET /prazos` **sem** `empresaId` devolvia `400 empresaId obrigatório` nos dois mocks
(`mock-api.js` e `demo/server.mjs`). Mas o Worker real (`src/app.ts`) trata esse caso de
propósito — *"Sem empresaId → agenda completa do escritório (painel-início / aviso de
login)"* — e é exatamente assim que `loadInicio()` e `loadRelatorio()` chamam.

Resultado: as abas **Início** e **Relatório** ficavam presas num spinner eterno. Era um bug
**pré-existente, já no ar** em demo-contabilidade.zxlab.com.br (confirmado no site publicado
antes de qualquer alteração) — só não aparecia de cara porque a tela de login o escondia.
Como agora a demo entra direto, o spinner quebrado viraria a **primeira tela** que o cliente
do aluno vê. Os dois mocks passaram a espelhar o Worker.

## Deploy

```bash
node demo-publica/build.mjs
wrangler pages deploy demo-publica/dist --project-name demo-contabilidade-zx-control
```

### ⚠️ O deploy precisa conter os 6 arquivos

`index.html` · `style.css` · `app.js` · `config.js` · `mock-api.js` · `proposta.html`

O Cloudflare Pages **substitui o site inteiro** a cada deploy — ele não faz merge com o
que já estava lá. Subir a pasta faltando um arquivo tira aquele arquivo do ar. O `build.mjs`
monta os 6 sempre; publicar `dist/` inteiro é o que mantém essa garantia.

O caso concreto: **`proposta.html`** é a proposta comercial que o aluno manda pro cliente,
e é a mais fácil de esquecer porque não é linkada a partir do `index.html`. Se ela sumir do
deploy, o link que o aluno já entregou pro cliente dele passa a cair no fallback do Pages
(que devolve o `index.html`) — quebra silenciosa, sem erro visível.

Confira depois de publicar:

```bash
curl -sI https://demo-contabilidade.zxlab.com.br/proposta.html | head -1
curl -s  https://demo-contabilidade.zxlab.com.br/proposta.html | grep -c "Proposta"
```

> `_redirects`, `_headers`, `404.html` e `favicon.ico` respondem **200** nesse domínio, mas
> devolvem o conteúdo do `index.html` — é o fallback de SPA do Pages, não são arquivos reais.
> Ou seja: **status 200 não prova que o arquivo existe.** Cheque o conteúdo, como acima.

## Testar local

```bash
node demo-publica/build.mjs
cd demo-publica/dist && python3 -m http.server 8899
# abre http://localhost:8899 — tem que cair direto no painel populado, sem login
```
