import { describe, expect, it } from "vitest";
import { planejar, type Contexto } from "./acoes";
import { descrever, descreverAcesso, descreverComprovante, grupoDaAtividade } from "./atividade";
import type { Dados, Fixa, Lancamento } from "./tipos";

let n = 0;
const ctx: Contexto = { quem: "b", agora: "2026-11-20T15:30:00.000Z", novoId: () => `id${++n}` };
const base = { id: "at1", quando: ctx.agora, quem: "b" as const };

function fixa(p: Partial<Fixa> = {}): Fixa {
  return {
    id: "internet", descricao: "Internet", tipo: "despesa", valor: 11990, dia: 20, categoria: "contas", pagoPor: "a",
    deQuem: "casal", parteA: 50, ativa: true, inicio: "", fim: "", bruto: 0, regime: "clt", dependentes: 0,
    outrosDescontos: 0, natureza: "conta", periodicidade: "mensal", mesAnual: 0, ...p,
  };
}

function dados(p: Partial<Dados> = {}): Dados {
  return {
    demo: false,
    config: { nomeA: "Paulo", nomeB: "Giovana", corA: "azul", corB: "laranja", parteAPadrao: 50 },
    categorias: [
      { id: "mercado", nome: "Mercado", tipo: "despesa", orcamento: 140000, ordem: 1, arquivada: false },
      { id: "compras", nome: "Compras", tipo: "despesa", orcamento: 0, ordem: 2, arquivada: false },
      { id: "contas", nome: "Contas da casa", tipo: "despesa", orcamento: 0, ordem: 3, arquivada: false },
      { id: "assinaturas", nome: "Assinaturas", tipo: "despesa", orcamento: 0, ordem: 4, arquivada: false },
      { id: "salario", nome: "Salário", tipo: "receita", orcamento: 0, ordem: 5, arquivada: false },
    ],
    fixas: [],
    lancamentos: [],
    comprovantes: [],
    atividades: [],
    ...p,
  };
}

/** Planeja a ação como o app faz e descreve o que aconteceu. */
function fazer(acao: Record<string, unknown>, d: Dados) {
  const patch = planejar(acao, d, ctx);
  return descrever(acao, d, patch, base);
}

const feira = {
  acao: "lancamento.criar", tipo: "despesa", data: "2026-11-20", descricao: "Feira", valor: 9210,
  categoria: "mercado", pagoPor: "b", deQuem: "casal", parteA: 50, parcelas: 1,
};

describe("lançamentos", () => {
  it("lançar uma despesa conta o quê, quanto e os detalhes", () => {
    const a = fazer(feira, dados())!;
    expect(a).toMatchObject({ tipo: "lancamento.criar", quem: "b", resumo: "lançou Feira, R$ 92,10" });
    expect(a.mudancas).toEqual([
      { campo: "Categoria", de: "", para: "Mercado" },
      { campo: "Data", de: "", para: "20/11/2026" },
      { campo: "Quem pagou", de: "", para: "Giovana" },
      { campo: "De quem é", de: "", para: "Dos dois, Paulo 50%, Giovana 50%" },
    ]);
    expect(a.alvo).toMatch(/^id\d+$/);
  });

  it("parcelado diz quantas parcelas e de quanto, e o alvo é o grupo", () => {
    const a = fazer({ ...feira, descricao: "Geladeira", valor: 300000, categoria: "compras", parcelas: 3 }, dados())!;
    expect(a.resumo).toBe("lançou Geladeira em 3 parcelas de R$ 1.000,00 (R$ 3.000,00 no total)");
    const d = dados();
    const patch = planejar({ ...feira, parcelas: 3 }, d, ctx);
    expect(descrever({ ...feira, parcelas: 3 }, d, patch, base)!.alvo).toBe(patch.lancamentos!.salvar![0]!.grupo);
  });

  it("receita e acerto têm o texto deles", () => {
    expect(fazer({ ...feira, tipo: "receita", descricao: "Freela", categoria: "salario", deQuem: "b" }, dados())!.resumo)
      .toBe("lançou a receita Freela, +R$ 92,10");
    expect(fazer({ ...feira, tipo: "acerto", descricao: "", categoria: "", pagoPor: "b" }, dados())!.resumo)
      .toBe("registrou um acerto: Giovana transferiu R$ 92,10 para Paulo");
  });

  it("editar guarda o antes e o depois só do que mudou; sem mudança, não registra", () => {
    const [l] = planejar(feira, dados(), ctx).lancamentos!.salvar as Lancamento[];
    const d = dados({ lancamentos: [l!] });
    const a = fazer({ acao: "lancamento.editar", id: l!.id, valor: 10450, categoria: "compras", deQuem: "a" }, d)!;
    expect(a.tipo).toBe("lancamento.editar");
    expect(a.resumo).toBe("alterou Feira");
    expect(a.mudancas).toEqual([
      { campo: "Valor", de: "R$ 92,10", para: "R$ 104,50" },
      { campo: "Categoria", de: "Mercado", para: "Compras" },
      { campo: "De quem é", de: "Dos dois, Paulo 50%, Giovana 50%", para: "Só de Paulo" },
    ]);
    expect(fazer({ acao: "lancamento.editar", id: l!.id, valor: 9210 }, d)).toBeNull();
  });

  it("excluir guarda o que foi apagado, para dar para refazer", () => {
    const [l] = planejar(feira, dados(), ctx).lancamentos!.salvar as Lancamento[];
    const a = fazer({ acao: "lancamento.remover", id: l!.id, grupo: false }, dados({ lancamentos: [l!] }))!;
    expect(a.resumo).toBe("excluiu Feira, R$ 92,10");
    expect(a.mudancas).toContainEqual({ campo: "Valor", de: "R$ 92,10", para: "" });
    expect(a.mudancas).toContainEqual({ campo: "Data", de: "20/11/2026", para: "" });

    const ls = planejar({ ...feira, descricao: "Sofá", parcelas: 3 }, dados(), ctx).lancamentos!.salvar as Lancamento[];
    const d = dados({ lancamentos: ls });
    expect(fazer({ acao: "lancamento.remover", id: ls[1]!.id, grupo: true }, d)!.resumo).toBe("excluiu as 3 parcelas de Sofá, R$ 92,10 no total");
    expect(fazer({ acao: "lancamento.remover", id: ls[1]!.id, grupo: false }, d)!.resumo).toBe("excluiu a parcela 2/3 de Sofá, R$ 30,70");
  });
});

