import { NextResponse } from "next/server";
import { descreverComprovante, novoIdDeAtividade } from "@/lib/atividade";
import { donoDoComprovante, MAXIMO_POR_LANCAMENTO, reconhecer, TAMANHO_MAXIMO } from "@/lib/comprovantes";
import { carregar, quemEstaUsando } from "@/lib/servidor/acesso";
import { ErroDeConfiguracao } from "@/lib/servidor/ambiente";
import { anotar } from "@/lib/servidor/anotar";
import { guardarComprovante } from "@/lib/servidor/banco";
import type { Comprovante } from "@/lib/tipos";

export const dynamic = "force-dynamic";

/** Recebe um arquivo (multipart: dono, arquivo) e guarda no banco. */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  const dono = form.get("dono");
  const arquivo = form.get("arquivo");
  if (typeof dono !== "string" || !dono || !(arquivo instanceof File)) {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return NextResponse.json({ erro: "Esse arquivo passa de 3 MB. Tente uma foto ou um PDF menor." }, { status: 413 });
  }

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const tipo = reconhecer(bytes);
  if (!tipo) {
    return NextResponse.json({ erro: "Só dá para anexar foto (JPEG, PNG, WebP, HEIC) ou PDF." }, { status: 415 });
  }

  try {
    const { dados, cred } = await carregar();
    if (!cred) {
      return NextResponse.json({ erro: "Ligue o banco de dados para guardar comprovantes." }, { status: 503 });
    }
    const existe = dados.lancamentos.some((l) => donoDoComprovante(l) === dono);
    if (!existe) return NextResponse.json({ erro: "Esse lançamento não existe mais." }, { status: 404 });
    if (dados.comprovantes.filter((c) => c.dono === dono).length >= MAXIMO_POR_LANCAMENTO) {
      return NextResponse.json({ erro: `Cada lançamento guarda até ${MAXIMO_POR_LANCAMENTO} comprovantes.` }, { status: 422 });
    }

    const comprovante: Comprovante = {
      id: crypto.randomUUID().replace(/-/g, ""),
      dono,
      nome: arquivo.name.replace(/[\u0000-\u001f]/g, "").slice(0, 120),
      tipo,
      tamanho: bytes.byteLength,
      criadoEm: new Date().toISOString(),
      criadoPor: await quemEstaUsando(),
    };
    await guardarComprovante(cred, { ...comprovante, conteudo: Buffer.from(bytes).toString("base64") });
    await anotar(cred, descreverComprovante("anexar", comprovante, dados, {
      id: novoIdDeAtividade(), quando: comprovante.criadoEm, quem: comprovante.criadoPor === "b" ? "b" : "a",
    }));
    return NextResponse.json({ comprovante });
  } catch (e) {
    if (e instanceof ErroDeConfiguracao) return NextResponse.json({ erro: e.message }, { status: 503 });
    console.error("Falha ao guardar comprovante", e);
    return NextResponse.json({ erro: "Não foi possível guardar o comprovante." }, { status: 502 });
  }
}
