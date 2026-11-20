import { deReais, paraReais } from "./dinheiro";
import type { Categoria, Config, CorPessoa, Dono, Fixa, Lancamento, PessoaId } from "./tipos";

/** Uma linha de tabela como a API do banco devolve. */
export type Registro = Record<string, unknown>;

const txt = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());
const pessoa = (v: unknown): PessoaId => (txt(v) === "b" ? "b" : "a");

function dono(v: unknown): Dono {
  const s = txt(v);
  return s === "a" || s === "b" ? s : "casal";
}

function inteiro(v: unknown, padrao: number, min: number, max: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : padrao;
}

/** O banco devolve a hora com fuso; o app usa sempre o formato ISO em UTC. */
function instante(v: unknown): string {
  const d = new Date(txt(v));
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export function lancamentoParaRegistro(l: Lancamento): Registro {
  return {
    id: l.id, data: l.data, tipo: l.tipo, descricao: l.descricao, valor: paraReais(l.valor),
    categoria: l.categoria, pago_por: l.pagoPor, de_quem: l.deQuem, parte_a: l.parteA,
    parcela: l.parcela, grupo: l.grupo, fixa_id: l.fixaId, mes_ref: l.mesRef,
    criado_em: l.criadoEm, criado_por: l.criadoPor,
  };
}

export function registroParaLancamento(r: Registro): Lancamento {
  const tipo = txt(r.tipo);
  return {
    id: txt(r.id),
    data: txt(r.data).slice(0, 10),
    tipo: tipo === "receita" || tipo === "acerto" ? tipo : "despesa",
    descricao: txt(r.descricao),
    valor: Math.abs(deReais(r.valor)),
    categoria: txt(r.categoria),
    pagoPor: pessoa(r.pago_por),
    deQuem: dono(r.de_quem),
    parteA: inteiro(r.parte_a, 50, 0, 100),
    parcela: txt(r.parcela),
    grupo: txt(r.grupo),
    fixaId: txt(r.fixa_id),
    mesRef: txt(r.mes_ref),
    criadoEm: instante(r.criado_em),
    criadoPor: txt(r.criado_por),
  };
}

export function categoriaParaRegistro(c: Categoria): Registro {
  return { id: c.id, nome: c.nome, tipo: c.tipo, orcamento: paraReais(c.orcamento), ordem: c.ordem, arquivada: c.arquivada };
}

export function registroParaCategoria(r: Registro): Categoria {
  return {
    id: txt(r.id),
    nome: txt(r.nome) || txt(r.id),
    tipo: txt(r.tipo) === "receita" ? "receita" : "despesa",
    orcamento: Math.max(0, deReais(r.orcamento)),
    ordem: inteiro(r.ordem, 0, 0, 100000),
    arquivada: r.arquivada === true,
  };
}

export function fixaParaRegistro(f: Fixa): Registro {
  return {
    id: f.id, descricao: f.descricao, tipo: f.tipo, valor: paraReais(f.valor), dia: f.dia,
    categoria: f.categoria, pago_por: f.pagoPor, de_quem: f.deQuem, parte_a: f.parteA,
    ativa: f.ativa, inicio: f.inicio, fim: f.fim,
    bruto: paraReais(f.bruto), regime: f.regime, dependentes: f.dependentes,
    outros_descontos: paraReais(f.outrosDescontos),
    natureza: f.natureza, periodicidade: f.periodicidade, mes_anual: f.mesAnual,
  };
}

export function registroParaFixa(r: Registro): Fixa {
  return {
    id: txt(r.id),
    descricao: txt(r.descricao),
    tipo: txt(r.tipo) === "receita" ? "receita" : "despesa",
    valor: Math.abs(deReais(r.valor)),
    dia: inteiro(r.dia, 1, 1, 31),
    categoria: txt(r.categoria),
    pagoPor: pessoa(r.pago_por),
    deQuem: dono(r.de_quem),
    parteA: inteiro(r.parte_a, 50, 0, 100),
    ativa: r.ativa !== false,
    inicio: txt(r.inicio).slice(0, 7),
    fim: txt(r.fim).slice(0, 7),
    bruto: Math.max(0, deReais(r.bruto)),
    regime: txt(r.regime) === "outro" ? "outro" : "clt",
    dependentes: inteiro(r.dependentes, 0, 0, 20),
    outrosDescontos: Math.max(0, deReais(r.outros_descontos)),
    natureza: txt(r.natureza) === "assinatura" ? "assinatura" : "conta",
    periodicidade: txt(r.periodicidade) === "anual" ? "anual" : "mensal",
    mesAnual: txt(r.periodicidade) === "anual" ? inteiro(r.mes_anual, 1, 1, 12) : 0,
  };
}

const CORES: CorPessoa[] = ["azul", "laranja", "verde", "rosa", "oliva"];
const cor = (v: unknown, padrao: CorPessoa): CorPessoa =>
  CORES.includes(txt(v) as CorPessoa) ? (txt(v) as CorPessoa) : padrao;

/** A configuração é uma linha só, de id 1. */
export function configParaRegistro(c: Config): Registro {
  return { id: 1, nome_a: c.nomeA, nome_b: c.nomeB, cor_a: c.corA, cor_b: c.corB, parte_a_padrao: c.parteAPadrao };
}

export function registroParaConfig(r: Registro): Config {
  const corA = cor(r.cor_a, "azul");
  let corB = cor(r.cor_b, "laranja");
  if (corB === corA) corB = corA === "laranja" ? "azul" : "laranja";
  return {
    nomeA: txt(r.nome_a),
    nomeB: txt(r.nome_b),
    corA,
    corB,
    parteAPadrao: inteiro(r.parte_a_padrao, 50, 0, 100),
  };
}
