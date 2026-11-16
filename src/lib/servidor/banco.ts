import "server-only";
import { ErroDeAcao, type Patch } from "../acoes";
import {
  categoriaParaRegistro, configParaRegistro, fixaParaRegistro, lancamentoParaRegistro,
  registroParaCategoria, registroParaConfig, registroParaFixa, registroParaLancamento, type Registro,
} from "../registros";
import type { Dados } from "../tipos";
import { ErroDeConfiguracao, type Credenciais } from "./ambiente";

/** Acesso ao Postgres do Supabase pela API de dados (PostgREST). */

type Tabela = "lancamentos" | "categorias" | "fixas" | "config";
const PAGINA = 1000;

async function pedir(c: Credenciais, caminho: string, init: RequestInit = {}): Promise<Response> {
  const r = await fetch(`${c.url}/rest/v1/${caminho}`, {
    ...init,
    headers: {
      apikey: c.chave,
      "x-app-chave": c.segredo,
      "content-type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  if (r.ok) return r;

  const corpo = (await r.json().catch(() => ({}))) as { code?: string; message?: string };
  if (corpo.code === "23505") throw new ErroDeAcao("Essa conta já foi lançada neste mês.");
  if (r.status === 401 || r.status === 403 || corpo.code === "42501") {
    throw new ErroDeConfiguracao("O banco recusou o acesso. Confira SUPABASE_KEY e BANCO_SEGREDO.");
  }
  if (r.status === 404 || corpo.code === "PGRST205" || corpo.code === "42P01") {
    throw new ErroDeConfiguracao("As tabelas do app não existem neste banco.");
  }
  throw new Error(`Banco respondeu ${r.status}: ${corpo.message ?? "sem detalhe"}`);
}

/** Lê uma tabela inteira, de mil em mil linhas. */
async function lerTudo(c: Credenciais, tabela: Tabela): Promise<Registro[]> {
  const linhas: Registro[] = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    const r = await pedir(c, `${tabela}?select=*&order=id&limit=${PAGINA}&offset=${inicio}`);
    const pagina = (await r.json()) as Registro[];
    linhas.push(...pagina);
    if (pagina.length < PAGINA) return linhas;
  }
}

export async function lerDados(c: Credenciais): Promise<Dados> {
  const [lancamentos, categorias, fixas, config] = await Promise.all([
    lerTudo(c, "lancamentos"),
    lerTudo(c, "categorias"),
    lerTudo(c, "fixas"),
    lerTudo(c, "config"),
  ]);
  // A linha de configuração sempre existe; se sumiu, o banco está escondendo tudo.
  if (!config[0]) {
    throw new ErroDeConfiguracao("O banco respondeu vazio. Confira se BANCO_SEGREDO é o mesmo gravado no banco.");
  }
  return {
    demo: false,
    lancamentos: lancamentos.map(registroParaLancamento),
    categorias: categorias.map(registroParaCategoria).sort((a, b) => a.ordem - b.ordem),
    fixas: fixas.map(registroParaFixa),
    config: registroParaConfig(config[0]),
  };
}

async function salvar(c: Credenciais, tabela: Tabela, registros: Registro[]): Promise<void> {
  if (registros.length === 0) return;
  await pedir(c, `${tabela}?on_conflict=id`, {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(registros),
  });
}

async function remover(c: Credenciais, tabela: Tabela, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const lista = ids.map((id) => `"${id.replace(/["\\]/g, "")}"`).join(",");
  await pedir(c, `${tabela}?id=in.(${encodeURIComponent(lista)})`, {
    method: "DELETE",
    headers: { prefer: "return=minimal" },
  });
}

export async function gravar(c: Credenciais, patch: Patch): Promise<void> {
  await remover(c, "lancamentos", patch.lancamentos?.remover ?? []);
  await salvar(c, "lancamentos", (patch.lancamentos?.salvar ?? []).map(lancamentoParaRegistro));
  await remover(c, "fixas", patch.fixas?.remover ?? []);
  await salvar(c, "fixas", (patch.fixas?.salvar ?? []).map(fixaParaRegistro));
  await remover(c, "categorias", patch.categorias?.remover ?? []);
  await salvar(c, "categorias", (patch.categorias?.salvar ?? []).map(categoriaParaRegistro));
  if (patch.config) await salvar(c, "config", [configParaRegistro(patch.config)]);
}

export interface Diagnostico {
  ok: boolean;
  passos: { passo: string; ok: boolean; detalhe?: string }[];
}

/** Grava, relê e apaga uma linha de teste, para provar que o banco aceita tudo o que o app faz. */
export async function diagnosticar(c: Credenciais): Promise<Diagnostico> {
  const id = "teste-de-conexao";
  const passos: Diagnostico["passos"] = [];
  const tentar = async (passo: string, fn: () => Promise<string | void>) => {
    try {
      passos.push({ passo, ok: true, detalhe: (await fn()) || undefined });
    } catch (e) {
      passos.push({ passo, ok: false, detalhe: e instanceof Error ? e.message : String(e) });
    }
  };
  const linha = (valor: number): Registro => ({
    id, data: "2000-01-01", tipo: "despesa", descricao: "Teste de conexão", valor, categoria: "outros",
    pago_por: "a", de_quem: "a", parte_a: 50, criado_por: "teste",
  });
  const reler = async () => {
    const r = await pedir(c, `lancamentos?select=valor&id=eq.${id}`);
    return (await r.json()) as { valor: number }[];
  };

  await tentar("ler", async () => {
    const d = await lerDados(c);
    return `${d.lancamentos.length} lançamentos, ${d.categorias.length} categorias`;
  });
  await tentar("criar", () => salvar(c, "lancamentos", [linha(1.23)]));
  await tentar("alterar", async () => {
    await salvar(c, "lancamentos", [linha(4.56)]);
    const [achado] = await reler();
    if (Number(achado?.valor) !== 4.56) throw new Error(`valor relido: ${achado?.valor}`);
  });
  await tentar("apagar", async () => {
    await remover(c, "lancamentos", [id]);
    if ((await reler()).length !== 0) throw new Error("a linha de teste continuou no banco");
  });
  return { ok: passos.every((p) => p.ok), passos };
}
