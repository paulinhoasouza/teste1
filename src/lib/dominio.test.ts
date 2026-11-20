import { describe, expect, it } from "vitest";
import { simular } from "./salario";
import type { Dados, Fixa, Lancamento } from "./tipos";
import {
  expandirParcelas,
  extratoCasal,
  fixaNoMes,
  fixaVigente,
  valorMensal,
  parcelamentos,
  faixasDoMes,
  fixasDoMes,
  partes,
  resumoMes,
  saldoCasal,
} from "./dominio";

function lanc(p: Partial<Lancamento>): Lancamento {
  return {
    id: Math.random().toString(36).slice(2),
    data: "2026-11-10",
    tipo: "despesa",
    descricao: "",
    valor: 10000,
    categoria: "mercado",
    pagoPor: "a",
    deQuem: "casal",
    parteA: 50,
    parcela: "",
    grupo: "",
    fixaId: "",
    mesRef: "",
    criadoEm: "",
    criadoPor: "a",
    ...p,
  };
}

function fixa(p: Partial<Fixa>): Fixa {
  return {
    id: "aluguel",
    descricao: "Aluguel",
    tipo: "despesa",
    valor: 200000,
    dia: 10,
    categoria: "moradia",
    pagoPor: "a",
    deQuem: "casal",
    parteA: 50,
    ativa: true,
    inicio: "",
    fim: "",
    bruto: 0,
    regime: "clt",
    dependentes: 0,
    outrosDescontos: 0,
    natureza: "conta",
    periodicidade: "mensal",
    mesAnual: 0,
    ...p,
  };
}

function dados(p: Partial<Dados>): Dados {
  return {
    demo: false,
    comprovantes: [],
    atividades: [],
    config: { nomeA: "Paulo", nomeB: "Bia", corA: "azul", corB: "laranja", parteAPadrao: 50 },
    categorias: [
      { id: "mercado", nome: "Mercado", tipo: "despesa", orcamento: 80000, ordem: 1, arquivada: false },
      { id: "lazer", nome: "Lazer", tipo: "despesa", orcamento: 0, ordem: 2, arquivada: false },
      { id: "moradia", nome: "Moradia", tipo: "despesa", orcamento: 0, ordem: 3, arquivada: false },
      { id: "salario", nome: "Salário", tipo: "receita", orcamento: 0, ordem: 4, arquivada: false },
    ],
    fixas: [],
    lancamentos: [],
    ...p,
  };
}

describe("partes", () => {
  it("divide uma despesa do casal pela parte de A, sem perder centavos", () => {
    expect(partes(lanc({ valor: 10001, parteA: 50 }))).toEqual({ a: 5001, b: 5000 });
    expect(partes(lanc({ valor: 10000, parteA: 60 }))).toEqual({ a: 6000, b: 4000 });
  });

  it("atribui tudo ao dono quando a despesa é de uma pessoa só", () => {
    expect(partes(lanc({ deQuem: "a" }))).toEqual({ a: 10000, b: 0 });
    expect(partes(lanc({ deQuem: "b", parteA: 50 }))).toEqual({ a: 0, b: 10000 });
  });
});

describe("saldoCasal", () => {
  it("fica zerado sem lançamentos", () => {
    expect(saldoCasal([], "2026-11")).toEqual({ devedor: null, credor: null, valor: 0 });
  });

  it("quem não pagou deve a sua parte da despesa do casal", () => {
    const s = saldoCasal([lanc({ valor: 10000, pagoPor: "a" })], "2026-11");
    expect(s).toEqual({ devedor: "b", credor: "a", valor: 5000 });
  });

  it("quem paga algo que é só do outro recebe tudo de volta", () => {
    const s = saldoCasal([lanc({ valor: 8000, pagoPor: "b", deQuem: "a" })], "2026-11");
    expect(s).toEqual({ devedor: "a", credor: "b", valor: 8000 });
  });

  it("ignora despesa pessoal paga pelo próprio dono e receitas", () => {
    const s = saldoCasal(
      [lanc({ deQuem: "a", pagoPor: "a" }), lanc({ tipo: "receita", pagoPor: "b", deQuem: "b" })],
      "2026-11",
    );
    expect(s.valor).toBe(0);
  });

  it("um acerto abate a dívida", () => {
    const s = saldoCasal(
      [
        lanc({ valor: 10000, pagoPor: "a" }),
        lanc({ tipo: "acerto", valor: 3000, pagoPor: "b", deQuem: "a" }),
      ],
      "2026-11",
    );
    expect(s).toEqual({ devedor: "b", credor: "a", valor: 2000 });
  });

  it("não conta parcelas de meses futuros", () => {
    const s = saldoCasal(
      [lanc({ valor: 10000, data: "2026-11-05" }), lanc({ valor: 10000, data: "2026-12-05" })],
      "2026-11",
    );
    expect(s.valor).toBe(5000);
  });
});

