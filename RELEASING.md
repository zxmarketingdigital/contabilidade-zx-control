# Processo de Release Congelada — Contabilidade ZX Control

O núcleo é distribuído como **tag versionada**. O aluno-revendedor sempre instala (e atualiza) a partir
de uma tag, nunca da `main`. Cada contabilidade roda código estável e testado.

> Enquanto o produto está em desenvolvimento, as versões são `v0.x` (instável). A **`v1.0.0`** sai
> quando o produto estiver completo, com suíte verde — é decisão de lançamento do Rafael.

## Regra de ouro

> **Só se cria tag sobre um commit que passou no CI (verde).**

## Versionamento semântico

| Tipo | Quando | Exemplo |
|------|--------|---------|
| **patch** | Bugfix sem mudança de contrato | `v1.0.1` |
| **minor** | Feature nova, compatível com configs existentes | `v1.1.0` |
| **major** | Breaking change — instalação precisa ajustar vars/`wrangler.toml` | `v2.0.0` |

## Cortar uma release

1. **CI verde na `main`** — aguardar o job passar.
2. Atualizar CHANGELOG (se houver).
3. Criar e publicar a tag:
   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```
4. Avisar os alunos-revendedores (grupo / área de membros).

## Como o aluno atualiza um contabilidade

Cada contabilidade roda na infra do próprio aluno-revendedor (Supabase + Cloudflare + instância Evolution
dele). Update descentralizado, por contabilidade:

```bash
git fetch --tags && git checkout v1.2.3
pnpm install --frozen-lockfile
pnpm exec wrangler deploy
```

> Em major version, ler as notas da release antes do checkout — pode haver variáveis novas.
