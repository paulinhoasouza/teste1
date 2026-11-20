import { NextResponse } from "next/server";
import { descreverComprovante, novoIdDeAtividade } from "@/lib/atividade";
import { TIPOS_ACEITOS } from "@/lib/comprovantes";
import { carregar, quemEstaUsando } from "@/lib/servidor/acesso";
import { ErroDeConfiguracao, credenciais } from "@/lib/servidor/ambiente";
import { anotar } from "@/lib/servidor/anotar";
import { apagarComprovantes, lerArquivo } from "@/lib/servidor/banco";

export const dynamic = "force-dynamic";

const ID = /^[a-f0-9]{16,32}$/;
type Params = { params: Promise<{ id: string }> };

/** Abre o arquivo. ?baixar=1 pede para salvar em vez de mostrar. */
export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  if (!ID.test(id)) return new NextResponse(null, { status: 404 });
  try {
    const cred = credenciais();
    if (!cred) return new NextResponse(null, { status: 404 });
    const arquivo = await lerArquivo(cred, id);
    if (!arquivo || !(TIPOS_ACEITOS as readonly string[]).includes(arquivo.tipo)) {
      return new NextResponse(null, { status: 404 });
    }
    const baixar = new URL(req.url).searchParams.has("baixar");
    const nome = encodeURIComponent(arquivo.nome || `comprovante-${id.slice(0, 6)}`);
    return new NextResponse(new Uint8Array(arquivo.bytes), {
      headers: {
        "content-type": arquivo.tipo,
        "content-length": String(arquivo.bytes.byteLength),
        "content-disposition": `${baixar ? "attachment" : "inline"}; filename*=UTF-8''${nome}`,
        // O conteúdo de um id nunca muda; e só fica guardado no aparelho de quem abriu.
        "cache-control": "private, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; object-src 'self'",
      },
    });
  } catch (e) {
    if (e instanceof ErroDeConfiguracao) return NextResponse.json({ erro: e.message }, { status: 503 });
    console.error("Falha ao ler comprovante", e);
    return NextResponse.json({ erro: "Não foi possível abrir o comprovante." }, { status: 502 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  if (!ID.test(id)) return NextResponse.json({ erro: "Comprovante inválido." }, { status: 400 });
  try {
    const { dados, cred } = await carregar();
    if (!cred) return NextResponse.json({ erro: "Ligue o banco de dados para guardar comprovantes." }, { status: 503 });
    const comprovante = dados.comprovantes.find((c) => c.id === id);
    await apagarComprovantes(cred, { ids: [id] });
    if (comprovante) {
      await anotar(cred, descreverComprovante("apagar", comprovante, dados, {
        id: novoIdDeAtividade(), quando: new Date().toISOString(), quem: await quemEstaUsando(),
      }));
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ErroDeConfiguracao) return NextResponse.json({ erro: e.message }, { status: 503 });
    console.error("Falha ao apagar comprovante", e);
    return NextResponse.json({ erro: "Não foi possível apagar o comprovante." }, { status: 502 });
  }
}
