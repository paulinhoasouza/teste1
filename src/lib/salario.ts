/**
 * Simulação do salário líquido, com as tabelas de 2026. Valores em centavos.
 *
 * INSS: Portaria Interministerial MPS/MF nº 13/2026 (faixas progressivas, teto R$ 8.475,55).
 * IRRF: tabela mensal vigente desde maio de 2025, com a redução da Lei nº 15.270/2025:
 * imposto zero para rendimentos de até R$ 5.000 e redução decrescente até R$ 7.350.
 * Quando as tabelas mudarem, basta atualizar as constantes deste arquivo.
 */

import type { Fixa, Regime } from "./tipos";

export type { Regime };

const FAIXAS_INSS: [teto: number, aliquota: number][] = [
  [162100, 0.075],
  [290284, 0.09],
  [435427, 0.12],
  [847555, 0.14],
];

/** [limite superior da base, alíquota, parcela a deduzir] */
const FAIXAS_IR: [limite: number, aliquota: number, deduzir: number][] = [
  [242880, 0, 0],
  [282665, 0.075, 18216],
  [375105, 0.15, 39416],
  [466468, 0.225, 67549],
  [Number.POSITIVE_INFINITY, 0.275, 90873],
];

const DEDUCAO_POR_DEPENDENTE = 18959;
const DESCONTO_SIMPLIFICADO = 60720;
const REDUCAO_MAXIMA = 31289;
const LIMITE_ISENCAO = 500000;
const LIMITE_REDUCAO = 735000;

export function inss(bruto: number): number {
  let total = 0;
  let piso = 0;
  for (const [teto, aliquota] of FAIXAS_INSS) {
    if (bruto <= piso) break;
    total += (Math.min(bruto, teto) - piso) * aliquota;
    piso = teto;
  }
  return Math.round(total);
}

function impostoDaTabela(base: number): number {
  if (base <= 0) return 0;
  const [, aliquota, deduzir] = FAIXAS_IR.find(([limite]) => base <= limite)!;
  return Math.max(0, Math.round(base * aliquota - deduzir));
}

/** Redução mensal da Lei 15.270/2025, calculada sobre o rendimento tributável (o bruto). */
function reducao(bruto: number): number {
  if (bruto <= LIMITE_ISENCAO) return REDUCAO_MAXIMA;
  if (bruto <= LIMITE_REDUCAO) return Math.max(0, Math.round(97862 - 0.133145 * bruto));
  return 0;
}

export function irrf(bruto: number, contribuicaoInss: number, dependentes: number): number {
  // A folha usa o que for melhor: deduções legais ou o desconto simplificado.
  const baseLegal = bruto - contribuicaoInss - dependentes * DEDUCAO_POR_DEPENDENTE;
  const baseSimplificada = bruto - DESCONTO_SIMPLIFICADO;
  const imposto = impostoDaTabela(Math.min(baseLegal, baseSimplificada));
  return Math.max(0, imposto - Math.min(imposto, reducao(bruto)));
}

export interface Simulacao {
  bruto: number;
  inss: number;
  irrf: number;
  outros: number;
  liquido: number;
}

export function simular(p: {
  bruto: number;
  regime: Regime;
  dependentes: number;
  outrosDescontos: number;
}): Simulacao {
  const contribuicao = p.regime === "clt" ? inss(p.bruto) : 0;
  const imposto = p.regime === "clt" ? irrf(p.bruto, contribuicao, p.dependentes) : 0;
  return {
    bruto: p.bruto,
    inss: contribuicao,
    irrf: imposto,
    outros: p.outrosDescontos,
    liquido: Math.max(0, p.bruto - contribuicao - imposto - p.outrosDescontos),
  };
}

/** Receita que o app simula a partir do bruto, em vez de um valor digitado. */
export function ehSimulada(f: Pick<Fixa, "tipo" | "bruto">): boolean {
  return f.tipo === "receita" && f.bruto > 0;
}

export function simulacaoDa(f: Pick<Fixa, "bruto" | "regime" | "dependentes" | "outrosDescontos">): Simulacao {
  return simular({ bruto: f.bruto, regime: f.regime, dependentes: f.dependentes, outrosDescontos: f.outrosDescontos });
}

/** Quanto se espera desta conta fixa no mês: o líquido simulado, ou o valor digitado. */
export function previstoDa(f: Fixa): number {
  return ehSimulada(f) ? simulacaoDa(f).liquido : f.valor;
}
