// Invariante CRÍTICO (spec §4): auth fail-closed em toda rota.
// Estes testes falham se o early-return de 401 for revertido (auth bypass).
import { describe, expect, it } from "vitest";
import { AuthError, extrairBearer, requireUser, type AuthEnv } from "../src/auth";

const ENV: AuthEnv = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "svc" };

function reqCom(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader !== undefined) headers.set("Authorization", authHeader);
  return new Request("https://w/api/prazos", { headers });
}

const verifyOk = async () => ({ id: "u1", email: "contador@escritorio.com" });
const verifyFail = async () => {
  throw new AuthError();
};

describe("extrairBearer — nunca aceita token vazio", () => {
  it("retorna null sem header", () => expect(extrairBearer(reqCom())).toBeNull());
  it("retorna null com 'Bearer ' vazio", () =>
    expect(extrairBearer(reqCom("Bearer "))).toBeNull());
  it("retorna null com 'Bearer' sem valor", () =>
    expect(extrairBearer(reqCom("Bearer"))).toBeNull());
  it("extrai o token quando presente", () =>
    expect(extrairBearer(reqCom("Bearer abc.def.ghi"))).toBe("abc.def.ghi"));
});

describe("requireUser — fail-closed", () => {
  it("401 quando não há token (sem chamar verify)", async () => {
    let chamou = false;
    await expect(
      requireUser(reqCom(), ENV, { _verify: async () => ((chamou = true), { id: "x" }) }),
    ).rejects.toBeInstanceOf(AuthError);
    expect(chamou).toBe(false); // nem chega a verificar
  });

  it("401 quando o token é 'Bearer ' vazio", async () => {
    await expect(requireUser(reqCom("Bearer "), ENV, { _verify: verifyOk })).rejects.toBeInstanceOf(
      AuthError,
    );
  });

  it("401 quando o token é inválido (verify rejeita)", async () => {
    await expect(
      requireUser(reqCom("Bearer invalido"), ENV, { _verify: verifyFail }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("retorna o usuário quando o token é válido", async () => {
    const user = await requireUser(reqCom("Bearer valido"), ENV, { _verify: verifyOk });
    expect(user.id).toBe("u1");
  });
});
