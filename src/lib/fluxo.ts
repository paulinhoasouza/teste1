import { mesDe, somarMeses } from "./datas";
import { fixasDoMes, peso } from "./dominio";
import type { Dados, Dono } from "./tipos";

/**
 * Fluxo de caixa: cada mês começa com o que sobrou do anterior, soma o que entra e tira o que sai.
 * Os meses que ainda não aconteceram usam o que já se sabe: contas fixas e assinaturas vigentes,
 * parcelas já lançadas e o salário (simulado pelo bruto, quando ainda não foi confirmado).
 * Mesma regra de "parte de cada um" do resto do app: em "Nós" conta tudo, em uma pessoa, a parte dela.
 */

export type OrigemDoItem = "lancamento" | "parcela" | "fixa" | "assinatura" | "salario";

export interface ItemDoFluxo {
  id: string;
  descricao: string;
  /** Sempre positivo; `entrada` diz o sentido. */
  valor: number;
  entrada: boolean;
  origem: OrigemDoItem;
  categoria: string;
  /** Ainda não aconteceu: conta fixa não paga, ou lançamento com data depois de hoje. */
  pendente: boolean;
  /** Conta de um mês que já passou e não foi marcada como paga. */
  atrasada: boolean;
  simulado: boolean;
  data: string;
}

export interface MesDoFluxo {
  mes: string;
  situacao: "passado" | "atual" | "futuro";
  saldoInicial: number;
  entradas: number;
  saidas: number;
  sobra: number;
  saldoFinal: number;
  /** O que já aconteceu e o que ainda vai acontecer, dentro das entradas e saídas. */
  realizado: { entradas: number; saidas: number };
  previsto: { entradas: number; saidas: number };
  /** Parte das entradas que é salário simulado, ainda não confirmado. */
  simulado: number;
  itens: ItemDoFluxo[];
}

export interface Fluxo {
  inicio: string;
  meses: MesDoFluxo[];
  /** Menor saldo de fim de mês, do mês atual em diante. */
  menor: { mes: string; saldo: number } | null;
  /** Primeiro mês, do atual em diante, que termina no vermelho. */
  primeiroNegativo: string | null;
}

/** O mês em que o fluxo começa: o escolhido nos ajustes, ou o mês em que começaram a lançar no app. */
export function inicioDoFluxo(dados: Dados, hoje: string): string {
  const atual = mesDe(hoje);
  const escolhido = dados.config.fluxoInicio;
  if (escolhido) return escolhido < atual ? escolhido : atual;
  // Pela data em que foi criado, não pela data do lançamento: um teste com data antiga não puxa o começo para trás.
  const criados = dados.lancamentos.map((l) => l.criadoEm.slice(0, 7)).filter((m) => /^\d{4}-\d{2}$/.test(m)).sort();
  const primeiro = criados[0];
  return primeiro && primeiro < atual ? primeiro : atual;
}

export function saldoInicialDe(dados: Dados, escopo: Dono): number {
  const { saldoInicialA: a, saldoInicialB: b } = dados.config;
  return escopo === "a" ? a : escopo === "b" ? b : a + b;
}

/** Do começo do fluxo até `horizonte` meses depois do atual. */
export function fluxoDeCaixa(dados: Dados, escopo: Dono, hoje: string, horizonte: number): Fluxo {
  const atual = mesDe(hoje);
  const inicio = inicioDoFluxo(dados, hoje);
  const fim = somarMeses(atual, horizonte);
  const meses: MesDoFluxo[] = [];
  let saldo = saldoInicialDe(dados, escopo);

  for (let mes = inicio; mes <= fim; mes = somarMeses(mes, 1)) {
    const itens: ItemDoFluxo[] = [];

    for (const l of dados.lancamentos) {
      if (l.tipo === "acerto" || mesDe(l.data) !== mes) continue;
      const valor = peso(l, escopo);
      if (valor <= 0) continue;
      const fixa = l.fixaId ? dados.fixas.find((f) => f.id === l.fixaId) : undefined;
      itens.push({
        id: l.id,
        descricao: l.descricao || "Sem descrição",
        valor,
        entrada: l.tipo === "receita",
        origem: l.parcela ? "parcela" : fixa ? (fixa.natureza === "assinatura" ? "assinatura" : fixa.tipo === "receita" ? "salario" : "fixa") : "lancamento",
        categoria: l.categoria,
        pendente: l.data > hoje,
        atrasada: false,
        simulado: false,
        data: l.data,
      });
    }

    for (const c of fixasDoMes(dados.fixas, dados.lancamentos, mes, hoje)) {
      if (c.estado === "paga") continue;
      const valor = peso({ ...c.fixa, valor: c.previsto }, escopo);
      if (valor <= 0) continue;
      const receita = c.fixa.tipo === "receita";
      itens.push({
        id: `${c.fixa.id}:${mes}`,
        descricao: c.fixa.descricao,
        valor,
        entrada: receita,
        origem: c.fixa.natureza === "assinatura" ? "assinatura" : receita ? "salario" : "fixa",
        categoria: c.fixa.categoria,
        pendente: true,
        atrasada: mes < atual,
        simulado: c.simulado,
        data: c.vencimento,
      });
    }

    itens.sort((x, y) => Number(y.entrada) - Number(x.entrada) || y.valor - x.valor);
    const soma = (f: (i: ItemDoFluxo) => boolean) => itens.filter(f).reduce((s, i) => s + i.valor, 0);
    const entradas = soma((i) => i.entrada);
    const saidas = soma((i) => !i.entrada);
    const sobra = entradas - saidas;
    meses.push({
      mes,
      situacao: mes < atual ? "passado" : mes === atual ? "atual" : "futuro",
      saldoInicial: saldo,
      entradas,
      saidas,
      sobra,
      saldoFinal: saldo + sobra,
      realizado: { entradas: soma((i) => i.entrada && !i.pendente), saidas: soma((i) => !i.entrada && !i.pendente) },
      previsto: { entradas: soma((i) => i.entrada && i.pendente), saidas: soma((i) => !i.entrada && i.pendente) },
      simulado: soma((i) => i.entrada && i.simulado),
      itens,
    });
    saldo += sobra;
  }

  const adiante = meses.filter((m) => m.mes >= atual);
  const menor = adiante.reduce<MesDoFluxo | null>((min, m) => (!min || m.saldoFinal < min.saldoFinal ? m : min), null);
  return {
    inicio,
    meses,
    menor: menor ? { mes: menor.mes, saldo: menor.saldoFinal } : null,
    primeiroNegativo: adiante.find((m) => m.saldoFinal < 0)?.mes ?? null,
  };
}
