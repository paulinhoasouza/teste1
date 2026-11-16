import { NextResponse } from "next/server";
import { senhaDoApp } from "@/lib/servidor/ambiente";
import { COOKIE_SESSAO, DURACAO_SEGUNDOS, criarSessao, senhaConfere } from "@/lib/servidor/sessao";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const senha = senhaDoApp();
  if (!senha) return NextResponse.json({ ok: true });

  let tentativa = "";
  try {
    const corpo = (await req.json()) as { senha?: unknown };
    if (typeof corpo.senha === "string") tentativa = corpo.senha.trim();
  } catch {
    /* corpo vazio conta como senha errada */
  }

  if (!(await senhaConfere(tentativa, senha))) {
    // Atraso fixo: torna tentativas em série lentas.
    await new Promise((r) => setTimeout(r, 900));
    return NextResponse.json({ erro: "Senha incorreta." }, { status: 401 });
  }

  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.set(COOKIE_SESSAO, await criarSessao(senha), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_SEGUNDOS,
  });
  return resposta;
}
