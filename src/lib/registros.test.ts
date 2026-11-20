import { describe, expect, it } from "vitest";
import {
  categoriaParaRegistro, configParaRegistro, fixaParaRegistro, lancamentoParaRegistro,
  registroParaCategoria, registroParaConfig, registroParaFixa, registroParaLancamento,
} from "./registros";
import type { Fixa, Lancamento } from "./tipos";

const l: Lancamento = {
  id: "k3j9x2", data: "2026-11-16", tipo: "despesa", descricao: "Feira", valor: 12345, categoria: "mercado",
  pagoPor: "b", deQuem: "casal", parteA: 60, parcela: "2/3", grupo: "g1", fixaId: "", mesRef: "",
  criadoEm: "2026-11-16T12:00:00.000Z", criadoPor: "b",
};

describe("registros do banco", () => {
  it("lançamento vai e volta sem perder nada, com o valor em reais na coluna", () => {
    const r = lancamentoParaRegistro(l);
    expect(r.valor).toBe(123.45);
    expect(r.pago_por).toBe("b");
    expect(registroParaLancamento(r)).toEqual(l);
  });

  it("aceita o que o banco devolve: número como texto, hora com fuso e campos nulos", () => {
    const r = registroParaLancamento({
      id: "m1", data: "2026-11-16", tipo: "despesa", descricao: null, valor: "18.50", categoria: "mercado",
      pago_por: "b", de_quem: "casal", parte_a: 50, parcela: null, grupo: null, fixa_id: null, mes_ref: null,
      criado_em: "2026-11-16T09:00:00-03:00", criado_por: null,
    });
    expect(r).toMatchObject({ valor: 1850, descricao: "", parcela: "", criadoEm: "2026-11-16T12:00:00.000Z" });
  });

  it("categoria e conta fixa vão e voltam", () => {
    const c = { id: "mercado", nome: "Mercado", tipo: "despesa" as const, orcamento: 140000, ordem: 1, arquivada: false };
    expect(registroParaCategoria(categoriaParaRegistro(c))).toEqual(c);
    const f: Fixa = {
      id: "f1", descricao: "Aluguel", tipo: "despesa", valor: 240000, dia: 10, categoria: "moradia",
      pagoPor: "a", deQuem: "casal", parteA: 50, ativa: true, inicio: "2026-01", fim: "2027-06", bruto: 900000, regime: "outro", dependentes: 2, outrosDescontos: 18050,
    };
    expect(registroParaFixa(fixaParaRegistro(f))).toEqual(f);
  });

  it("config vai e volta numa linha só, e nunca devolve duas cores iguais", () => {
    const c = { nomeA: "Paulo", nomeB: "Giovana", corA: "verde" as const, corB: "rosa" as const, parteAPadrao: 55 };
    expect(configParaRegistro(c).id).toBe(1);
    expect(registroParaConfig(configParaRegistro(c))).toEqual(c);
    expect(registroParaConfig({ cor_a: "laranja", cor_b: "laranja" }).corB).toBe("azul");
  });
});
