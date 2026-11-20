import { mesDe, somarMeses } from "./datas";
import {
  fixasDoMes, fixaVigente, partes, peso, resumoMes, saldoCasal, valorMensal, type Saldo,
} from "./dominio";
import type { Dados, Dono, Fixa, Lancamento, PessoaId } from "./tipos";

/** Cálculos do relatório. Valores em centavos; períodos são listas de meses "yyyy-mm" em ordem. */

export function mesesAte(mes: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => somarMeses(mes, i - n + 1));
}

const noPeriodo = (meses: string[]) => {
  const conjunto = new Set(meses);
  return (l: Lancamento) => conjunto.has(mesDe(l.data));
};

export interface MesDoRelatorio {
  mes: string;
  renda: number;
  /** Parte da renda que ainda é simulação do bruto. */
  rendaSimulada: number;
  /** Despesas lançadas mais contas fixas ainda por pagar. */
  saidas: number;
  sobra: number;
}

export function serie(dados: Dados, escopo: Dono, meses: string[], hoje: string): MesDoRelatorio[] {
  return meses.map((mes) => {
    const r = resumoMes(dados, mes, escopo, hoje);
    return { mes, renda: r.renda, rendaSimulada: r.aReceberSimulado, saidas: r.gasto + r.aPagar, sobra: r.sobra };
  });
}

export interface Totais {
  renda: number;
  rendaSimulada: number;
  saidas: number;
  sobra: number;
  /** Quanto da renda sobrou, de 0 a 1; null sem renda. */
  poupanca: number | null;
}

export function totais(s: MesDoRelatorio[]): Totais {
  const t = s.reduce(
    (acc, m) => ({
      renda: acc.renda + m.renda,
      rendaSimulada: acc.rendaSimulada + m.rendaSimulada,
      saidas: acc.saidas + m.saidas,
      sobra: acc.sobra + m.sobra,
    }),
    { renda: 0, rendaSimulada: 0, saidas: 0, sobra: 0 },
  );
  return { ...t, poupanca: t.renda > 0 ? t.sobra / t.renda : null };
}

export interface Composicao {
  contas: number;
  assinaturas: number;
  parcelas: number;
  diaADia: number;
  total: number;
}

/** Para onde vão as saídas: contas fixas, assinaturas, parcelas e o dia a dia. Inclui o que ainda vai vencer. */
export function composicao(dados: Dados, escopo: Dono, meses: string[], hoje: string): Composicao {
  const c: Composicao = { contas: 0, assinaturas: 0, parcelas: 0, diaADia: 0, total: 0 };
  const fixaPorId = new Map(dados.fixas.map((f) => [f.id, f]));
  const dentro = noPeriodo(meses);
  for (const l of dados.lancamentos) {
    if (l.tipo !== "despesa" || !dentro(l)) continue;
    const v = peso(l, escopo);
    if (l.fixaId) {
      if (fixaPorId.get(l.fixaId)?.natureza === "assinatura") c.assinaturas += v;
      else c.contas += v;
    } else if (l.grupo) c.parcelas += v;
    else c.diaADia += v;
  }
  for (const mes of meses) {
    for (const f of fixasDoMes(dados.fixas, dados.lancamentos, mes, hoje)) {
      if (f.estado === "paga" || f.fixa.tipo !== "despesa") continue;
      const v = peso({ ...f.fixa, valor: f.previsto }, escopo);
      if (f.fixa.natureza === "assinatura") c.assinaturas += v;
      else c.contas += v;
    }
  }
  c.total = c.contas + c.assinaturas + c.parcelas + c.diaADia;
  return c;
}

export interface CategoriaDoRelatorio {
  id: string;
  nome: string;
  total: number;
  /** O mesmo número de meses imediatamente antes do período. */
  anterior: number;
  /** Orçamento mensal vezes os meses do período; 0 sem orçamento. */
  orcamento: number;
}

