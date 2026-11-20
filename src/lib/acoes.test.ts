import { describe, expect, it } from "vitest";
import { ErroDeAcao, planejar, type Contexto } from "./acoes";
import { simular } from "./salario";
import type { Dados, Lancamento } from "./tipos";

let n = 0;
const ctx: Contexto = { quem: "a", agora: "2026-11-16T12:00:00.000Z", novoId: () => `id${++n}` };

function base(p: Partial<Dados> = {}): Dados {
  return {
    demo: false,
    config: { nomeA: "Paulo", nomeB: "Bia", corA: "azul", corB: "laranja", parteAPadrao: 50 },
    categorias: [
      { id: "mercado", nome: "Mercado", tipo: "despesa", orcamento: 0, ordem: 1, arquivada: false },
    ],
    fixas: [
      {
        id: "aluguel", descricao: "Aluguel", tipo: "despesa", valor: 240000, dia: 10, categoria: "mercado",
        pagoPor: "a", deQuem: "casal", parteA: 50, ativa: true, inicio: "", fim: "", bruto: 0, regime: "clt", dependentes: 0, outrosDescontos: 0,
      },
    ],
    lancamentos: [],
    ...p,
  };
}

const novo = {
  acao: "lancamento.criar" as const,
  tipo: "despesa" as const,
  data: "2026-11-16",
  descricao: "  Feira  ",
  valor: 9000,
  categoria: "mercado",
  pagoPor: "a" as const,
  deQuem: "casal" as const,
  parteA: 50,
  parcelas: 1,
};

describe("planejar", () => {
  it("cria um lançamento com id, autoria e descrição aparada", () => {
    const p = planejar(novo, base(), ctx);
    const [l] = p.lancamentos?.salvar ?? [];
    expect(l).toMatchObject({ descricao: "Feira", valor: 9000, criadoPor: "a", criadoEm: ctx.agora, parcela: "", grupo: "" });
    expect(l?.id).toBeTruthy();
  });

  it("parcela em N lançamentos do mesmo grupo que somam o total", () => {
    const p = planejar({ ...novo, valor: 10000, parcelas: 3 }, base(), ctx);
    const ls = p.lancamentos?.salvar ?? [];
    expect(ls).toHaveLength(3);
    expect(ls.reduce((s, l) => s + l.valor, 0)).toBe(10000);
    expect(new Set(ls.map((l) => l.grupo)).size).toBe(1);
    expect(ls[0]?.grupo).not.toBe("");
    expect(ls.map((l) => l.parcela)).toEqual(["1/3", "2/3", "3/3"]);
  });

  it("recusa valor zero, data inválida e categoria que não existe", () => {
    expect(() => planejar({ ...novo, valor: 0 }, base(), ctx)).toThrow(ErroDeAcao);
    expect(() => planejar({ ...novo, data: "2026-02-31" }, base(), ctx)).toThrow(ErroDeAcao);
    expect(() => planejar({ ...novo, categoria: "nada" }, base(), ctx)).toThrow(ErroDeAcao);
  });

  it("não deixa pagar a mesma conta fixa duas vezes no mês", () => {
    const pagar = { ...novo, valor: 240000, fixaId: "aluguel", mesRef: "2026-11" };
    const p = planejar(pagar, base(), ctx);
    const pago = p.lancamentos?.salvar ?? [];
    expect(pago[0]).toMatchObject({ fixaId: "aluguel", mesRef: "2026-11" });
    expect(() => planejar(pagar, base({ lancamentos: pago }), ctx)).toThrow(/já foi/);
  });

  it("um acerto não precisa de categoria e vai para a outra pessoa", () => {
    const p = planejar(
      { ...novo, tipo: "acerto", categoria: "", pagoPor: "b", deQuem: "casal", valor: 5000 },
      base(),
      ctx,
    );
    expect(p.lancamentos?.salvar?.[0]).toMatchObject({ tipo: "acerto", pagoPor: "b", deQuem: "a", categoria: "" });
  });

  it("edita mantendo o que não foi enviado", () => {
    const [l] = planejar(novo, base(), ctx).lancamentos?.salvar as Lancamento[];
    const p = planejar({ acao: "lancamento.editar", id: l!.id, valor: 12345 }, base({ lancamentos: [l!] }), ctx);
    expect(p.lancamentos?.salvar?.[0]).toMatchObject({ id: l!.id, valor: 12345, descricao: "Feira" });
  });

  it("remove um lançamento, ou o parcelamento inteiro", () => {
    const ls = planejar({ ...novo, parcelas: 3 }, base(), ctx).lancamentos?.salvar as Lancamento[];
    const d = base({ lancamentos: ls });
    expect(planejar({ acao: "lancamento.remover", id: ls[1]!.id, grupo: false }, d, ctx).lancamentos?.remover).toEqual([ls[1]!.id]);
    expect(planejar({ acao: "lancamento.remover", id: ls[1]!.id, grupo: true }, d, ctx).lancamentos?.remover).toEqual(ls.map((l) => l.id));
    expect(() => planejar({ acao: "lancamento.remover", id: "x", grupo: false }, d, ctx)).toThrow(ErroDeAcao);
  });

  it("cria categoria com id legível e único", () => {
    const d = base();
    const p = planejar({ acao: "categoria.salvar", nome: "Mercado", tipo: "despesa", orcamento: 50000 }, d, ctx);
    expect(p.categorias?.salvar?.[0]).toMatchObject({ id: "mercado-2", nome: "Mercado", orcamento: 50000, ordem: 2 });
    const q = planejar({ acao: "categoria.salvar", nome: "Café & Pão", tipo: "despesa", orcamento: 0 }, d, ctx);
    expect(q.categorias?.salvar?.[0]?.id).toBe("cafe-pao");
  });

  it("salva conta fixa nova e edita uma existente", () => {
    const f = { descricao: "Internet", tipo: "despesa" as const, valor: 11990, dia: 20, categoria: "mercado", pagoPor: "b" as const, deQuem: "casal" as const, parteA: 50, ativa: true };
    const p = planejar({ acao: "fixa.salvar", ...f }, base(), ctx);
    expect(p.fixas?.salvar?.[0]).toMatchObject({ descricao: "Internet", inicio: "", fim: "" });
    const q = planejar({ acao: "fixa.salvar", id: "aluguel", ...f, valor: 250000 }, base(), ctx);
    expect(q.fixas?.salvar?.[0]).toMatchObject({ id: "aluguel", valor: 250000 });
    expect(planejar({ acao: "fixa.remover", id: "aluguel" }, base(), ctx).fixas?.remover).toEqual(["aluguel"]);
  });

  it("salva os nomes e a divisão padrão", () => {
    const p = planejar({ acao: "config.salvar", nomeA: "Paulo", nomeB: "Bia", corA: "verde", corB: "rosa", parteAPadrao: 60 }, base(), ctx);
    expect(p.config).toEqual({ nomeA: "Paulo", nomeB: "Bia", corA: "verde", corB: "rosa", parteAPadrao: 60 });
    expect(() => planejar({ acao: "config.salvar", nomeA: "Paulo", nomeB: "Bia", corA: "verde", corB: "verde", parteAPadrao: 60 }, base(), ctx)).toThrow(/cor/);
  });
});

