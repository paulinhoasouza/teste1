import { dataNoMes, diaDe, diasNoMes, mesDe, somarMeses } from "./datas";
import { ehSimulada, previstoDa } from "./salario";
import type { Categoria, Dados, Dono, Fixa, Lancamento, PessoaId } from "./tipos";

type Divisivel = Pick<Lancamento, "valor" | "deQuem" | "parteA">;

/** Quanto de um valor cabe a cada pessoa. Os centavos sempre fecham. */
export function partes(l: Divisivel): { a: number; b: number } {
  if (l.deQuem === "a") return { a: l.valor, b: 0 };
  if (l.deQuem === "b") return { a: 0, b: l.valor };
  const a = Math.round((l.valor * l.parteA) / 100);
  return { a, b: l.valor - a };
}

function peso(l: Divisivel, escopo: Dono): number {
  if (escopo === "casal") return l.valor;
  return partes(l)[escopo];
}

export function outra(p: PessoaId): PessoaId {
  return p === "a" ? "b" : "a";
}

export interface Saldo {
  devedor: PessoaId | null;
  credor: PessoaId | null;
  valor: number;
}

/**
 * Quem deve a quem, somando tudo até o fim de `ateMes`.
 * Parcelas de meses futuros só entram quando o mês chega.
 */
export function saldoCasal(lancamentos: Lancamento[], ateMes: string): Saldo {
  let aFavorDeA = 0;
  for (const l of lancamentos) {
    if (mesDe(l.data) > ateMes) continue;
    if (l.tipo === "despesa") {
      const p = partes(l);
      aFavorDeA += l.pagoPor === "a" ? p.b : -p.a;
    } else if (l.tipo === "acerto") {
      aFavorDeA += l.pagoPor === "a" ? l.valor : -l.valor;
    }
  }
  if (aFavorDeA === 0) return { devedor: null, credor: null, valor: 0 };
  return aFavorDeA > 0
    ? { devedor: "b", credor: "a", valor: aFavorDeA }
    : { devedor: "a", credor: "b", valor: -aFavorDeA };
}

export interface Parcela {
  data: string;
  valor: number;
  parcela: string;
}

export function expandirParcelas(data: string, total: number, n: number): Parcela[] {
  if (n <= 1) return [{ data, valor: total, parcela: "" }];
  const base = Math.floor(total / n);
  const resto = total - base * n;
  const mes = mesDe(data);
  const dia = diaDe(data);
  return Array.from({ length: n }, (_, i) => ({
    data: dataNoMes(somarMeses(mes, i), dia),
    valor: base + (i < resto ? 1 : 0),
    parcela: `${i + 1}/${n}`,
  }));
}

export type EstadoFixa = "paga" | "atrasada" | "hoje" | "pendente";

export interface FixaDoMes {
  fixa: Fixa;
  vencimento: string;
  estado: EstadoFixa;
  lancamentoId: string;
  /** Valor lançado quando paga; valor previsto caso contrário. */
  valor: number;
  /** O que se esperava: o líquido simulado, ou o valor cadastrado. */
  previsto: number;
  /** Receita ainda não confirmada cujo valor vem da simulação do bruto. */
  simulado: boolean;
  /** Recebido menos simulado, numa receita simulada já confirmada; 0 nos outros casos. */
  diferenca: number;
}

/** A conta fixa vale para o mês? Ativa e dentro do período, se houver. */
export function fixaNoMes(f: Fixa, mes: string): boolean {
  return f.ativa && (!f.inicio || f.inicio <= mes) && (!f.fim || mes <= f.fim);
}

