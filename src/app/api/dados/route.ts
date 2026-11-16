import { NextResponse } from "next/server";
import { carregar } from "@/lib/servidor/acesso";
import { ErroDeConfiguracao, exigeLogin } from "@/lib/servidor/ambiente";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { dados, cred } = await carregar();
    if (cred && !exigeLogin()) {
      throw new ErroDeConfiguracao(
        "A planilha está conectada, mas falta a variável APP_SENHA. Sem ela, qualquer pessoa com o endereço veria suas finanças.",
      );
    }
    return NextResponse.json(dados, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof ErroDeConfiguracao) {
      return NextResponse.json({ erro: e.message, configuracao: true }, { status: 503 });
    }
    console.error("Falha ao ler a planilha", e);
    return NextResponse.json({ erro: "Não foi possível ler a planilha agora." }, { status: 502 });
  }
}