describe("expandirParcelas", () => {
  it("devolve um único lançamento quando é à vista", () => {
    expect(expandirParcelas("2026-11-10", 9990, 1)).toEqual([
      { data: "2026-11-10", valor: 9990, parcela: "" },
    ]);
  });

  it("reparte o total e põe os centavos que sobram nas primeiras parcelas", () => {
    const p = expandirParcelas("2026-11-10", 10000, 3);
    expect(p.map((x) => x.valor)).toEqual([3334, 3333, 3333]);
    expect(p.map((x) => x.parcela)).toEqual(["1/3", "2/3", "3/3"]);
    expect(p.map((x) => x.data)).toEqual(["2026-11-10", "2026-12-10", "2027-01-10"]);
  });

  it("ajusta o dia quando o mês seguinte é mais curto", () => {
    const p = expandirParcelas("2027-01-31", 3000, 3);
    expect(p.map((x) => x.data)).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
  });
});

describe("fixasDoMes", () => {
  it("marca como paga a conta que já tem lançamento no mês", () => {
    const f = fixa({});
    const pago = lanc({ id: "x1", fixaId: "aluguel", mesRef: "2026-11", valor: 200000 });
    const [r] = fixasDoMes([f], [pago], "2026-11", "2026-11-16");
    expect(r?.estado).toBe("paga");
    expect(r?.lancamentoId).toBe("x1");
  });

  it("distingue atrasada, vence hoje e a vencer", () => {
    const fs = [fixa({ id: "f1", dia: 10 }), fixa({ id: "f2", dia: 16 }), fixa({ id: "f3", dia: 25 })];
    const r = fixasDoMes(fs, [], "2026-11", "2026-11-16");
    expect(r.map((x) => x.estado)).toEqual(["atrasada", "hoje", "pendente"]);
    expect(r.map((x) => x.vencimento)).toEqual(["2026-11-10", "2026-11-16", "2026-11-25"]);
  });

  it("respeita início, fim, inativas e meses curtos", () => {
    const fs = [
      fixa({ id: "f1", inicio: "2026-12" }),
      fixa({ id: "f2", fim: "2026-10" }),
      fixa({ id: "f3", ativa: false }),
      fixa({ id: "f4", dia: 31 }),
    ];
    const r = fixasDoMes(fs, [], "2026-11", "2026-11-01");
    expect(r.map((x) => x.fixa.id)).toEqual(["f4"]);
    expect(r[0]?.vencimento).toBe("2026-11-30");
  });
});

