import type { Atividade, PessoaId } from "./tipos";

/**
 * Até quando cada pessoa já viu a Atividade, neste aparelho. Serve só para o selo de novidades:
 * se o navegador não deixar guardar, o selo simplesmente não aparece.
 */
const chave = (quem: PessoaId) => `atividade-vista-${quem}`;

export function ultimaVistaDaAtividade(quem: PessoaId): string {
  try {
    return window.localStorage.getItem(chave(quem)) ?? "";
  } catch {
    return "";
  }
}

export function marcarAtividadeVista(quem: PessoaId): void {
  try {
    window.localStorage.setItem(chave(quem), new Date().toISOString());
    window.dispatchEvent(new CustomEvent("atividade-vista"));
  } catch {
    /* sem armazenamento: sem selo */
  }
}

/** Quantas ações da outra pessoa chegaram depois da última visita. Na primeira vez, começa do zero. */
export function contarNovas(atividades: Atividade[], quem: PessoaId, vista: string): number {
  if (!vista) return 0;
  return atividades.filter((a) => a.quem !== quem && a.quando > vista).length;
}
