import { describe, expect, it } from "vitest";
import {
  categoriaParaLinha, configParaLinhas, fixaParaLinha, lancamentoParaLinha, lerData,
  linhaParaCategoria, linhaParaFixa, linhaParaLancamento, linhasParaConfig,
} from "./linhas";
import type { Fixa, Lancamento } from "./tipos";

const l: Lancamento = {
  id: "k3j9x2", data: "2026-11-16", tipo: "despesa", descricao: "Feira", valor: 12345, categoria: "mercado",
  pagoPor: "b", deQuem: "casal", parteA: 60, parcela: "2/3", grupo: "g1", fixaId: "", mesRef: "",
  criadoEm: "2026-11-16T12:00:00.000Z", criadoPor: "b",
};

describe("linhas da planilha", () => {
  it("lançamento vai e volta sem perder nada, com o valor em reais na célula", () => {
    const linha = lancamentoParaLinha(l);
    expect(linha[4]).toBe(123.45);
    expect(linhaParaLancamento(linha)).toEqual(l);
  });

  it("entende o que alguém digitou à mão na planilha", () => {
    const r = linhaParaLancamento(["m1", 46342, "Despesa", "Padaria", "R$ 18,50", "mercado", "B", "", "", "", "", "", "", "", ""]);
    expect(r).toMatchObject({ data: "2026-11-16", tipo: "despesa", valor: 1850, pagoPor: "b", deQuem: "casal", parteA: 50 });
    expect(lerData("16/11/2026")).toBe("2026-11-16");
  });

  it("ignora linhas sem id ou sem data válida", () => {
    expect(linhaParaLancamento(["", "2026-11-16"])).toBeNull();
    expect(linhaParaLancamento(["x", "amanhã"])).toBeNull();
    expect(linhaParaLancamento([])).toBeNull();
  });

  it("categoria e conta fixa vão e voltam", () => {
    const c = { id: "mercado", nome: "Mercado", tipo: "despesa" as const, orcamento: 140000, ordem: 1, arquivada: false };
    expect(linhaParaCategoria(categoriaParaLinha(c))).toEqual(c);
    const f: Fixa = {
      id: "f1", descricao: "Aluguel", tipo: "despesa", valor: 240000, dia: 10, categoria: "moradia",
      pagoPor: "a", deQuem: "casal", parteA: 50, ativa: true, inicio: "2026-01", fim: "",
    };
    expect(linhaParaFixa(fixaParaLinha(f))).toEqual(f);
  });

  it("config vai e volta, e nunca devolve duas cores iguais", () => {
    const c = { nomeA: "Paulo", nomeB: "Bia", corA: "verde" as const, corB: "rosa" as const, parteAPadrao: 55 };
    expect(linhasParaConfig(configParaLinhas(c))).toEqual(c);
    expect(linhasParaConfig([])).toEqual({ nomeA: "", nomeB: "", corA: "azul", corB: "laranja", parteAPadrao: 50 });
    expect(linhasParaConfig([["cor_a", "laranja"], ["cor_b", "laranja"]]).corB).toBe("azul");
  });
});
