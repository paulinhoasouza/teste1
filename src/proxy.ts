import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSAO, lerSessao, loginAtivo } from "@/lib/servidor/sessao";

/** Com o banco ligado, nada além da tela de entrada abre sem sessão. Em demonstração, tudo abre. */
export async function proxy(req: NextRequest) {
  if (!loginAtivo()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const livre = pathname === "/entrar" || pathname === "/api/entrar";
  const logado = (await lerSessao(req.cookies.get(COOKIE_SESSAO)?.value)) !== null;

  if (logado) {
    return pathname === "/entrar" ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  }
  if (livre) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ erro: "Sessão expirada. Entre de novo.", login: true }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/entrar", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icone.svg|manifest.webmanifest|.*\\.(?:svg|png|ico|woff2)$).*)"],
};
