import "server-only";
import { SignJWT, importPKCS8 } from "jose";
import type { Patch } from "../acoes";
import {
  ABAS, categoriaParaLinha, configParaLinhas, fixaParaLinha, lancamentoParaLinha, letraDaColuna,
  linhaParaCategoria, linhaParaFixa, linhaParaLancamento, linhasParaConfig, type Linha,
} from "../linhas";
import { CATEGORIAS_INICIAIS, CONFIG_INICIAL } from "../padroes";
import type { Dados } from "../tipos";
import { ErroDeConfiguracao, type Credenciais } from "./ambiente";

const API = "https://sheets.googleapis.com/v4/spreadsheets";

class ErroDoGoogle extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

let tokenGuardado: { valor: string; expira: number; email: string } | null = null;

async function token(c: Credenciais): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  if (tokenGuardado && tokenGuardado.email === c.email && tokenGuardado.expira - 60 > agora) {
    return tokenGuardado.valor;
  }
  let chave;
  try {
    chave = await importPKCS8(c.chave, "RS256");
  } catch {
    throw new ErroDeConfiguracao("A chave privada da conta de serviço está incompleta ou mal copiada.");
  }
  const assinado = await new SignJWT({ scope: "https://www.googleapis.com/auth/spreadsheets" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(c.email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(agora)
    .setExpirationTime(agora + 3600)
    .sign(chave);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: assinado,
    }),
    cache: "no-store",
  });
  if (!r.ok) {
    throw new ErroDeConfiguracao("O Google recusou a conta de serviço. Confira se a chave ainda está ativa.");
  }
  const j = (await r.json()) as { access_token: string; expires_in: number };
  tokenGuardado = { valor: j.access_token, expira: agora + j.expires_in, email: c.email };
  return j.access_token;
}