describe("resumoMes", () => {
  const base = dados({
    fixas: [
      fixa({}),
      fixa({ id: "sal-a", descricao: "Salário", tipo: "receita", valor: 500000, dia: 5, categoria: "salario", deQuem: "a" }),
    ],
    lancamentos: [
      lanc({ tipo: "receita", valor: 400000, pagoPor: "b", deQuem: "b", categoria: "salario", data: "2026-11-05" }),
      lanc({ valor: 30000, categoria: "mercado", pagoPor: "a", data: "2026-11-08" }),
      lanc({ valor: 12000, categoria: "lazer", pagoPor: "b", deQuem: "b", data: "2026-11-09" }),
      lanc({ tipo: "acerto", valor: 5000, pagoPor: "b", deQuem: "a", data: "2026-11-12" }),
      lanc({ valor: 99900, categoria: "lazer", data: "2026-10-20" }),
    ],
  });

  it("soma o mês do casal: recebido, a receber, gasto, a pagar e sobra", () => {
    const r = resumoMes(base, "2026-11", "casal", "2026-11-16");
    expect(r.recebido).toBe(400000);
    expect(r.aReceber).toBe(500000);
    expect(r.gasto).toBe(42000);
    expect(r.aPagar).toBe(200000);
    expect(r.renda).toBe(900000);
    expect(r.sobra).toBe(900000 - 42000 - 200000);
  });

  it("calcula quanto dá para gastar por dia até o fim do mês", () => {
    const r = resumoMes(base, "2026-11", "casal", "2026-11-16");
    expect(r.diasRestantes).toBe(15);
    expect(r.porDia).toBe(Math.floor(658000 / 15));
  });

  it("no escopo de uma pessoa conta só a parte dela", () => {
    const a = resumoMes(base, "2026-11", "a", "2026-11-16");
    expect(a.recebido).toBe(0);
    expect(a.aReceber).toBe(500000);
    expect(a.gasto).toBe(15000);
    expect(a.aPagar).toBe(100000);
    const b = resumoMes(base, "2026-11", "b", "2026-11-16");
    expect(b.recebido).toBe(400000);
    expect(b.gasto).toBe(15000 + 12000);
    expect(b.aPagar).toBe(100000);
  });

  it("lista as categorias com gasto ou orçamento, da maior para a menor", () => {
    const r = resumoMes(base, "2026-11", "casal", "2026-11-16");
    expect(r.categorias.map((c) => [c.categoria.id, c.gasto, c.orcamento])).toEqual([
      ["mercado", 30000, 80000],
      ["lazer", 12000, 0],
    ]);
  });

  it("mês passado não tem dias restantes; sobra negativa não vira gasto por dia", () => {
    const semRenda = dados({ lancamentos: base.lancamentos });
    const r = resumoMes(semRenda, "2026-10", "casal", "2026-11-16");
    expect(r.diasRestantes).toBe(0);
    expect(r.sobra).toBe(-99900);
    expect(r.porDia).toBe(0);
  });
});

describe("faixasDoMes", () => {
  it("separa o gasto em três faixas: de A, do casal e de B", () => {
    const f = faixasDoMes(
      [
        lanc({ valor: 10000, deQuem: "a" }),
        lanc({ valor: 20000, deQuem: "casal", pagoPor: "a" }),
        lanc({ valor: 6000, deQuem: "casal", pagoPor: "b" }),
        lanc({ valor: 7000, deQuem: "b", pagoPor: "b" }),
        lanc({ tipo: "receita", valor: 99999 }),
        lanc({ valor: 5000, data: "2026-12-01" }),
      ],
      "2026-11",
    );
    expect(f).toEqual({ a: 10000, casal: 26000, b: 7000, casalPagoA: 20000, casalPagoB: 6000, total: 43000 });
  });
});



describe("extratoCasal", () => {
  const ls = [
    lanc({ valor: 20000, pagoPor: "a", data: "2026-10-05" }), // B deve 100
    lanc({ tipo: "acerto", valor: 4000, pagoPor: "b", deQuem: "a", data: "2026-10-28" }), // B deve 60
    lanc({ valor: 30000, pagoPor: "a", data: "2026-11-03" }), // A pagou 150 por B
    lanc({ valor: 9000, pagoPor: "b", deQuem: "a", data: "2026-11-04" }), // B pagou 90 por A
    lanc({ valor: 5000, pagoPor: "a", deQuem: "a", data: "2026-11-04" }),
    lanc({ tipo: "acerto", valor: 2000, pagoPor: "b", deQuem: "a", data: "2026-11-10" }),
    lanc({ tipo: "acerto", valor: 500, pagoPor: "a", deQuem: "b", data: "2026-11-11" }),
  ];

  it("explica o saldo do mês parcela por parcela, e a conta fecha", () => {
    const e = extratoCasal(ls, "2026-11");
    expect(e.anterior).toBe(6000);
    expect(e.aPagouPorB).toBe(15000);
    expect(e.bPagouPorA).toBe(9000);
    expect(e.acertosDeB).toBe(2000);
    expect(e.acertosDeA).toBe(500);
    expect(e.atual).toBe(e.anterior + e.aPagouPorB - e.bPagouPorA - e.acertosDeB + e.acertosDeA);
    const s = saldoCasal(ls, "2026-11");
    expect(s).toEqual({ devedor: "b", credor: "a", valor: e.atual });
  });
});

