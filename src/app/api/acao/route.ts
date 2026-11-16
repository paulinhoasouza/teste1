import { NextResponse } from "next/server";
import { ErroDeAcao, planejar } from "@/lib/acoes";
import { carregar, quemEstaUsando } from "@/lib/servidor/acesso";
import { ErroDeConfiguracao, exigeLogin } from "@/lib/servidor/ambiente";
import { gravar } from "@/lib/servidor/planilha";

export const dynamic = "force-dynamic";

const ID = /^[a-z0-9]{8,20}$/;

export async function POST(req: Request) {
  let corpo: { acao?: unknown; ids?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }

  // O cliente propõe os ids para que a tela e a planilha fiquem iguais sem esperar a resposta.
  const propostos = Array.isArray(corpo.ids)
    ? corpo.ids.filter((x): x is string => typeof x === "string" && ID.test(x))
    : [];

  try {
    const { dados, cred } = await carregar();
    if (cred && !exigeLogin()) throw new ErroDeConfiguracao("Falta a variável APP_SENHA.");
    const usados = new Set([
      ...dados.lancamentos.flatMap((l) => [l.id, l.grupo]),
      ...dados.fixas.map((f) => f.id),
    ]);
    const patch = planejar(corpo.acao, dados, {
      quem: await quemEstaUsando(),
      agora: new Date().toISOString(),
      novoId: () => {
        let id = propostos.shift();
        while (!id || usados.has(id)) id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
        usados.add(id);
        return id;
      },
    });
    if (cred) await gravar(cred, patch);
    return NextResponse.json({ patch });
  } catch (e) {
    if (e instanceof ErroDeAcao) return NextResponse.json({ erro: e.message }, { status: 422 });
    if (e instanceof ErroDeConfiguracao) return NextResponse.json({ erro: e.message }, { status: 503 });
    console.error("Falha ao gravar na planilha", e);
    return NextResponse.json({ erro: "Não foi possível gravar na planilha. Nada foi alterado." }, { status: 502 });
  }
}