async function chamar<T>(c: Credenciais, caminho: string, corpo?: unknown): Promise<T> {
  const r = await fetch(`${API}/${c.planilhaId}${caminho}`, {
    method: corpo === undefined ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${await token(c)}`,
      ...(corpo === undefined ? {} : { "content-type": "application/json" }),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    cache: "no-store",
  });
  if (r.ok) return (await r.json()) as T;
  const detalhe = await r.text();
  if (r.status === 403) {
    throw new ErroDeConfiguracao(
      `A planilha não está compartilhada com ${c.email}. Compartilhe como Editor e tente de novo.`,
    );
  }
  if (r.status === 404) {
    throw new ErroDeConfiguracao("Planilha não encontrada. Confira o endereço em GOOGLE_SHEET_ID.");
  }
  throw new ErroDoGoogle(r.status, detalhe.slice(0, 300));
}

type NomeDaAba = (typeof ABAS)[keyof typeof ABAS]["nome"];

function intervalo(aba: keyof typeof ABAS, linhas = ""): string {
  const { nome, colunas } = ABAS[aba];
  return `${nome}!A2:${letraDaColuna(colunas.length)}${linhas}`;
}

interface Metadados {
  sheets: { properties: { sheetId: number; title: string } }[];
}

async function idsDasAbas(c: Credenciais): Promise<Map<string, number>> {
  const meta = await chamar<Metadados>(c, "?fields=sheets.properties(sheetId,title)");
  return new Map(meta.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
}

/** Cria as abas que faltam, com cabeçalho; categorias e config já nascem preenchidas. */
async function preparar(c: Credenciais): Promise<void> {
  const existentes = await idsDasAbas(c);
  const faltam = Object.values(ABAS).filter((a) => !existentes.has(a.nome));
  if (faltam.length === 0) return;
  await chamar(c, ":batchUpdate", {
    requests: faltam.map((a) => ({
      addSheet: { properties: { title: a.nome, gridProperties: { frozenRowCount: 1 } } },
    })),
  });
  const dados: { range: string; values: Linha[] }[] = faltam.map((a) => ({
    range: `${a.nome}!A1`,
    values: [[...a.colunas]],
  }));
  const nomes = new Set<NomeDaAba>(faltam.map((a) => a.nome));
  if (nomes.has("Categorias")) {
    dados.push({ range: "Categorias!A2", values: CATEGORIAS_INICIAIS.map(categoriaParaLinha) });
  }
  if (nomes.has("Config")) {
    dados.push({ range: "Config!A2", values: configParaLinhas(CONFIG_INICIAL) });
  }
  await chamar(c, "/values:batchUpdate", { valueInputOption: "RAW", data: dados });
}

interface Lote {
  valueRanges: { values?: Linha[] }[];
}

async function lerLote(c: Credenciais): Promise<Lote> {
  const q = new URLSearchParams({ valueRenderOption: "UNFORMATTED_VALUE" });
  for (const aba of ["lancamentos", "categorias", "fixas", "config"] as const) {
    q.append("ranges", intervalo(aba));
  }
  return chamar<Lote>(c, `/values:batchGet?${q}`);
}

function presentes<T>(linhas: Linha[] | undefined, ler: (l: Linha) => T | null): T[] {
  return (linhas ?? []).map(ler).filter((x): x is T => x !== null);
}

export async function lerDados(c: Credenciais): Promise<Dados> {
  let lote: Lote;
  try {
    lote = await lerLote(c);
  } catch (e) {
    // Aba inexistente: primeira vez nesta planilha.
    if (!(e instanceof ErroDoGoogle) || e.status !== 400) throw e;
    await preparar(c);
    lote = await lerLote(c);
  }
  const [lancamentos, categorias, fixas, config] = lote.valueRanges;
  return {
    demo: false,
    lancamentos: presentes(lancamentos?.values, linhaParaLancamento),
    categorias: presentes(categorias?.values, linhaParaCategoria).sort((a, b) => a.ordem - b.ordem),
    fixas: presentes(fixas?.values, linhaParaFixa),
    config: linhasParaConfig(config?.values ?? []),
  };
}

interface Mudanca {
  aba: keyof typeof ABAS;
  salvar: { id: string; linha: Linha }[];
  remover: string[];
}

export async function gravar(c: Credenciais, patch: Patch): Promise<void> {
  const mudancas: Mudanca[] = [
    {
      aba: "lancamentos",
      salvar: (patch.lancamentos?.salvar ?? []).map((x) => ({ id: x.id, linha: lancamentoParaLinha(x) })),
      remover: patch.lancamentos?.remover ?? [],
    },
    {
      aba: "fixas",
      salvar: (patch.fixas?.salvar ?? []).map((x) => ({ id: x.id, linha: fixaParaLinha(x) })),
      remover: patch.fixas?.remover ?? [],
    },
    {
      aba: "categorias",
      salvar: (patch.categorias?.salvar ?? []).map((x) => ({ id: x.id, linha: categoriaParaLinha(x) })),
      remover: patch.categorias?.remover ?? [],
    },
  ].filter((m): m is Mudanca => m.salvar.length > 0 || m.remover.length > 0);

  const atualizar: { range: string; values: Linha[] }[] = [];
  const exclusoes: { aba: NomeDaAba; linha: number }[] = [];

  for (const m of mudancas) {
    const { nome } = ABAS[m.aba];
    // Em que linha está cada id agora; a planilha pode ter sido mexida à mão.
    const coluna = await chamar<{ values?: Linha[] }>(
      c,
      `/values/${encodeURIComponent(`${nome}!A2:A`)}?valueRenderOption=UNFORMATTED_VALUE`,
    );
    const linhaDoId = new Map<string, number>();
    (coluna.values ?? []).forEach((r, i) => {
      const id = r[0] === undefined || r[0] === null ? "" : String(r[0]).trim();
      if (id) linhaDoId.set(id, i + 2);
    });

    const novas: Linha[] = [];
    for (const s of m.salvar) {
      const n = linhaDoId.get(s.id);
      if (n) atualizar.push({ range: intervalo(m.aba, String(n)).replace("A2", `A${n}`), values: [s.linha] });
      else novas.push(s.linha);
    }
    if (novas.length > 0) {
      await chamar(
        c,
        `/values/${encodeURIComponent(`${nome}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        { values: novas },
      );
    }
    for (const id of m.remover) {
      const n = linhaDoId.get(id);
      if (n) exclusoes.push({ aba: nome, linha: n });
    }
  }

  if (patch.config) {
    atualizar.push({ range: "Config!A2", values: configParaLinhas(patch.config) });
  }
  if (atualizar.length > 0) {
    await chamar(c, "/values:batchUpdate", { valueInputOption: "RAW", data: atualizar });
  }
  if (exclusoes.length > 0) {
    const ids = await idsDasAbas(c);
    // De baixo para cima, para que apagar uma linha não desloque as outras.
    exclusoes.sort((x, y) => y.linha - x.linha);
    await chamar(c, ":batchUpdate", {
      requests: exclusoes.map((e) => ({
        deleteDimension: {
          range: { sheetId: ids.get(e.aba), dimension: "ROWS", startIndex: e.linha - 1, endIndex: e.linha },
        },
      })),
    });
  }
}
