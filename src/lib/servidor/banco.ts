import "server-only";
import { ErroDeAcao, type Patch } from "../acoes";
import {
  categoriaParaRegistro, configParaRegistro, fixaParaRegistro, lancamentoParaRegistro,
  atividadeParaRegistro, registroParaAtividade, registroParaCategoria, registroParaComprovante, registroParaConfig, registroParaFixa, registroParaLancamento,
  type Registro,
} from "../registros";
import type { Atividade, Comprovante, Dados, PessoaId } from "../tipos";
import { ErroDeConfiguracao, type Credenciais } from "./ambiente";

/** Acesso ao Postgres do Supabase pela API de dados (PostgREST). */

type Tabela = "lancamentos" | "categorias" | "fixas" | "config" | "comprovantes";
/** Quantas atividades vêm junto com os dados; as mais antigas, pela rota de atividades. */
export const ATIVIDADES_RECENTES = 200;
const MAXIMO_DE_FALHAS = 5;
const MINUTOS_DE_BLOQUEIO = 15;
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
async function lerTudo(c: Credenciais, tabela: Tabela, colunas = "*"): Promise<Registro[]> {
  const linhas: Registro[] = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    const r = await pedir(c, `${tabela}?select=${colunas}&order=id&limit=${PAGINA}&offset=${inicio}`);
    const pagina = (await r.json()) as Registro[];
    linhas.push(...pagina);
    if (pagina.length < PAGINA) return linhas;
  }
}

export async function lerDados(c: Credenciais): Promise<Dados> {
  const [lancamentos, categorias, fixas, config, comprovantes, atividades] = await Promise.all([
    lerTudo(c, "lancamentos"),
    lerTudo(c, "categorias"),
    lerTudo(c, "fixas"),
    lerTudo(c, "config"),
    lerComprovantes(c),
    lerAtividades(c, { limite: ATIVIDADES_RECENTES }),
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
    comprovantes,
    atividades,
  };
}

/** As mais recentes primeiro; `antes` pega as anteriores a um instante. Sem a tabela, volta vazio. */
export async function lerAtividades(c: Credenciais, { antes, limite }: { antes?: string; limite: number }): Promise<Atividade[]> {
  const filtro = antes ? `&quando=lt.${encodeURIComponent(antes)}` : "";
  try {
    const r = await pedir(c, `atividades?select=*&order=quando.desc,id.desc&limit=${limite}${filtro}`);
    return ((await r.json()) as Registro[]).map(registroParaAtividade);
  } catch (e) {
    if (e instanceof ErroDeConfiguracao) return [];
    throw e;
  }
}

export async function registrarAtividade(c: Credenciais, a: Atividade): Promise<void> {
  await pedir(c, "atividades", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify(atividadeParaRegistro(a)),
  });
}

/** A lista de comprovantes, sem o conteúdo. Se a tabela ainda não existe, o resto do app segue funcionando. */
async function lerComprovantes(c: Credenciais): Promise<Comprovante[]> {
  try {
    const linhas = await lerTudo(c, "comprovantes", "id,dono,nome,tipo,tamanho,criado_em,criado_por");
    return linhas.map(registroParaComprovante);
  } catch (e) {
    if (e instanceof ErroDeConfiguracao) return [];
    throw e;
  }
}

export async function guardarComprovante(
  c: Credenciais,
  dados: Omit<Comprovante, "criadoEm"> & { conteudo: string },
): Promise<void> {
  await pedir(c, "comprovantes", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({
      id: dados.id, dono: dados.dono, nome: dados.nome, tipo: dados.tipo,
      tamanho: dados.tamanho, conteudo: dados.conteudo, criado_por: dados.criadoPor,
    }),
  });
}

/** O arquivo de um comprovante; null se não existe. */
export async function lerArquivo(c: Credenciais, id: string): Promise<{ tipo: string; nome: string; bytes: Buffer } | null> {
  const r = await pedir(c, `comprovantes?select=tipo,nome,conteudo&id=eq.${encodeURIComponent(id)}&limit=1`);
  const [linha] = (await r.json()) as Registro[];
  if (!linha) return null;
  return { tipo: String(linha.tipo), nome: String(linha.nome ?? ""), bytes: Buffer.from(String(linha.conteudo), "base64") };
}

export async function apagarComprovantes(c: Credenciais, filtro: { ids?: string[]; donos?: string[] }): Promise<void> {
  const lista = (xs: string[]) => encodeURIComponent(xs.map((x) => `"${x.replace(/["\\]/g, "")}"`).join(","));
  if (filtro.ids?.length) {
    await pedir(c, `comprovantes?id=in.(${lista(filtro.ids)})`, { method: "DELETE", headers: { prefer: "return=minimal" } });
  }
  if (filtro.donos?.length) {
    await pedir(c, `comprovantes?dono=in.(${lista(filtro.donos)})`, { method: "DELETE", headers: { prefer: "return=minimal" } });
  }
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

export interface Usuario {
  email: string;
  pessoa: PessoaId;
  senhaHash: string;
  falhas: number;
  /** Instante até o qual novas tentativas são recusadas; null = livre. */
  bloqueadoAte: string | null;
}

async function umUsuario(c: Credenciais, filtro: string): Promise<Usuario | null> {
  const r = await pedir(c, `usuarios?select=*&${filtro}&limit=1`);
  const [u] = (await r.json()) as Registro[];
  if (!u) return null;
  return {
    email: String(u.email),
    pessoa: u.pessoa === "b" ? "b" : "a",
    senhaHash: String(u.senha_hash ?? ""),
    falhas: Number(u.falhas ?? 0),
    bloqueadoAte: u.bloqueado_ate ? String(u.bloqueado_ate) : null,
  };
}

export function buscarUsuario(c: Credenciais, email: string): Promise<Usuario | null> {
  return umUsuario(c, `email=eq.${encodeURIComponent(email.trim().toLowerCase())}`);
}

export function buscarUsuarioDaPessoa(c: Credenciais, pessoa: PessoaId): Promise<Usuario | null> {
  return umUsuario(c, `pessoa=eq.${pessoa}`);
}

async function alterarUsuario(c: Credenciais, email: string, campos: Registro): Promise<void> {
  await pedir(c, `usuarios?email=eq.${encodeURIComponent(email)}`, {
    method: "PATCH",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify(campos),
  });
}

/** Conta uma senha errada; na quinta seguida, bloqueia o e-mail por um tempo. */
export async function registrarFalha(c: Credenciais, u: Usuario, agora: Date): Promise<void> {
  const falhas = u.falhas + 1;
  if (falhas >= MAXIMO_DE_FALHAS) {
    const ate = new Date(agora.getTime() + MINUTOS_DE_BLOQUEIO * 60_000).toISOString();
    await alterarUsuario(c, u.email, { falhas: 0, bloqueado_ate: ate });
  } else {
    await alterarUsuario(c, u.email, { falhas });
  }
}

export async function registrarEntrada(c: Credenciais, u: Usuario): Promise<void> {
  if (u.falhas > 0 || u.bloqueadoAte) await alterarUsuario(c, u.email, { falhas: 0, bloqueado_ate: null });
}

export async function gravarSenha(c: Credenciais, email: string, senhaHash: string): Promise<void> {
  await alterarUsuario(c, email, { senha_hash: senhaHash, falhas: 0, bloqueado_ate: null });
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
