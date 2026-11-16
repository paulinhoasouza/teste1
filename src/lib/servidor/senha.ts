import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/** Senhas guardadas como scrypt com sal próprio: "scrypt$N$r$p$sal$hash", em hexadecimal. */

const N = 16384;
const R = 8;
const P = 1;
const TAMANHO = 64;
export const SENHA_MINIMA = 8;

function derivar(senha: string, sal: Buffer, n: number, r: number, p: number, tamanho: number): Promise<Buffer> {
  return new Promise((resolver, rejeitar) => {
    scrypt(senha, sal, tamanho, { N: n, r, p }, (erro, chave) => (erro ? rejeitar(erro) : resolver(chave)));
  });
}

export async function gerarHash(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const chave = await derivar(senha, sal, N, R, P, TAMANHO);
  return `scrypt$${N}$${R}$${P}$${sal.toString("hex")}$${chave.toString("hex")}`;
}

export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  const [algoritmo, n, r, p, sal, hash] = guardado.split("$");
  if (algoritmo !== "scrypt" || !sal || !hash) return false;
  const esperado = Buffer.from(hash, "hex");
  try {
    const obtido = await derivar(senha, Buffer.from(sal, "hex"), Number(n), Number(r), Number(p), esperado.length);
    return obtido.length === esperado.length && timingSafeEqual(obtido, esperado);
  } catch {
    return false;
  }
}

/** Hash de uma senha qualquer, para gastar o mesmo tempo quando o e-mail não existe. */
export const HASH_DE_ENCHIMENTO =
  "scrypt$16384$8$1$00000000000000000000000000000000$" + "0".repeat(128);
