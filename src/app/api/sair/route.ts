import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { descreverAcesso, novoIdDeAtividade } from "@/lib/atividade";
import { credenciais } from "@/lib/servidor/ambiente";
import { anotar } from "@/lib/servidor/anotar";
import { COOKIE_SESSAO, lerSessao } from "@/lib/servidor/sessao";

export async function POST() {
  const quem = await lerSessao((await cookies()).get(COOKIE_SESSAO)?.value);
  if (quem) {
    let cred = null;
    try {
      cred = credenciais();
    } catch {
      /* sem banco configurado, só sai */
    }
    await anotar(cred, descreverAcesso("acesso.sair", { id: novoIdDeAtividade(), quando: new Date().toISOString(), quem }));
  }
  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.delete(COOKIE_SESSAO);
  return resposta;
}