describe("contas fixas e assinaturas", () => {
  it("pagar uma conta e marcar várias de uma vez", () => {
    const internet = fixa();
    const luz = fixa({ id: "luz", descricao: "Conta de luz", valor: 21480, dia: 15 });
    const d = dados({ fixas: [internet, luz] });
    const uma = fazer({ ...feira, descricao: "Internet", valor: 11990, categoria: "contas", fixaId: "internet", mesRef: "2026-11" }, d)!;
    expect(uma).toMatchObject({ tipo: "conta.pagar", resumo: "pagou Internet de novembro, R$ 119,90", alvo: "internet" });
    const varias = fazer({ acao: "fixas.pagarMes", mes: "2026-11", ids: ["internet", "luz"] }, d)!;
    expect(varias.resumo).toBe("marcou 2 contas como pagas em novembro, R$ 334,70 no total");
    expect(varias.mudancas).toEqual([
      { campo: "Internet", de: "", para: "R$ 119,90" },
      { campo: "Conta de luz", de: "", para: "R$ 214,80" },
    ]);
  });

  it("confirmar salário simulado mostra a diferença para o simulado", () => {
    const sal = fixa({ id: "sal", descricao: "Salário da Giovana", tipo: "receita", categoria: "salario", bruto: 750000, valor: 554889, pagoPor: "b", deQuem: "b" });
    const a = fazer(
      { ...feira, tipo: "receita", descricao: "Salário da Giovana", valor: 531000, categoria: "salario", deQuem: "b", fixaId: "sal", mesRef: "2026-11" },
      dados({ fixas: [sal] }),
    )!;
    expect(a.tipo).toBe("salario.confirmar");
    expect(a.resumo).toBe("confirmou Salário da Giovana de novembro: +R$ 5.310,00");
    expect(a.mudancas[0]!.campo).toBe("Valor");
    expect(a.mudancas[0]!.de).toMatch(/simulado/);
  });

  it("criar, alterar e remover assinatura", () => {
    const nova = {
      acao: "fixa.salvar", descricao: "Netflix", tipo: "despesa", valor: 4490, dia: 12, categoria: "assinaturas",
      pagoPor: "b", deQuem: "casal", parteA: 50, ativa: true, natureza: "assinatura",
    };
    expect(fazer(nova, dados())!).toMatchObject({ tipo: "assinatura.criar", resumo: "adicionou a assinatura Netflix, R$ 44,90 por mês" });

    const netflix = fixa({ id: "nf", descricao: "Netflix", valor: 4490, dia: 12, categoria: "assinaturas", natureza: "assinatura", pagoPor: "b" });
    const d = dados({ fixas: [netflix] });
    const a = fazer({ ...nova, id: "nf", valor: 5990, ativa: false, periodicidade: "anual", mesAnual: 3 }, d)!;
    expect(a).toMatchObject({ tipo: "assinatura.editar", resumo: "alterou a assinatura Netflix" });
    expect(a.mudancas).toEqual([
      { campo: "Valor", de: "R$ 44,90", para: "R$ 59,90" },
      { campo: "Situação", de: "Ativa", para: "Pausada" },
      { campo: "Cobrança", de: "Todo mês", para: "Uma vez por ano, em março" },
    ]);
    expect(fazer({ acao: "fixa.remover", id: "nf" }, d)!).toMatchObject({ tipo: "assinatura.remover", resumo: "removeu a assinatura Netflix" });
  });

  it("conta fixa com término", () => {
    const d = dados({ fixas: [fixa()] });
    const a = fazer({ acao: "fixa.salvar", ...fixa(), fim: "2026-12" }, d)!;
    expect(a).toMatchObject({ tipo: "fixa.editar", resumo: "alterou a conta fixa Internet" });
    expect(a.mudancas).toEqual([{ campo: "Termina em", de: "Sem término", para: "dezembro de 2026" }]);
  });
});

