import { NextResponse } from "next/server";
import { ErroDeConfiguracao, credenciais } from "@/lib/servidor/ambiente";
import { lerAtividades } from "@/lib/servidor/banco";

export const dynamic = "force-dynamic";

/** Atividades anteriores a ?antes=<instante ISO>, de 100 em 100. */
export async function GET(req: Request) {
  const antes = new URL(req.url).searchParams.get("antes") ?? "";
  if (Number.isNaN(Date.parse(antes))) return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  try {
    const cred = credenciais();
    if (!cred) return NextResponse.json({ atividades: [] });
    return NextResponse.json({ atividades: await lerAtividades(cred, { antes: new Date(antes).toISOString(), limite: 100 }) });
  } catch (e) {
    if (e instanceof ErroDeConfiguracao) return NextResponse.json({ erro: e.message }, { status: 503 });
    console.error("Falha ao ler atividades", e);
    return NextResponse.json({ erro: "Não foi possível carregar o histórico." }, { status: 502 });
  }
}
