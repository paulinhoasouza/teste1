import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSAO, sessaoValida } from "@/lib/servidor/sessao";

/** Só age quando APP_SENHA está definida: aí nada além da tela de entrada abre sem sessão. */
export async function proxy(req: NextRequest) {
  const senha = process.env.APP_SENHA?.trim() ?? "";
  if (!senha) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const livre = pathname === "/entrar" || pathname === "/api/entrar";
  const valida = await sessaoValida(req.cookies.get(COOKIE_SESSAO)?.value, senha);

  if (valida) {
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