describe("ajustes, comprovantes e acesso", () => {
  it("categoria: orçamento e arquivar", () => {
    const d = dados();
    expect(fazer({ acao: "categoria.salvar", id: "mercado", nome: "Mercado", tipo: "despesa", orcamento: 150000 }, d)!.mudancas)
      .toEqual([{ campo: "Orçamento", de: "R$ 1.400,00", para: "R$ 1.500,00" }]);
    expect(fazer({ acao: "categoria.salvar", id: "compras", nome: "Compras", tipo: "despesa", orcamento: 0, arquivada: true }, d)!.resumo)
      .toBe("arquivou a categoria Compras");
    expect(fazer({ acao: "categoria.salvar", nome: "Pets", tipo: "despesa", orcamento: 20000 }, d)!.resumo)
      .toBe("criou a categoria Pets, orçamento de R$ 200,00");
  });

  it("ajustes do casal", () => {
    const a = fazer({ acao: "config.salvar", nomeA: "Paulo", nomeB: "Gi", corA: "azul", corB: "rosa", parteAPadrao: 60 }, dados())!;
    expect(a.resumo).toBe("alterou os ajustes do casal");
    expect(a.mudancas).toEqual([
      { campo: "Nome", de: "Giovana", para: "Gi" },
      { campo: "Cor de Giovana", de: "Laranja", para: "Rosa" },
      { campo: "Divisão padrão", de: "Paulo 50%, Giovana 50%", para: "Paulo 60%, Gi 40%" },
    ]);
  });

  it("comprovante aponta o lançamento", () => {
    const [l] = planejar(feira, dados(), ctx).lancamentos!.salvar as Lancamento[];
    const c = { id: "c1", dono: l!.id, nome: "nota.jpg", tipo: "image/jpeg", tamanho: 245_000, criadoEm: "", criadoPor: "a" };
    const a = descreverComprovante("anexar", c, dados({ lancamentos: [l!] }), { ...base, quem: "a" });
    expect(a).toMatchObject({ tipo: "comprovante.anexar", quem: "a", resumo: "anexou um comprovante em Feira", alvo: l!.id });
    expect(a.mudancas).toEqual([{ campo: "Arquivo", de: "", para: "nota.jpg, 239 KB" }]);
    expect(descreverComprovante("apagar", c, dados({ lancamentos: [l!] }), base).resumo).toBe("apagou um comprovante de Feira");
  });

  it("entrar, sair e trocar a senha; e cada tipo cai num grupo do filtro", () => {
    expect(descreverAcesso("acesso.entrar", base).resumo).toBe("entrou no app");
    expect(descreverAcesso("acesso.senha", base).resumo).toBe("trocou a senha");
    expect(grupoDaAtividade("conta.pagar")).toBe("lancamentos");
    expect(grupoDaAtividade("assinatura.remover")).toBe("contas");
    expect(grupoDaAtividade("categoria.criar")).toBe("ajustes");
    expect(grupoDaAtividade("comprovante.apagar")).toBe("comprovantes");
    expect(grupoDaAtividade("acesso.sair")).toBe("acesso");
  });
});