export function fixasDoMes(
  fixas: Fixa[],
  lancamentos: Lancamento[],
  mes: string,
  hojeData: string,
): FixaDoMes[] {
  const pagas = new Map<string, Lancamento>();
  for (const l of lancamentos) {
    if (l.fixaId && l.mesRef === mes) pagas.set(l.fixaId, l);
  }
  return fixas
    .filter((f) => fixaNoMes(f, mes))
    .map((fixa) => {
      const vencimento = dataNoMes(mes, fixa.dia);
      const pago = pagas.get(fixa.id);
      const estado: EstadoFixa = pago
        ? "paga"
        : vencimento < hojeData
          ? "atrasada"
          : vencimento === hojeData
            ? "hoje"
            : "pendente";
      const previsto = previstoDa(fixa);
      const simulada = ehSimulada(fixa);
      return {
        fixa,
        vencimento,
        estado,
        lancamentoId: pago?.id ?? "",
        valor: pago?.valor ?? previsto,
        previsto,
        simulado: simulada && !pago,
        diferenca: simulada && pago ? pago.valor - previsto : 0,
      };
    })
    .sort((x, y) => x.vencimento.localeCompare(y.vencimento) || x.fixa.descricao.localeCompare(y.fixa.descricao));
}

export interface GastoCategoria {
  categoria: Categoria;
  gasto: number;
  orcamento: number;
}

export interface Resumo {
  /** Receitas já lançadas no mês. */
  recebido: number;
  /** Receitas fixas que ainda não entraram. */
  aReceber: number;
  /** Parte de aReceber que vem da simulação do bruto, ainda sem o valor real. */
  aReceberSimulado: number;
  renda: number;
  gasto: number;
  /** Contas fixas do mês ainda não pagas. */
  aPagar: number;
  sobra: number;
  diasRestantes: number;
  porDia: number;
  categorias: GastoCategoria[];
}

export function resumoMes(dados: Dados, mes: string, escopo: Dono, hojeData: string): Resumo {
  let recebido = 0;
  let gasto = 0;
  const porCategoria = new Map<string, number>();
  for (const l of dados.lancamentos) {
    if (mesDe(l.data) !== mes) continue;
    const v = peso(l, escopo);
    if (l.tipo === "receita") recebido += v;
    else if (l.tipo === "despesa") {
      gasto += v;
      porCategoria.set(l.categoria, (porCategoria.get(l.categoria) ?? 0) + v);
    }
  }

  let aReceber = 0;
  let aReceberSimulado = 0;
  let aPagar = 0;
  for (const f of fixasDoMes(dados.fixas, dados.lancamentos, mes, hojeData)) {
    if (f.estado === "paga") continue;
    const v = peso({ ...f.fixa, valor: f.previsto }, escopo);
    if (f.fixa.tipo === "receita") {
      aReceber += v;
      if (f.simulado) aReceberSimulado += v;
    } else aPagar += v;
  }

  const renda = recebido + aReceber;
  const sobra = renda - gasto - aPagar;
  const mesAtual = mesDe(hojeData);
  const diasRestantes =
    mes < mesAtual ? 0 : mes > mesAtual ? diasNoMes(mes) : diasNoMes(mes) - diaDe(hojeData) + 1;
  const porDia = sobra > 0 && diasRestantes > 0 ? Math.floor(sobra / diasRestantes) : 0;

  const categorias = dados.categorias
    .filter((c) => c.tipo === "despesa")
    .map((categoria) => ({
      categoria,
      gasto: porCategoria.get(categoria.id) ?? 0,
      orcamento: categoria.orcamento,
    }))
    .filter((c) => c.gasto > 0 || (c.orcamento > 0 && !c.categoria.arquivada))
    .sort((x, y) => y.gasto - x.gasto || x.categoria.ordem - y.categoria.ordem);

  return { recebido, aReceber, aReceberSimulado, renda, gasto, aPagar, sobra, diasRestantes, porDia, categorias };
}

export interface Faixas {
  a: number;
  casal: number;
  b: number;
  casalPagoA: number;
  casalPagoB: number;
  total: number;
}