/** Despesas lançadas por categoria, com o período anterior de mesmo tamanho para comparar. */
export function categorias(dados: Dados, escopo: Dono, meses: string[]): CategoriaDoRelatorio[] {
  const anteriores = meses.map((m) => somarMeses(m, -meses.length));
  const dentro = noPeriodo(meses);
  const antes = noPeriodo(anteriores);
  const soma = new Map<string, { total: number; anterior: number }>();
  for (const l of dados.lancamentos) {
    if (l.tipo !== "despesa") continue;
    const agora = dentro(l);
    if (!agora && !antes(l)) continue;
    const item = soma.get(l.categoria) ?? { total: 0, anterior: 0 };
    if (agora) item.total += peso(l, escopo);
    else item.anterior += peso(l, escopo);
    soma.set(l.categoria, item);
  }
  return dados.categorias
    .filter((c) => c.tipo === "despesa")
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      total: soma.get(c.id)?.total ?? 0,
      anterior: soma.get(c.id)?.anterior ?? 0,
      orcamento: escopo === "casal" ? c.orcamento * meses.length : 0,
    }))
    .filter((c) => c.total > 0 || c.anterior > 0)
    .sort((x, y) => y.total - x.total || y.anterior - x.anterior);
}

export interface AssinaturaDoRelatorio {
  fixa: Fixa;
  /** Custo mensal na parte do escopo (anual dividida por 12). */
  mensal: number;
}

export function assinaturas(dados: Dados, escopo: Dono, mes: string): { itens: AssinaturaDoRelatorio[]; mensal: number; anual: number } {
  const itens = dados.fixas
    .filter((f) => f.natureza === "assinatura" && fixaVigente(f, mes))
    .map((fixa) => ({ fixa, mensal: peso({ ...fixa, valor: valorMensal(fixa) }, escopo) }))
    .filter((a) => a.mensal > 0)
    .sort((x, y) => y.mensal - x.mensal);
  const mensal = itens.reduce((s, a) => s + a.mensal, 0);
  return { itens, mensal, anual: mensal * 12 };
}

/** Parcelas que ainda vão vencer nos próximos meses, mês a mês. */
export function parcelasFuturas(lancamentos: Lancamento[], escopo: Dono, depoisDe: string, n = 6): { mes: string; total: number }[] {
  const meses = Array.from({ length: n }, (_, i) => somarMeses(depoisDe, i + 1));
  const total = new Map(meses.map((m) => [m, 0]));
  for (const l of lancamentos) {
    if (!l.grupo || l.tipo !== "despesa") continue;
    const m = mesDe(l.data);
    if (total.has(m)) total.set(m, total.get(m)! + peso(l, escopo));
  }
  return meses.map((mes) => ({ mes, total: total.get(mes)! }));
}

export interface Divisao {
  /** Despesas do casal lançadas no período. */
  doCasal: number;
  pagoPor: Record<PessoaId, number>;
  /** Quanto caberia a cada um pela divisão de cada despesa. */
  parte: Record<PessoaId, number>;
  renda: Record<PessoaId, number>;
  /** Gasto só de cada um no período. */
  pessoal: Record<PessoaId, number>;
  acerto: Saldo;
}

export function divisao(dados: Dados, meses: string[], hoje: string): Divisao {
  const d: Divisao = {
    doCasal: 0,
    pagoPor: { a: 0, b: 0 },
    parte: { a: 0, b: 0 },
    renda: { a: 0, b: 0 },
    pessoal: { a: 0, b: 0 },
    acerto: saldoCasal(dados.lancamentos, meses[meses.length - 1]!),
  };
  const dentro = noPeriodo(meses);
  for (const l of dados.lancamentos) {
    if (l.tipo !== "despesa" || !dentro(l)) continue;
    if (l.deQuem === "casal") {
      const p = partes(l);
      d.doCasal += l.valor;
      d.pagoPor[l.pagoPor] += l.valor;
      d.parte.a += p.a;
      d.parte.b += p.b;
    } else d.pessoal[l.deQuem] += l.valor;
  }
  for (const mes of meses) {
    d.renda.a += resumoMes(dados, mes, "a", hoje).renda;
    d.renda.b += resumoMes(dados, mes, "b", hoje).renda;
  }
  return d;
}

