import { NextResponse } from "next/server";
import { carregar } from "@/lib/servidor/acesso";
import { ErroDeConfiguracao } from "@/lib/servidor/ambiente";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { dados } = await carregar();
    return NextResponse.json(dados, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof ErroDeConfiguracao) {
      return NextResponse.json({ erro: e.message, configuracao: true }, { status: 503 });
    }
    console.error("Falha ao ler o banco", e);
    return NextResponse.json({ erro: "Não foi possível ler os dados agora." }, { status: 502 });
  }
}
