import "server-only";
import { cookies } from "next/headers";
import { hoje } from "../datas";
import type { Dados, PessoaId } from "../tipos";
import { credenciais, type Credenciais } from "./ambiente";
import { dadosDeDemonstracao } from "./demo";
import { lerDados } from "./planilha";
import { COOKIE_QUEM } from "./sessao";

export async function quemEstaUsando(): Promise<PessoaId> {
  return (await cookies()).get(COOKIE_QUEM)?.value === "b" ? "b" : "a";
}

export async function carregar(): Promise<{ dados: Dados; cred: Credenciais | null }> {
  const cred = credenciais();
  if (!cred) return { dados: dadosDeDemonstracao(hoje()), cred };
  return { dados: await lerDados(cred), cred };
}