describe("conta fixa: período e salário bruto", () => {
  const receita = {
    acao: "fixa.salvar" as const, descricao: "Salário", tipo: "receita" as const, valor: 0, dia: 5,
    categoria: "salario", pagoPor: "a" as const, deQuem: "a" as const, parteA: 50, ativa: true,
  };
  const comSalario = () =>
    base({
      categorias: [
        { id: "mercado", nome: "Mercado", tipo: "despesa", orcamento: 0, ordem: 1, arquivada: false },
        { id: "salario", nome: "Salário", tipo: "receita", orcamento: 0, ordem: 2, arquivada: false },
      ],
    });

  it("guarda começo e término, e recusa término antes do começo", () => {
    const f = { ...receita, valor: 100000, inicio: "2026-11", fim: "2027-03" };
    expect(planejar(f, comSalario(), ctx).fixas?.salvar?.[0]).toMatchObject({ inicio: "2026-11", fim: "2027-03" });
    expect(() => planejar({ ...f, fim: "2026-10" }, comSalario(), ctx)).toThrow(/término/);
    expect(() => planejar({ ...f, fim: "2027-13" }, comSalario(), ctx)).toThrow(ErroDeAcao);
  });

  it("com bruto, o valor previsto é o líquido simulado, não o digitado", () => {
    const p = planejar({ ...receita, valor: 1, bruto: 900000, regime: "clt", outrosDescontos: 18000 }, comSalario(), ctx);
    const f = p.fixas?.salvar?.[0];
    expect(f).toMatchObject({ bruto: 900000, regime: "clt", outrosDescontos: 18000 });
    expect(f?.valor).toBe(simular({ bruto: 900000, regime: "clt", dependentes: 0, outrosDescontos: 18000 }).liquido);
  });

  it("recusa descontos maiores que o bruto", () => {
    expect(() =>
      planejar({ ...receita, bruto: 100000, regime: "outro", outrosDescontos: 200000 }, comSalario(), ctx),
    ).toThrow(/descontos/);
  });

  it("numa despesa, ignora os campos de salário", () => {
    const desp = { ...receita, tipo: "despesa" as const, categoria: "mercado", valor: 5000, bruto: 900000, outrosDescontos: 100 };
    expect(planejar(desp, comSalario(), ctx).fixas?.salvar?.[0]).toMatchObject({ bruto: 0, outrosDescontos: 0, valor: 5000 });
  });
});
