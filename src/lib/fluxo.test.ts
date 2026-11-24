import { describe, expect, it } from "vitest";
import { fluxoDeCaixa, inicioDoFluxo } from "./fluxo";
import type { Config, Dados, Fixa, Lancamento } from "./tipos";

const HOJE = "2026-11-23";

const config: Config = {
  nomeA: "Paulo", nomeB: "Giovana", corA: "azul", corB: "rosa", parteAPadrao: 50,
  fluxoInicio: "", saldoInicialA: 0, saldoInicialB: 0,
};

function fixa(p: Partial<Fixa>): Fixa {
  return {
    id: "f", descricao: "Conta", tipo: "despesa", valor: 10000, dia: 27, categoria: "moradia", pagoPor: "a", deQuem: "a",
    parteA: 50, ativa: true, inicio: "", fim: "", bruto: 0, regime: "clt", dependentes: 0, outrosDescontos: 0,
    natureza: "conta", periodicidade: "mensal", mesAnual: 0, ...p,
  };
}

function lanc(p: Partial<Lancamento>): Lancamento {
  return {
    id: "l", data: "2026-11-10", tipo: "despesa", descricao: "Mercado", valor: 10000, categoria: "mercado",
    pagoPor: "a", deQuem: "casal", parteA: 50, parcela: "", grupo: "", fixaId: "", mesRef: "",
    criadoEm: "2026-11-20T03:00:00.000Z", criadoPor: "a", ...p,
  };
}

function dados(p: Partial<Dados> = {}): Dados {
  return {
    demo: false, config, categorias: [], fixas: [], lancamentos: [], comprovantes: [], atividades: [], ...p,
  };
}

// Como os dados de vocês: salário confirmado em novembro, contas no dia 27 e a moto e o sinal a partir de dezembro.
const salario = fixa({ id: "sal", descricao: "Salário de Paulo", tipo: "receita", categoria: "salario", bruto: 690000, valor: 541471, inicio: "2026-11" });
const real = dados({
  fixas: [
    fixa({ id: "cond", descricao: "Condomínio", valor: 38000 }),
    fixa({ id: "net", descricao: "Internet", valor: 14000, deQuem: "casal" }),
    fixa({ id: "ap", descricao: "Apartamento", valor: 162500 }),
    salario,
    fixa({ id: "sinal", descricao: "Sinal ap novo", valor: 280000, dia: 8, categoria: "investimento", inicio: "2026-12", fim: "2027-03" }),
    fixa({ id: "moto", descricao: "Moto", valor: 116200, dia: 14, categoria: "investimento", inicio: "2026-12", fim: "2027-04" }),
  ],
  lancamentos: [
    lanc({ id: "s11", tipo: "receita", descricao: "Salário de Paulo", valor: 1092500, categoria: "salario", deQuem: "a", fixaId: "sal", mesRef: "2026-11", data: "2026-11-23", criadoEm: "2026-11-24T01:36:40.000Z" }),
    lanc({ id: "t1", descricao: "Teste", valor: 5000, data: "2026-11-22" }),
    lanc({ id: "t2", descricao: "Teste", valor: 5000, data: "2026-12-22" }),
    lanc({ id: "t0", descricao: "Teste", valor: 5000, data: "2026-10-22" }),
  ],
});

describe("de onde o fluxo começa", () => {
  it("do mês em que começaram a usar o app, não da data mais antiga lançada", () => {
    // O "Teste" de outubro foi criado em novembro: o fluxo começa em novembro.
    expect(inicioDoFluxo(real, HOJE)).toBe("2026-11");
  });

  it("o mês escolhido nos ajustes vence, mas nunca depois do mês atual", () => {
    expect(inicioDoFluxo(dados({ ...real, config: { ...config, fluxoInicio: "2026-09" } }), HOJE)).toBe("2026-09");
    expect(inicioDoFluxo(dados({ config: { ...config, fluxoInicio: "2027-02" } }), HOJE)).toBe("2026-11");
    expect(inicioDoFluxo(dados(), HOJE)).toBe("2026-11");
  });
});