describe("parcelamentos", () => {
  it("lista as compras parceladas que ainda têm parcela a vencer", () => {
    const sofa = expandirParcelas("2026-09-09", 300000, 10).map((p) =>
      lanc({ ...p, grupo: "sofa", descricao: "Sofá novo" }),
    );
    const antigo = expandirParcelas("2026-06-01", 30000, 3).map((p) =>
      lanc({ ...p, grupo: "antigo", descricao: "Liquidificador" }),
    );
    const r = parcelamentos([...sofa, ...antigo, lanc({})], "2026-11");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      grupo: "sofa", descricao: "Sofá novo", numero: 3, total: 10, valorDoMes: 30000,
      restante: 240000, ultimoMes: "2027-06",
    });
  });
});

describe("receita simulada pelo bruto", () => {
  const sim = { bruto: 900000, regime: "clt" as const, dependentes: 0, outrosDescontos: 0 };
  const liquido = simular(sim).liquido;
  const salario = fixa({ id: "sal", descricao: "Salário", tipo: "receita", dia: 5, categoria: "salario", deQuem: "a", valor: liquido, ...sim });

  it("enquanto não chega, aparece como simulada com o líquido previsto", () => {
    const [r] = fixasDoMes([salario], [], "2026-11", "2026-11-03");
    expect(r).toMatchObject({ simulado: true, previsto: liquido, valor: liquido, diferenca: 0 });
  });

  it("depois de confirmada, guarda o valor real e a diferença para o simulado", () => {
    const real = lanc({ tipo: "receita", fixaId: "sal", mesRef: "2026-11", valor: liquido + 1230, deQuem: "a" });
    const [r] = fixasDoMes([salario], [real], "2026-11", "2026-11-10");
    expect(r).toMatchObject({ estado: "paga", simulado: false, valor: liquido + 1230, diferenca: 1230 });
  });

  it("a sobra do mês separa o que ainda é simulado", () => {
    const d = dados({ fixas: [salario, fixa({ id: "freela", tipo: "receita", valor: 50000, categoria: "salario", deQuem: "a", dia: 20 })] });
    const r = resumoMes(d, "2026-11", "casal", "2026-11-03");
    expect(r.aReceber).toBe(liquido + 50000);
    expect(r.aReceberSimulado).toBe(liquido);
  });

  it("respeita o mês de término", () => {
    const f = fixa({ fim: "2026-12" });
    expect(fixaNoMes(f, "2026-12")).toBe(true);
    expect(fixaNoMes(f, "2027-01")).toBe(false);
    expect(fixaNoMes(fixa({ inicio: "2027-01" }), "2026-12")).toBe(false);
  });
});

describe("cobrança anual", () => {
  const anual = fixa({ id: "psplus", valor: 42000, periodicidade: "anual", mesAnual: 3, natureza: "assinatura" });

  it("só aparece nas contas do mês da cobrança", () => {
    expect(fixaNoMes(anual, "2027-03")).toBe(true);
    expect(fixaNoMes(anual, "2027-04")).toBe(false);
    expect(fixasDoMes([anual], [], "2027-04", "2027-04-01")).toEqual([]);
  });

  it("vale um doze avos por mês no custo mensal", () => {
    expect(valorMensal(anual)).toBe(3500);
    expect(valorMensal(fixa({ valor: 5590 }))).toBe(5590);
  });

  it("está vigente o ano todo, enquanto não termina", () => {
    expect(fixaVigente(anual, "2027-04")).toBe(true);
    expect(fixaVigente({ ...anual, fim: "2027-01" }, "2027-04")).toBe(false);
  });
});