/** O gasto do mês em três faixas: de A, do casal e de B. */
export function faixasDoMes(lancamentos: Lancamento[], mes: string): Faixas {
  const f: Faixas = { a: 0, casal: 0, b: 0, casalPagoA: 0, casalPagoB: 0, total: 0 };
  for (const l of lancamentos) {
    if (l.tipo !== "despesa" || mesDe(l.data) !== mes) continue;
    f[l.deQuem] += l.valor;
    f.total += l.valor;
    if (l.deQuem === "casal") {
      if (l.pagoPor === "a") f.casalPagoA += l.valor;
      else f.casalPagoB += l.valor;
    }
  }
  return f;
}

export function lancamentosDoMes(lancamentos: Lancamento[], mes: string): Lancamento[] {
  return lancamentos
    .filter((l) => mesDe(l.data) === mes)
    .sort((x, y) => y.data.localeCompare(x.data) || y.criadoEm.localeCompare(x.criadoEm));
}

export interface ExtratoCasal {
  /** Saldo até o fim do mês anterior; positivo = B deve a A. */
  anterior: number;
  /** Parte de B em despesas que A pagou neste mês. */
  aPagouPorB: number;
  bPagouPorA: number;
  /** Transferências de acerto feitas por cada um no mês. */
  acertosDeA: number;
  acertosDeB: number;
  /** Saldo no fim do mês; positivo = B deve a A. */
  atual: number;
}

/** O caminho do saldo do casal dentro de um mês; as parcelas somam o total. */
export function extratoCasal(lancamentos: Lancamento[], mes: string): ExtratoCasal {
  const e: ExtratoCasal = { anterior: 0, aPagouPorB: 0, bPagouPorA: 0, acertosDeA: 0, acertosDeB: 0, atual: 0 };
  for (const l of lancamentos) {
    const m = mesDe(l.data);
    if (m > mes || l.tipo === "receita") continue;
    let aFavorDeA = 0;
    if (l.tipo === "despesa") {
      const p = partes(l);
      aFavorDeA = l.pagoPor === "a" ? p.b : -p.a;
      if (m === mes) {
        if (l.pagoPor === "a") e.aPagouPorB += p.b;
        else e.bPagouPorA += p.a;
      }
    } else {
      aFavorDeA = l.pagoPor === "a" ? l.valor : -l.valor;
      if (m === mes) {
        if (l.pagoPor === "a") e.acertosDeA += l.valor;
        else e.acertosDeB += l.valor;
      }
    }
    if (m < mes) e.anterior += aFavorDeA;
    e.atual += aFavorDeA;
  }
  return e;
}

export interface Parcelamento {
  grupo: string;
  descricao: string;
  deQuem: Dono;
  pagoPor: PessoaId;
  /** Parcela que cai no mês (ou a próxima, se neste mês não houver). */
  numero: number;
  total: number;
  valorDoMes: number;
  /** Soma do que ainda vence do mês em diante. */
  restante: number;
  ultimoMes: string;
}

export function parcelamentos(lancamentos: Lancamento[], mes: string): Parcelamento[] {
  const grupos = new Map<string, Lancamento[]>();
  for (const l of lancamentos) {
    if (!l.grupo) continue;
    const g = grupos.get(l.grupo);
    if (g) g.push(l);
    else grupos.set(l.grupo, [l]);
  }
  const saida: Parcelamento[] = [];
  for (const [grupo, itens] of grupos) {
    itens.sort((x, y) => x.data.localeCompare(y.data));
    const aVencer = itens.filter((l) => mesDe(l.data) >= mes);
    const proxima = aVencer[0];
    const ultima = itens[itens.length - 1];
    if (!proxima || !ultima) continue;
    const [numero, total] = proxima.parcela.split("/").map(Number);
    saida.push({
      grupo,
      descricao: proxima.descricao,
      deQuem: proxima.deQuem,
      pagoPor: proxima.pagoPor,
      numero: numero || itens.indexOf(proxima) + 1,
      total: total || itens.length,
      valorDoMes: proxima.valor,
      restante: aVencer.reduce((s, l) => s + l.valor, 0),
      ultimoMes: mesDe(ultima.data),
    });
  }
  return saida.sort((x, y) => y.restante - x.restante);
}