describe("o que sobra num mês passa para o seguinte", () => {
  it("novembro termina com a sobra do salário e dezembro começa com ela", () => {
    const f = fluxoDeCaixa(real, "a", HOJE, 6);
    expect(f.meses.map((m) => m.mes)).toEqual(["2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05"]);
    const [nov, dez] = f.meses;
    // Entrou o salário real; saem as contas do dia 27 (ainda a pagar), a parte do Paulo na internet e no teste.
    expect(nov!.situacao).toBe("atual");
    expect(nov!.saldoInicial).toBe(0);
    expect(nov!.entradas).toBe(1092500);
    expect(nov!.saidas).toBe(38000 + 7000 + 162500 + 2500);
    expect(nov!.saldoFinal).toBe(1092500 - 210000);
    expect(nov!.previsto.saidas).toBe(38000 + 7000 + 162500);
    expect(dez!.saldoInicial).toBe(nov!.saldoFinal);
    expect(dez!.situacao).toBe("futuro");
  });

  it("dezembro tem a moto, o sinal, as contas e o salário simulado; o salário aparece como simulado", () => {
    const dez = fluxoDeCaixa(real, "a", HOJE, 6).meses[1]!;
    const nomes = dez.itens.map((i) => i.descricao);
    expect(nomes).toEqual(expect.arrayContaining(["Moto", "Sinal ap novo", "Condomínio", "Apartamento", "Internet", "Salário de Paulo", "Teste"]));
    const sal = dez.itens.find((i) => i.descricao === "Salário de Paulo")!;
    expect(sal).toMatchObject({ entrada: true, pendente: true, simulado: true, origem: "salario" });
    expect(dez.simulado).toBe(sal.valor);
    expect(dez.saidas).toBe(280000 + 116200 + 38000 + 7000 + 162500 + 2500);
    expect(dez.saldoFinal).toBe(dez.saldoInicial + dez.entradas - dez.saidas);
  });

  it("a moto acaba em abril e o sinal em março; maio não tem nenhum dos dois", () => {
    const meses = fluxoDeCaixa(real, "a", HOJE, 6).meses;
    const tem = (m: string, d: string) => meses.find((x) => x.mes === m)!.itens.some((i) => i.descricao === d);
    expect(tem("2027-03", "Sinal ap novo")).toBe(true);
    expect(tem("2027-04", "Sinal ap novo")).toBe(false);
    expect(tem("2027-04", "Moto")).toBe(true);
    expect(tem("2027-05", "Moto")).toBe(false);
  });

  it("o menor saldo dos próximos meses é apontado", () => {
    const pobre = dados({
      fixas: [fixa({ id: "aluguel", descricao: "Aluguel", valor: 300000, inicio: "2026-11" }), fixa({ id: "renda", descricao: "Salário", tipo: "receita", categoria: "salario", valor: 200000, inicio: "2026-11" })],
      config: { ...config, saldoInicialA: 250000 },
    });
    const f = fluxoDeCaixa(pobre, "a", HOJE, 3);
    // Começa com 2.500, perde 1.000 por mês: 1.500, 500, -500, -1.500.
    expect(f.meses.map((m) => m.saldoFinal)).toEqual([150000, 50000, -50000, -150000]);
    expect(f.menor).toEqual({ mes: "2027-02", saldo: -150000 });
    expect(f.primeiroNegativo).toBe("2027-01");
  });
});

describe("de quem é o dinheiro", () => {
  it("o casal soma os dois saldos iniciais; cada um vê só o seu e a sua parte", () => {
    const d = dados({
      config: { ...config, saldoInicialA: 100000, saldoInicialB: 40000 },
      lancamentos: [lanc({ valor: 20000, deQuem: "casal" }), lanc({ id: "g", valor: 8000, deQuem: "b", pagoPor: "b" })],
    });
    const nos = fluxoDeCaixa(d, "casal", HOJE, 0).meses[0]!;
    const paulo = fluxoDeCaixa(d, "a", HOJE, 0).meses[0]!;
    const gi = fluxoDeCaixa(d, "b", HOJE, 0).meses[0]!;
    expect(nos.saldoInicial).toBe(140000);
    expect(nos.saidas).toBe(28000);
    expect(paulo).toMatchObject({ saldoInicial: 100000, saidas: 10000, saldoFinal: 90000 });
    expect(gi).toMatchObject({ saldoInicial: 40000, saidas: 18000, saldoFinal: 22000 });
  });

  it("conta do mês passado não paga continua pesando (está em atraso)", () => {
    const d = dados({
      config: { ...config, fluxoInicio: "2026-10" },
      fixas: [fixa({ id: "luz", descricao: "Luz", valor: 20000, dia: 15 })],
    });
    const [out] = fluxoDeCaixa(d, "a", HOJE, 0).meses;
    expect(out).toMatchObject({ mes: "2026-10", situacao: "passado", saidas: 20000 });
    expect(out!.itens[0]).toMatchObject({ descricao: "Luz", pendente: true, atrasada: true });
  });
});
