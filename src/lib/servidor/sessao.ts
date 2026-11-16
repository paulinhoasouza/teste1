import { SignJWT, jwtVerify } from "jose";

/** Usado pelo proxy e pelas rotas; não guarda estado em módulo. */
export const COOKIE_SESSAO = "sessao";
export const COOKIE_QUEM = "quem";
const DURACAO_DIAS = 180;
export const DURACAO_SEGUNDOS = DURACAO_DIAS * 24 * 60 * 60;

async function segredo(senha: string): Promise<Uint8Array> {
  const base = `a-dois:${senha}:${process.env.SUPABASE_URL ?? ""}`;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(base));
  return new Uint8Array(hash);
}

export async function criarSessao(senha: string): Promise<string> {
  return new SignJWT({ ok: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_DIAS}d`)
    .sign(await segredo(senha));
}

export async function sessaoValida(token: string | undefined, senha: string): Promise<boolean> {
  if (!token || !senha) return false;
  try {
    await jwtVerify(token, await segredo(senha), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

/** Compara sem revelar pelo tempo onde as senhas diferem. */
export async function senhaConfere(tentativa: string, senha: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(tentativa)),
    crypto.subtle.digest("SHA-256", enc.encode(senha)),
  ]);
  const a = new Uint8Array(x);
  const b = new Uint8Array(y);
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a[i]! ^ b[i]!;
  return dif === 0;
}
