import type { Comprovante, Lancamento } from "./tipos";

/** Regras dos comprovantes, iguais no aparelho e no servidor. */

/** Depois de reduzir as fotos no aparelho; PDF vai como está. Cabe no limite de envio da Vercel. */
export const TAMANHO_MAXIMO = 3_000_000;
export const MAXIMO_POR_LANCAMENTO = 10;
export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"] as const;
export type TipoDeComprovante = (typeof TIPOS_ACEITOS)[number];

const comeca = (b: Uint8Array, sinal: number[], desde = 0) => sinal.every((x, i) => b[desde + i] === x);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/**
 * Diz o que o arquivo é pelos primeiros bytes, sem confiar no nome nem no tipo que o navegador informou.
 * Assim, uma página HTML com nome de foto nunca é guardada nem servida como imagem.
 */
export function reconhecer(b: Uint8Array): TipoDeComprovante | null {
  if (b.length < 12) return null;
  if (comeca(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (comeca(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (comeca(b, ascii("RIFF")) && comeca(b, ascii("WEBP"), 8)) return "image/webp";
  if (comeca(b, ascii("%PDF-"))) return "application/pdf";
  if (comeca(b, ascii("ftyp"), 4)) {
    const marca = String.fromCharCode(...b.slice(8, 12));
    if (["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(marca)) return "image/heic";
  }
  return null;
}

/** O comprovante de uma compra parcelada vale para todas as parcelas: fica no grupo. */
export function donoDoComprovante(l: Pick<Lancamento, "id" | "grupo">): string {
  return l.grupo || l.id;
}

export function comprovantesDe(todos: Comprovante[], l: Pick<Lancamento, "id" | "grupo">): Comprovante[] {
  const dono = donoDoComprovante(l);
  return todos.filter((c) => c.dono === dono);
}

/** Donos que deixam de existir quando estes lançamentos são excluídos: os comprovantes deles vão junto. */
export function donosOrfaos(lancamentos: Lancamento[], removidos: string[]): string[] {
  if (removidos.length === 0) return [];
  const sai = new Set(removidos);
  const ficam = new Set(lancamentos.filter((l) => !sai.has(l.id)).map(donoDoComprovante));
  const candidatos = new Set(lancamentos.filter((l) => sai.has(l.id)).map(donoDoComprovante));
  return [...candidatos].filter((d) => !ficam.has(d));
}

export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export const ehImagem = (tipo: string) => tipo.startsWith("image/");
