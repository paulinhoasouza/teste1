import "server-only";

export interface Credenciais {
  /** Endereço do projeto no Supabase, sem barra no fim. */
  url: string;
  /** Chave publicável do projeto. */
  chave: string;
  /** Segredo próprio do app, conferido pelo banco em cada pedido. */
  segredo: string;
}

export class ErroDeConfiguracao extends Error {}

/** Lê o acesso ao banco; null quando o app deve rodar em demonstração. */
export function credenciais(): Credenciais | null {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "") ?? "";
  const chave = process.env.SUPABASE_KEY?.trim() ?? "";
  const segredo = process.env.BANCO_SEGREDO?.trim() ?? "";

  if (!url && !chave && !segredo) return null;

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) {
    throw new ErroDeConfiguracao("A variável SUPABASE_URL está faltando ou não é um endereço do Supabase.");
  }
  if (!chave) throw new ErroDeConfiguracao("Falta a variável SUPABASE_KEY com a chave do projeto.");
  if (!segredo) throw new ErroDeConfiguracao("Falta a variável BANCO_SEGREDO.");
  return { url, chave, segredo };
}

export function senhaDoApp(): string {
  return process.env.APP_SENHA?.trim() ?? "";
}

/** A senha é opcional: sem APP_SENHA o app abre direto e o acesso fica por conta da proteção da Vercel. */
export function exigeLogin(): boolean {
  return senhaDoApp().length > 0;
}
