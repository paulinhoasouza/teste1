import { daPlanilha, paraPlanilha } from "./dinheiro";
import type { Categoria, Config, CorPessoa, Dono, Fixa, Lancamento, PessoaId } from "./tipos";

/** Uma célula como a API do Google Sheets devolve com UNFORMATTED_VALUE. */
export type Celula = string | number | boolean | null | undefined;
export type Linha = Celula[];

export const ABAS = {
  lancamentos: {
    nome: "Lancamentos",
    colunas: [
      "id", "data", "tipo", "descricao", "valor", "categoria", "pago_por", "de_quem",
      "parte_a", "parcela", "grupo", "fixa_id", "mes_ref", "criado_em", "criado_por",
    ],
  },
  categorias: { nome: "Categorias", colunas: ["id", "nome", "tipo", "orcamento", "ordem", "arquivada"] },
  fixas: {
    nome: "Fixas",
    colunas: [
      "id", "descricao", "tipo", "valor", "dia", "categoria", "pago_por", "de_quem",
      "parte_a", "ativa", "inicio", "fim",
    ],
  },
  config: { nome: "Config", colunas: ["chave", "valor"] },
} as const;

export function letraDaColuna(n: number): string {
  return String.fromCharCode(64 + n);
}

const txt = (c: Celula): string => (c === null || c === undefined ? "" : String(c).trim());

function num(c: Celula, padrao = 0): number {
  if (typeof c === "number") return c;
  const n = Number.parseFloat(txt(c).replace(",", "."));
  return Number.isFinite(n) ? n : padrao;
}

function bool(c: Celula): boolean {
  if (typeof c === "boolean") return c;
  return ["true", "verdadeiro", "sim", "1"].includes(txt(c).toLowerCase());
}

/** Aceita "2026-11-16", "16/11/2026" ou o número de série de uma data digitada na planilha. */
export function lerData(c: Celula): string {
  if (typeof c === "number") {
    return new Date(Math.round((c - 25569) * 86400000)).toISOString().slice(0, 10);
  }
  const s = txt(c);
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (br) return `${br[3]}-${br[2]!.padStart(2, "0")}-${br[1]!.padStart(2, "0")}`;
  return s.slice(0, 10);
}

/** Mês "yyyy-mm"; a planilha pode ter convertido o texto em data. */
function lerMes(c: Celula): string {
  return typeof c === "number" ? lerData(c).slice(0, 7) : txt(c).slice(0, 7);
}

const pessoa = (c: Celula): PessoaId => (txt(c).toLowerCase() === "b" ? "b" : "a");

function dono(c: Celula): Dono {
  const s = txt(c).toLowerCase();
  return s === "a" || s === "b" ? s : "casal";
}

function parte(c: Celula): number {
  return Math.min(100, Math.max(0, Math.round(num(c, 50))));
}

export function lancamentoParaLinha(l: Lancamento): Linha {
  return [
    l.id, l.data, l.tipo, l.descricao, paraPlanilha(l.valor), l.categoria, l.pagoPor, l.deQuem,
    l.parteA, l.parcela, l.grupo, l.fixaId, l.mesRef, l.criadoEm, l.criadoPor,
  ];
}

export function linhaParaLancamento(r: Linha): Lancamento | null {
  const id = txt(r[0]);
  const data = lerData(r[1]);
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const tipo = txt(r[2]).toLowerCase();
  return {
    id,
    data,
    tipo: tipo === "receita" || tipo === "acerto" ? tipo : "despesa",
    descricao: txt(r[3]),
    valor: Math.abs(daPlanilha(r[4])),
    categoria: txt(r[5]),
    pagoPor: pessoa(r[6]),
    deQuem: dono(r[7]),
    parteA: parte(r[8]),
    parcela: txt(r[9]),
    grupo: txt(r[10]),
    fixaId: txt(r[11]),
    mesRef: lerMes(r[12]),
    criadoEm: txt(r[13]),
    criadoPor: txt(r[14]),
  };
}

export function categoriaParaLinha(c: Categoria): Linha {
  return [c.id, c.nome, c.tipo, paraPlanilha(c.orcamento), c.ordem, c.arquivada];
}

export function linhaParaCategoria(r: Linha): Categoria | null {
  const id = txt(r[0]);
  if (!id) return null;
  return {
    id,
    nome: txt(r[1]) || id,
    tipo: txt(r[2]).toLowerCase() === "receita" ? "receita" : "despesa",
    orcamento: Math.max(0, daPlanilha(r[3])),
    ordem: num(r[4]),
    arquivada: bool(r[5]),
  };
}

export function fixaParaLinha(f: Fixa): Linha {
  return [
    f.id, f.descricao, f.tipo, paraPlanilha(f.valor), f.dia, f.categoria, f.pagoPor, f.deQuem,
    f.parteA, f.ativa, f.inicio, f.fim,
  ];
}

export function linhaParaFixa(r: Linha): Fixa | null {
  const id = txt(r[0]);
  if (!id) return null;
  return {
    id,
    descricao: txt(r[1]),
    tipo: txt(r[2]).toLowerCase() === "receita" ? "receita" : "despesa",
    valor: Math.abs(daPlanilha(r[3])),
    dia: Math.min(31, Math.max(1, Math.round(num(r[4], 1)))),
    categoria: txt(r[5]),
    pagoPor: pessoa(r[6]),
    deQuem: dono(r[7]),
    parteA: parte(r[8]),
    ativa: r[9] === undefined || r[9] === "" ? true : bool(r[9]),
    inicio: lerMes(r[10]),
    fim: lerMes(r[11]),
  };
}

const CORES: CorPessoa[] = ["azul", "laranja", "verde", "rosa", "oliva"];
const cor = (c: Celula, padrao: CorPessoa): CorPessoa =>
  CORES.includes(txt(c) as CorPessoa) ? (txt(c) as CorPessoa) : padrao;

export function configParaLinhas(c: Config): Linha[] {
  return [
    ["nome_a", c.nomeA],
    ["nome_b", c.nomeB],
    ["cor_a", c.corA],
    ["cor_b", c.corB],
    ["parte_a_padrao", c.parteAPadrao],
  ];
}

export function linhasParaConfig(linhas: Linha[]): Config {
  const m = new Map(linhas.map((r) => [txt(r[0]), r[1]]));
  const corA = cor(m.get("cor_a"), "azul");
  let corB = cor(m.get("cor_b"), "laranja");
  if (corB === corA) corB = corA === "laranja" ? "azul" : "laranja";
  return {
    nomeA: txt(m.get("nome_a")),
    nomeB: txt(m.get("nome_b")),
    corA,
    corB,
    parteAPadrao: parte(m.get("parte_a_padrao")),
  };
}
