import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ErroDeConfiguracao, credenciais } from "@/lib/servidor/ambiente";
import { buscarUsuarioDaPessoa, gravarSenha } from "@/lib/servidor/banco";
import { SENHA_MINIMA, conferirSenha, gerarHash } from "@/lib/servidor/senha";
import { COOKIE_SESSAO, lerSessao } from "@/lib/servidor/sessao";

export const dynamic = "force-dynamic";

/** Troca a senha de quem está logado, conferindo a atual. */
export async function POST(req: Request) {
  let atual = "";
  let nova = "";
  try {
    const corpo = (await req.json()) as { atual?: unknown; nova?: unknown };
    if (typeof corpo.atual === "string") atual = corpo.atual.slice(0, 200);
    if (typeof corpo.nova === "string") nova = corpo.nova.slice(0, 200);
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }

  try {
    const cred = credenciais();
    const pessoa = await lerSessao((await cookies()).get(COOKIE_SESSAO)?.value);
    if (!cred || !pessoa) return NextResponse.json({ erro: "Entre de novo para trocar a senha." }, { status: 401 });
    if (nova.length < SENHA_MINIMA) {
      return NextResponse.json({ erro: `A senha nova precisa de pelo menos ${SENHA_MINIMA} caracteres.` }, { status: 422 });
    }
    const usuario = await buscarUsuarioDaPessoa(cred, pessoa);
    if (!usuario || !(await conferirSenha(atual, usuario.senhaHash))) {
      return NextResponse.json({ erro: "A senha atual não confere." }, { status: 422 });
    }
    await gravarSenha(cred, usuario.email, await gerarHash(nova));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ErroDeConfiguracao) return NextResponse.json({ erro: e.message }, { status: 503 });
    console.error("Falha ao trocar a senha", e);
    return NextResponse.json({ erro: "Não foi possível trocar a senha agora." }, { status: 502 });
  }
}
