import { NextResponse } from "next/server";
import { ErroDeConfiguracao, credenciais } from "@/lib/servidor/ambiente";
import { diagnosticar } from "@/lib/servidor/banco";

export const dynamic = "force-dynamic";

/** Testa a conexão com o banco gravando e apagando uma linha de teste. */
export async function GET() {
  try {
    const cred = credenciais();
    if (!cred) return NextResponse.json({ ok: false, modo: "demonstração", passos: [] });
    return NextResponse.json(await diagnosticar(cred), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    const erro = e instanceof ErroDeConfiguracao ? e.message : "Falha inesperada no teste.";
    return NextResponse.json({ ok: false, erro }, { status: 503 });
  }
}
