import { SignJWT, jwtVerify } from "jose";
import type { PessoaId } from "../tipos";

/** Usado pelo proxy e pelas rotas; não guarda estado em módulo. */
export const COOKIE_SESSAO = "sessao";
export const COOKIE_QUEM = "quem";
const DURACAO_DIAS = 180;
export const DURACAO_SEGUNDOS = DURACAO_DIAS * 24 * 60 * 60;

/** Com o banco ligado, o app só abre para quem entrou com e-mail e senha. */
export function loginAtivo(): boolean {
  return (process.env.BANCO_SEGREDO?.trim() ?? "").length > 0;
}

async function chave(): Promise<Uint8Array> {
  const base = `a-dois:sessao:${process.env.BANCO_SEGREDO ?? ""}`;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(base)));
}

export async function criarSessao(pessoa: PessoaId): Promise<string> {
  return new SignJWT({ pessoa })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_DIAS}d`)
    .sign(await chave());
}

/** Devolve quem está logado, ou null se a sessão não vale. */
export async function lerSessao(token: string | undefined): Promise<PessoaId | null> {
  if (!token || !loginAtivo()) return null;
  try {
    const { payload } = await jwtVerify(token, await chave(), { algorithms: ["HS256"] });
    return payload.pessoa === "a" || payload.pessoa === "b" ? payload.pessoa : null;
  } catch {
    return null;
  }
}