export function maioresGastos(dados: Dados, escopo: Dono, meses: string[], n = 5): { lancamento: Lancamento; valor: number }[] {
  const dentro = noPeriodo(meses);
  return dados.lancamentos
    .filter((l) => l.tipo === "despesa" && dentro(l))
    .map((lancamento) => ({ lancamento, valor: peso(lancamento, escopo) }))
    .filter((x) => x.valor > 0)
    .sort((x, y) => y.valor - x.valor)
    .slice(0, n);
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const reais = (c: number) => {
  const inteiro = Math.round(c / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${inteiro}`;
};

export interface Destaque {
  /** Bom, atenção ou neutro: decide o tom, nunca sozinho a leitura. */
  tom: "bom" | "atencao" | "neutro";
  texto: string;
}

/** As frases que resumem o período, da mais importante para a menos. */
export function destaques(p: {
  escopo: Dono;
  nomes: Record<PessoaId, string>;
  totais: Totais;
  composicao: Composicao;
  categorias: CategoriaDoRelatorio[];
  assinaturasMensal: number;
  divisao: Divisao;
  parteAPadrao: number;
  parcelasProximas: number;
  meses: number;
}): Destaque[] {
  const d: Destaque[] = [];
  const { totais: t } = p;
  const sujeito = p.escopo === "casal" ? "Vocês" : p.nomes[p.escopo];
  const rendaMensal = t.renda / p.meses;

  if (t.poupanca !== null) {
    d.push(
      t.sobra >= 0
        ? { tom: t.poupanca >= 0.1 ? "bom" : "neutro", texto: `${sujeito} ${p.escopo === "casal" ? "guardaram" : "guardou"} ${pct(t.poupanca)} da renda: ${reais(t.sobra)}.` }
        : { tom: "atencao", texto: `As saídas passaram a renda em ${reais(-t.sobra)}.` },
    );
  }

  const variacoes = p.categorias
    .filter((c) => c.anterior > 0 && Math.abs(c.total - c.anterior) >= 10000)
    .map((c) => ({ c, razao: (c.total - c.anterior) / c.anterior }))
    .filter((x) => Math.abs(x.razao) >= 0.2)
    .sort((x, y) => Math.abs(y.c.total - y.c.anterior) - Math.abs(x.c.total - x.c.anterior));
  const maior = variacoes[0];
  if (maior) {
    const subiu = maior.razao > 0;
    d.push({
      tom: subiu ? "atencao" : "bom",
      texto: `${maior.c.nome} ${subiu ? "subiu" : "caiu"} ${pct(Math.abs(maior.razao))} em relação ao período anterior (${reais(maior.c.anterior)} para ${reais(maior.c.total)}).`,
    });
  }

  const estouradas = p.categorias.filter((c) => c.orcamento > 0 && c.total > c.orcamento);
  if (estouradas.length > 0) {
    const pior = estouradas.sort((x, y) => y.total - y.orcamento - (x.total - x.orcamento))[0]!;
    d.push({ tom: "atencao", texto: `${pior.nome} passou ${reais(pior.total - pior.orcamento)} do orçamento.` });
  }

  const fixos = p.composicao.contas + p.composicao.assinaturas + p.composicao.parcelas;
  if (t.renda > 0 && fixos > 0) {
    d.push({
      tom: fixos / t.renda > 0.5 ? "atencao" : "neutro",
      texto: `Contas fixas, assinaturas e parcelas levam ${pct(fixos / t.renda)} da renda.`,
    });
  }

  if (p.assinaturasMensal > 0) {
    d.push({
      tom: "neutro",
      texto: `Assinaturas custam ${reais(p.assinaturasMensal)} por mês, ${reais(p.assinaturasMensal * 12)} por ano${rendaMensal > 0 ? `, ${pct(p.assinaturasMensal / rendaMensal)} da renda` : ""}.`,
    });
  }

  if (p.escopo === "casal" && p.divisao.doCasal > 0) {
    const { pagoPor, doCasal } = p.divisao;
    const quem: PessoaId = pagoPor.a >= pagoPor.b ? "a" : "b";
    const fatia = pagoPor[quem] / doCasal;
    const combinado = quem === "a" ? p.parteAPadrao / 100 : 1 - p.parteAPadrao / 100;
    if (Math.abs(fatia - combinado) >= 0.1) {
      d.push({
        tom: "neutro",
        texto: `${p.nomes[quem]} pagou ${pct(fatia)} do que é dos dois; a divisão combinada é ${pct(combinado)}.`,
      });
    }
  }

  if (p.parcelasProximas > 0) {
    d.push({ tom: "neutro", texto: `${reais(p.parcelasProximas)} já estão comprometidos com parcelas nos próximos 6 meses.` });
  }
  return d;
}
