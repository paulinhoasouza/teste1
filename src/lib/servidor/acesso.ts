import "server-only";
import { cookies } from "next/headers";
import { hoje } from "../datas";
import type { Dados, PessoaId } from "../tipos";
import { credenciais, type Credenciais } from "./ambiente";
import { lerDados } from "./banco";
import { dadosDeDemonstracao } from "./demo";
import { COOKIE_QUEM, COOKIE_SESSAO, lerSessao, loginAtivo } from "./sessao";

/** Com login, é quem entrou; em demonstração, quem foi escolhido no menu. */
export async function quemEstaUsando(): Promise<PessoaId> {
  const jarra = await cookies();
  if (loginAtivo()) return (await lerSessao(jarra.get(COOKIE_SESSAO)?.value)) ?? "a";
  return jarra.get(COOKIE_QUEM)?.value === "b" ? "b" : "a";
}

export async function carregar(): Promise<{ dados: Dados; cred: Credenciais | null }> {
  const cred = credenciais();
  if (!cred) return { dados: dadosDeDemonstracao(hoje()), cred };
  return { dados: await lerDados(cred), cred };
}
