// ════════════════════════════════════════════════════════════════════════
// Auth FAIL-CLOSED (spec §4) — TODA rota do Worker passa por aqui.
//
// Regra inquebrável: token ausente, vazio ("Bearer ") ou inválido → 401, SEMPRE.
// O check tem que estar NO CAMINHO da rota (não só existir em outra). Foi o bug
// CRITICAL do PR #2 do Corretor (auth bypass) — não repetir.
//
// Valida o JWT do Supabase Auth chamando GoTrue /auth/v1/user. A verificação é
// injetável (`deps._verify`) para teste sem rede — o caminho de produção bate
// no Supabase de verdade.
// ════════════════════════════════════════════════════════════════════════

export interface AuthEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

export interface AuthUser {
  id: string;
  email?: string;
}

export class AuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthError";
  }
}

export type VerifyOverride = (token: string, env: AuthEnv) => Promise<AuthUser>;
type VerifyFn = VerifyOverride;

/** Extrai o token de "Authorization: Bearer <token>". Vazio/ausente → null. */
export function extrairBearer(req: Request): string | null {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token ? token : null; // "Bearer " vazio → null (fail-closed)
}

/** Verificação real: pergunta ao GoTrue do Supabase quem é o dono do token. */
async function verifyComSupabase(token: string, env: AuthEnv): Promise<AuthUser> {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_SERVICE_KEY },
  });
  if (!res.ok) throw new AuthError();
  const user = (await res.json()) as { id?: string; email?: string };
  if (!user?.id) throw new AuthError();
  return { id: user.id, email: user.email };
}

/**
 * Exige usuário autenticado. Lança AuthError (→ 401) se não houver token válido.
 * Use no INÍCIO de cada handler de rota protegida.
 */
export async function requireUser(
  req: Request,
  env: AuthEnv,
  deps: { _verify?: VerifyFn } = {},
): Promise<AuthUser> {
  const token = extrairBearer(req);
  if (!token) throw new AuthError(); // fail-closed: sem token = 401
  const verify = deps._verify ?? verifyComSupabase;
  return await verify(token, env);
}

/** Resposta 401 padrão para AuthError. */
export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
