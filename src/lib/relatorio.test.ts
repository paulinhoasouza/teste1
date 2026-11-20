import { describe, expect, it } from "vitest";
import {
  assinaturas, categorias, composicao, destaques, divisao, maioresGastos, mesesAte, parcelasFuturas, serie, totais,
} from "./relatorio";
import type { Dados, Fixa, Lancamento } from "./tipos";

function lanc(p: Partial<Lancamento>): Lancamento {
  return {
    id: Math.random().toString(36).slice(2), data: "2026-11-10", tipo: "despesa", descricao: "", valor: 10000,
    categoria: "mercado", pagoPor: "a", deQuem: "casal", parteA: 50, parcela: "", grupo: "", fixaId: "", mesRef: "",
    criadoEm: "", criadoPor: "a", ...p,
  };
}

function fixa(p: Partial<Fixa>): Fixa {
  return {
    id: "f", descricao: "Conta", tipo: "despesa", valor: 10000, dia: 10, categoria: "moradia", pagoPor: "a",
    deQuem: "casal", parteA: 50, ativa: true, inicio: "", fim: "", bruto: 0, regime: "clt", dependentes: 0,
    outrosDescontos: 0, natureza: "conta", periodicidade: "mensal", mesAnual: 0, ...p,
  };
}

const cats = [
  { id: "mercado", nome: "Mercado", tipo: "despesa" as const, orcamento: 50000, ordem: 1, arquivada: false },
  { id: "lazer", nome: "Lazer", tipo: "despesa" as const, orcamento: 0, ordem: 2, arquivada: false },
  { id: "moradia", nome: "Moradia", tipo: "despesa" as const, orcamento: 0, ordem: 3, arquivada: false },
  { id: "assinaturas", nome: "Assinaturas", tipo: "despesa" as const, orcamento: 0, ordem: 4, arquivada: false },
  { id: "salario", nome: "Salário", tipo: "receita" as const, orcamento: 0, ordem: 5, arquivada: false },
];

/** Novembro: salários 5.000 (Paulo) e 4.000 (Giovana); aluguel pago; streaming e PS Plus anual. */
function cenario(): Dados {
  const fixas = [
    fixa({ id: "aluguel", descricao: "Aluguel", valor: 200000, dia: 5 }),
    fixa({ id: "streaming", descricao: "Streaming", valor: 6000, dia: 25, categoria: "assinaturas", natureza: "assinatura", pagoPor: "b" }),
    fixa({ id: "psplus", descricao: "PS Plus", valor: 48000, dia: 3, categoria: "assinaturas", natureza: "assinatura", periodicidade: "anual", mesAnual: 3, deQuem: "a" }),
  ];
  const lancamentos = [
    lanc({ tipo: "receita", valor: 500000, deQuem: "a", pagoPor: "a", categoria: "salario", data: "2026-11-05" }),
    lanc({ tipo: "receita", valor: 400000, deQuem: "b", pagoPor: "b", categoria: "salario", data: "2026-11-05" }),
    lanc({ valor: 200000, categoria: "moradia", fixaId: "aluguel", mesRef: "2026-11", data: "2026-11-05" }),
    lanc({ valor: 60000, categoria: "mercado", pagoPor: "a", data: "2026-11-08" }),
    lanc({ valor: 20000, categoria: "lazer", deQuem: "b", pagoPor: "b", data: "2026-11-09" }),
    lanc({ valor: 30000, categoria: "mercado", pagoPor: "b", data: "2026-10-08" }),
    // Sofá em 3x a partir de novembro
    lanc({ valor: 10000, categoria: "lazer", grupo: "sofa", parcela: "1/3", data: "2026-11-15" }),
    lanc({ valor: 10000, categoria: "lazer", grupo: "sofa", parcela: "2/3", data: "2026-12-15" }),
    lanc({ valor: 10000, categoria: "lazer", grupo: "sofa", parcela: "3/3", data: "2027-01-15" }),
  ];
  return {
    demo: false,
    config: { nomeA: "Paulo", nomeB: "Giovana", corA: "azul", corB: "laranja", parteAPadrao: 50 },
    categorias: cats,
    fixas,
    lancamentos,
    comprovantes: [],
  };
}

const HOJE = "2026-11-20";

