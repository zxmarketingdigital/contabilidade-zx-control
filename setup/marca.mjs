#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
// Utilitário de MARCA do aluno — valida e grava nome, cores e logo do escritório.
//
// NÃO é um wizard e não pergunta nada: quem conversa com o aluno é o Claude Code, seguindo
// o passo "Marca do escritório" de setup/CLAUDE.md. Depois de perguntar os 4 campos, o Claude
// chama este comando uma vez, com as respostas. Ele:
//   1. valida os campos (cor em #RRGGBB/#RGB; logo existente e de tipo aceito, ou URL https);
//   2. grava o bloco `window.ZX.marca` em painel/config.js (o arquivo que o painel já lê);
//   3. copia o logo para painel/marca/ e docs/marca/;
//   4. publica docs/marca.config.js + docs/marca.js, para a proposta/apresentação usarem a mesma marca.
//
// Uso:
//   node setup/marca.mjs --nome "Escritório Silva" [--cor "#1D4ED8"] [--cor2 "#0B1F4D"] [--logo ~/logo.png]
//   node setup/marca.mjs --json -   (JSON {nome,cor,cor2,logo} na entrada padrão: forma SEGURA para
//                                    valores digitados pelo aluno, sem passar por aspas do shell)
//
// Saída: 0 = gravado (cor ausente grava o padrão ZX COM aviso) · 2 = campo inválido (pergunte de novo).
// Rode de novo com os 4 campos para trocar a marca: campo omitido volta ao padrão.
// ════════════════════════════════════════════════════════════════════════

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Validação de cor/logo vive em UM lugar: painel/marca.js (o mesmo código que roda no navegador).
await import("../painel/marca.js");
const Z = globalThis.ZXMarca;

const RAIZ_PADRAO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXT_LOGO = [".png", ".jpg", ".jpeg", ".svg", ".webp"];
const INICIO = "// >>> marca";
const FIM = "// <<< marca";

export class MarcaErro extends Error {}

function caminhoLocal(p) {
  const s = p.trim();
  return resolve(s.startsWith("~/") ? join(homedir(), s.slice(2)) : s);
}

function limparLogos(dir) {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) if (/^logo\.[a-z0-9]+$/i.test(f)) rmSync(join(dir, f));
}

/** Valida os campos e grava tudo. Lança MarcaErro com mensagem pronta para o Claude repetir ao aluno. */
export function aplicarMarca({ raiz = RAIZ_PADRAO, nome, cor, cor2, logo } = {}) {
  const avisos = [];

  const nomeOk = typeof nome === "string" ? nome.trim() : "";
  if (!nomeOk) throw new MarcaErro("Nome do escritório é obrigatório. Pergunte de novo.");

  let corPrimaria;
  if (cor === undefined || String(cor).trim() === "") {
    corPrimaria = Z.COR_PADRAO;
    avisos.push("Usando a cor padrão ZX (âmbar). Troque depois em painel/config.js (campo corPrimaria) ou rode este comando de novo com --cor.");
  } else {
    corPrimaria = Z.normalizarHex(String(cor));
    if (!corPrimaria) throw new MarcaErro(`Cor "${cor}" inválida. Use o formato #RRGGBB (ex.: #1D4ED8) ou #RGB. Pergunte de novo.`);
  }

  let corSecundaria = "";
  if (cor2 !== undefined && String(cor2).trim() !== "") {
    corSecundaria = Z.normalizarHex(String(cor2));
    if (!corSecundaria) throw new MarcaErro(`Cor secundária "${cor2}" inválida. Use #RRGGBB ou #RGB, ou deixe em branco. Pergunte de novo.`);
  }

  // Logo: URL https é usada como está; arquivo local é copiado para dentro do painel.
  let logoConfig = "";
  let logoOrigem = null;
  if (logo !== undefined && String(logo).trim() !== "") {
    const l = String(logo).trim();
    if (/^https:\/\//i.test(l)) {
      if (!Z.logoValido(l)) throw new MarcaErro(`URL de logo "${l}" inválida (sem espaços ou aspas). Pergunte de novo.`);
      logoConfig = l;
    } else if (/^[a-z][a-z0-9+.-]*:/i.test(l)) {
      throw new MarcaErro("Logo por URL precisa ser https://. Para arquivo, passe o caminho no computador. Pergunte de novo.");
    } else {
      logoOrigem = caminhoLocal(l);
      if (!existsSync(logoOrigem) || !statSync(logoOrigem).isFile()) throw new MarcaErro(`Arquivo de logo não encontrado: ${logoOrigem}. Pergunte o caminho de novo.`);
      const ext = extname(logoOrigem).toLowerCase();
      if (!EXT_LOGO.includes(ext)) throw new MarcaErro(`Logo "${basename(logoOrigem)}" não é png, jpg, svg ou webp. Pergunte de novo.`);
      logoConfig = `marca/logo${ext}`;
    }
  }

  const marca = { nome: nomeOk, corPrimaria, corSecundaria, logo: logoConfig };

  // ── Efeitos: só depois de TODA a validação passar ──
  const painelDir = join(raiz, "painel");
  const docsDir = join(raiz, "docs");
  for (const base of [painelDir, docsDir]) {
    const dir = join(base, "marca");
    limparLogos(dir);
    if (logoOrigem) {
      mkdirSync(dir, { recursive: true });
      copyFileSync(logoOrigem, join(base, logoConfig));
    }
  }

  const bloco = `${INICIO} (gerado por setup/marca.mjs — NAO edite à mão; rode \`node setup/marca.mjs --ajuda\`)\n` +
    `window.ZX.marca = ${JSON.stringify(marca, null, 2)};\n${FIM}\n`;

  const configPath = join(painelDir, "config.js");
  let config;
  if (existsSync(configPath)) config = readFileSync(configPath, "utf8");
  else {
    const exemplo = join(painelDir, "config.example.js");
    if (!existsSync(exemplo)) throw new MarcaErro("painel/config.js e painel/config.example.js não existem. Rode o passo 5 da instalação antes.");
    config = readFileSync(exemplo, "utf8");
    avisos.push("painel/config.js não existia: criado a partir do config.example.js. Preencha os dados do Supabase/Worker (passo 5).");
  }
  const re = new RegExp(`${INICIO}[\\s\\S]*?${FIM}\\n?`);
  config = re.test(config) ? config.replace(re, () => bloco) : `${config.replace(/\s*$/, "\n")}\n${bloco}`;
  writeFileSync(configPath, config);

  // Docs (proposta/apresentação): mesmo bloco, mais uma cópia do loader.
  writeFileSync(join(docsDir, "marca.config.js"), `window.ZX = window.ZX || {};\n${bloco}`);
  copyFileSync(join(painelDir, "marca.js"), join(docsDir, "marca.js"));

  return { marca, avisos };
}

