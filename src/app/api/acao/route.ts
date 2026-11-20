import { NextResponse } from "next/server";
import { ErroDeAcao, planejar } from "@/lib/acoes";
import { carregar, quemEstaUsando } from "@/lib/servidor/acesso";
import { ErroDeConfiguracao } from "@/lib/servidor/ambiente";
import { descrever, novoIdDeAtividade } from "@/lib/atividade";
import { donosOrfaos } from "@/lib/comprovantes";
import { anotar } from "@/lib/servidor/anotar";
import { apagarComprovantes, gravar } from "@/lib/servidor/banco";

export const dynamic = "force-dynamic";

const ID = /^[a-z0-9]{8,20}$/;

export async function POST(req: Request) {
  let corpo: { acao?: unknown; ids?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }

  // O cliente propõe os ids para que a tela e o banco fiquem iguais sem esperar a resposta.
  const propostos = Array.isArray(corpo.ids)
    ? corpo.ids.filter((x): x is string => typeof x === "string" && ID.test(x))
    : [];

  try {
    const { dados, cred } = await carregar();
    const usados = new Set([
      ...dados.lancamentos.flatMap((l) => [l.id, l.grupo]),
      ...dados.fixas.map((f) => f.id),
    ]);
    const quem = await quemEstaUsando();
    const agora = new Date().toISOString();
    const patch = planejar(corpo.acao, dados, {
      quem,
      agora,
      novoId: () => {
        let id = propostos.shift();
        while (!id || usados.has(id)) id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
        usados.add(id);
        return id;
      },
    });
    if (cred) {
      await gravar(cred, patch);
      // Lançamento excluído leva os comprovantes junto; uma parcela só, não (o comprovante é da compra).
      const orfaos = donosOrfaos(dados.lancamentos, patch.lancamentos?.remover ?? []);
      if (orfaos.length) {
        await apagarComprovantes(cred, { donos: orfaos }).catch((e) => console.error("Comprovantes órfãos ficaram", e));
      }
      await anotar(cred, descrever(corpo.acao, dados, patch, { id: novoIdDeAtividade(), quando: agora, quem }));
    }
    return NextResponse.json({ patch });
  } catch (e) {
    if (e instanceof ErroDeAcao) return NextResponse.json({ erro: e.message }, { status: 422 });
    if (e instanceof ErroDeConfiguracao) return NextResponse.json({ erro: e.message }, { status: 503 });
    console.error("Falha ao gravar no banco", e);
    return NextResponse.json({ erro: "Não foi possível gravar. Nada foi alterado." }, { status: 502 });
  }
}