describe("relatório", () => {
  it("monta o período terminando no mês escolhido", () => {
    expect(mesesAte("2026-02", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  it("série e totais do casal: renda, saídas com o que vai vencer, sobra e poupança", () => {
    const s = serie(cenario(), "casal", ["2026-11"], HOJE);
    // Saídas: 2.000 + 600 + 200 + 100 lançados, mais o streaming de 60 ainda por pagar.
    expect(s[0]).toMatchObject({ renda: 900000, saidas: 296000, sobra: 604000 });
    const t = totais(s);
    expect(t.poupanca).toBeCloseTo(604000 / 900000, 5);
  });

  it("composição separa contas, assinaturas, parcelas e dia a dia", () => {
    expect(composicao(cenario(), "casal", ["2026-11"], HOJE)).toEqual({
      contas: 200000, assinaturas: 6000, parcelas: 10000, diaADia: 80000, total: 296000,
    });
  });

  it("no individual, conta só a parte da pessoa", () => {
    const c = composicao(cenario(), "a", ["2026-11"], HOJE);
    expect(c).toMatchObject({ contas: 100000, assinaturas: 3000, parcelas: 5000, diaADia: 30000 });
  });

  it("categorias comparam com o período anterior e trazem o orçamento do período", () => {
    const c = categorias(cenario(), "casal", ["2026-11"]);
    expect(c.find((x) => x.id === "mercado")).toMatchObject({ total: 60000, anterior: 30000, orcamento: 50000 });
    expect(c[0]!.id).toBe("moradia");
    // Dois meses: o orçamento dobra.
    expect(categorias(cenario(), "casal", ["2026-10", "2026-11"]).find((x) => x.id === "mercado")?.orcamento).toBe(100000);
  });

  it("assinaturas: a anual entra como um doze avos por mês", () => {
    const a = assinaturas(cenario(), "casal", "2026-11");
    expect(a.mensal).toBe(6000 + 4000);
    expect(a.anual).toBe(120000);
    expect(assinaturas(cenario(), "b", "2026-11").mensal).toBe(3000);
  });

  it("parcelas futuras, mês a mês", () => {
    expect(parcelasFuturas(cenario().lancamentos, "casal", "2026-11", 3)).toEqual([
      { mes: "2026-12", total: 10000 }, { mes: "2027-01", total: 10000 }, { mes: "2027-02", total: 0 },
    ]);
  });

  it("divisão do casal: quem pagou, a parte de cada um e as rendas", () => {
    const d = divisao(cenario(), ["2026-11"], HOJE);
    expect(d.doCasal).toBe(270000);
    expect(d.pagoPor).toEqual({ a: 270000, b: 0 });
    expect(d.parte).toEqual({ a: 135000, b: 135000 });
    expect(d.pessoal).toEqual({ a: 0, b: 20000 });
    expect(d.renda).toEqual({ a: 500000, b: 400000 });
  });

  it("maiores gastos, pelo peso do escopo", () => {
    const m = maioresGastos(cenario(), "b", ["2026-11"], 2);
    expect(m.map((x) => x.valor)).toEqual([100000, 30000]);
  });

  it("destaques: poupança, variação, divisão e compromissos", () => {
    const d = cenario();
    const meses = ["2026-11"];
    const s = serie(d, "casal", meses, HOJE);
    const frases = destaques({
      escopo: "casal",
      nomes: { a: "Paulo", b: "Giovana" },
      totais: totais(s),
      composicao: composicao(d, "casal", meses, HOJE),
      categorias: categorias(d, "casal", meses),
      assinaturasMensal: assinaturas(d, "casal", "2026-11").mensal,
      divisao: divisao(d, meses, HOJE),
      parteAPadrao: 50,
      parcelasProximas: 20000,
      meses: 1,
    }).map((x) => x.texto);
    expect(frases[0]).toBe("Vocês guardaram 67% da renda: R$ 6.040.");
    expect(frases).toContain("Mercado subiu 100% em relação ao período anterior (R$ 300 para R$ 600).");
    expect(frases).toContain("Mercado passou R$ 100 do orçamento.");
    expect(frases).toContain("Paulo pagou 100% do que é dos dois; a divisão combinada é 50%.");
    expect(frases).toContain("R$ 200 já estão comprometidos com parcelas nos próximos 6 meses.");
  });
});
