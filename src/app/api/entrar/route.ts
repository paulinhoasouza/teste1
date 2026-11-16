import { NextResponse } from "next/server";
import { ErroDeConfiguracao, credenciais } from "@/lib/servidor/ambiente";
import { buscarUsuario, registrarEntrada, registrarFalha } from "@/lib/servidor/banco";
import { HASH_DE_ENCHIMENTO, conferirSenha } from "@/lib/servidor/senha";
import { COOKIE_SESSAO, DURACAO_SEGUNDOS, criarSessao } from "@/lib/servidor/sessao";

export const dynamic = "force-dynamic";

const RECUSA = "E-mail ou senha incorretos.";

export async function POST(req: Request) {
  let email = "";
  let senha = "";
  try {
    const corpo = (await req.json()) as { email?: unknown; senha?: unknown };
    if (typeof corpo.email === "string") email = corpo.email.trim().toLowerCase().slice(0, 200);
    if (typeof corpo.senha === "string") senha = corpo.senha.slice(0, 200);
  } catch {
    /* corpo vazio conta como tentativa errada */
  }

  try {
    const cred = credenciais();
    // Demonstração: não há usuários nem nada a proteger.
    if (!cred) return NextResponse.json({ ok: true });
    if (!email || !senha) return NextResponse.json({ erro: RECUSA }, { status: 401 });

    const agora = new Date();
    const usuario = await buscarUsuario(cred, email);
    if (usuario?.bloqueadoAte && new Date(usuario.bloqueadoAte) > agora) {
      const minutos = Math.ceil((new Date(usuario.bloqueadoAte).getTime() - agora.getTime()) / 60_000);
      return NextResponse.json(
        { erro: `Muitas tentativas erradas. Tente de novo em ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.` },
        { status: 429 },
      );
    }

    // Confere sempre um hash, exista o e-mail ou não, para a resposta levar o mesmo tempo.
    const confere = await conferirSenha(senha, usuario?.senhaHash ?? HASH_DE_ENCHIMENTO);
    if (!usuario || !confere) {
      if (usuario) await registrarFalha(cred, usuario, agora);
      return NextResponse.json({ erro: RECUSA }, { status: 401 });
    }

    await registrarEntrada(cred, usuario);
    const resposta = NextResponse.json({ ok: true });
    resposta.cookies.set(COOKIE_SESSAO, await criarSessao(usuario.pessoa), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DURACAO_SEGUNDOS,
    });
    return resposta;
  } catch (e) {
    if (e instanceof ErroDeConfiguracao) return NextResponse.json({ erro: e.message }, { status: 503 });
    console.error("Falha ao entrar", e);
    return NextResponse.json({ erro: "Não foi possível entrar agora." }, { status: 502 });
  }
}