const AJUDA = `Uso: node setup/marca.mjs --nome "Escritório Silva" [--cor "#1D4ED8"] [--cor2 "#0B1F4D"] [--logo ~/logo.png]
  ou:  node setup/marca.mjs --json -   (JSON na entrada padrão com nome, cor, cor2, logo; use para texto digitado pelo aluno)
  --nome   obrigatório
  --cor    cor primária #RRGGBB (ou #RGB). Omitida: padrão ZX (âmbar), com aviso
  --cor2   cor secundária, opcional (omitida: versão mais escura da primária)
  --logo   caminho de imagem (png/jpg/svg/webp) ou URL https. Omitido: só o nome em texto`;

function lerArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--ajuda" || a === "-h") out.ajuda = true;
    else if (["--nome", "--cor", "--cor2", "--logo", "--raiz", "--json"].includes(a)) out[a.slice(2)] = argv[++i] ?? "";
    else throw new MarcaErro(`Argumento desconhecido: ${a}`);
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = lerArgs(process.argv.slice(2));
    if (args.ajuda) { console.log(AJUDA); process.exit(0); }
    if (args.json !== undefined) {
      if (args.json !== "-") throw new MarcaErro('Use --json - (JSON lido da entrada padrão).');
      let dados;
      try { dados = JSON.parse(readFileSync(0, "utf8")); } catch { throw new MarcaErro("JSON inválido na entrada padrão. Esperado: {\"nome\":\"...\",\"cor\":\"#RRGGBB\",\"cor2\":\"\",\"logo\":\"\"}"); }
      if (!dados || typeof dados !== "object" || Array.isArray(dados)) throw new MarcaErro("JSON da marca deve ser um objeto.");
      for (const k of ["nome", "cor", "cor2", "logo"]) if (args[k] === undefined && dados[k] !== undefined) args[k] = String(dados[k]);
    }
    const { marca, avisos } = aplicarMarca({ ...args, raiz: args.raiz ? resolve(args.raiz) : RAIZ_PADRAO });
    for (const a of avisos) console.log(`⚠️  ${a}`);
    console.log(`✅ Marca gravada: ${marca.nome} · ${marca.corPrimaria}${marca.corSecundaria ? ` / ${marca.corSecundaria}` : ""}${marca.logo ? ` · logo ${marca.logo}` : " · sem logo (só o nome em texto)"}`);
    console.log("   Atualizado: painel/config.js, docs/marca.config.js, docs/marca.js. Abra o painel (ou `node demo/server.mjs`) para conferir.");
  } catch (e) {
    if (e instanceof MarcaErro) { console.error(`❌ ${e.message}`); process.exit(2); }
    throw e;
  }
}
