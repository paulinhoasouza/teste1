import "server-only";
import type { Atividade } from "../tipos";
import type { Credenciais } from "./ambiente";
import { registrarAtividade } from "./banco";

/** Guarda no histórico. Uma falha aqui não desfaz nem bloqueia o que a pessoa fez. */
export async function anotar(cred: Credenciais | null, a: Atividade | null): Promise<void> {
  if (!cred || !a) return;
  try {
    await registrarAtividade(cred, a);
  } catch (e) {
    console.error("Não foi possível registrar a atividade", e);
  }
}
