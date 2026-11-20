import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroDeAcao } from "../acoes";
import type { Lancamento } from "../tipos";
import { ErroDeConfiguracao } from "./ambiente";

vi.mock("server-only", () => ({}));

type Linha = Record<string, unknown>;

/** Uma API de dados do Supabase de mentira, em memória, com o que o app usa. */
class BancoFalso {
  tabelas: Record<string, Linha[]> = {
    lancamentos: [],
    categorias: [{ id: "mercado", nome: "Mercado", tipo: "despesa", orcamento: 0, ordem: 1, arquivada: false }],
    fixas: [],
    config: [{ id: 1, nome_a: "Paulo", nome_b: "Giovana", cor_a: "azul", cor_b: "laranja", parte_a_padrao: 50 }],
    comprovantes: [],
  };
  segredo = "certo";
  pedidos: { metodo: string; caminho: string; cabecalhos: Record<string, string> }[] = [];

  responder = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const u = new URL(String(url));
    const cabecalhos = (init?.headers ?? {}) as Record<string, string>;
    const metodo = init?.method ?? "GET";
    const tabela = u.pathname.replace("/rest/v1/", "");
    this.pedidos.push({ metodo, caminho: `${tabela}${u.search}`, cabecalhos });
    const json = (dados: unknown, status = 200) => new Response(JSON.stringify(dados), { status });
    const linhas = this.tabelas[tabela];
    if (!linhas) return json({ code: "PGRST205", message: "tabela não existe" }, 404);
    // Como a política do banco: sem o segredo certo, leituras voltam vazias e gravações são recusadas.
    const autorizado = cabecalhos["x-app-chave"] === this.segredo;

    if (metodo === "GET") {
      if (!autorizado) return json([]);
      const eq = u.searchParams.get("id")?.replace("eq.", "");
      const base = eq ? linhas.filter((l) => String(l.id) === eq) : [...linhas].sort((a, b) => String(a.id).localeCompare(String(b.id)));
      const inicio = Number(u.searchParams.get("offset") ?? 0);
      return json(base.slice(inicio, inicio + Number(u.searchParams.get("limit") ?? 1000)));
    }
    if (!autorizado) return json({ code: "42501", message: "violates row-level security policy" }, 401);
    if (metodo === "POST") {
      const corpo = JSON.parse(String(init?.body)) as Linha | Linha[];
      for (const nova of Array.isArray(corpo) ? corpo : [corpo]) {
        const i = linhas.findIndex((l) => l.id === nova.id);
        const repetida = tabela === "lancamentos" && nova.fixa_id &&
          linhas.some((l) => l.id !== nova.id && l.fixa_id === nova.fixa_id && l.mes_ref === nova.mes_ref);
        if (repetida) return json({ code: "23505", message: "duplicate key" }, 409);
        if (i >= 0) linhas[i] = { ...linhas[i], ...nova };
        else linhas.push(nova);
      }
      return new Response(null, { status: 201 });
    }
    if (metodo === "DELETE") {
      const coluna = u.searchParams.has("dono") ? "dono" : "id";
      const ids = (u.searchParams.get(coluna) ?? "").replace(/^in\.\(|\)$/g, "").split(",").map((x) => x.replace(/"/g, ""));
      this.tabelas[tabela] = linhas.filter((l) => !ids.includes(String(l[coluna])));
      return new Response(null, { status: 204 });
    }
    return json({ message: "não previsto" }, 500);
  };
}

const cred = { url: "https://projeto.supabase.co", chave: "sb_publishable_x", segredo: "certo" };

function lanc(id: string, p: Partial<Lancamento> = {}): Lancamento {
  return {
    id, data: "2026-11-16", tipo: "despesa", descricao: `Item ${id}`, valor: 1000, categoria: "mercado",
    pagoPor: "a", deQuem: "casal", parteA: 50, parcela: "", grupo: "", fixaId: "", mesRef: "",
    criadoEm: "2026-11-16T12:00:00.000Z", criadoPor: "a", ...p,
  };
}

describe("banco", () => {
  let falso: BancoFalso;
  beforeEach(() => {
    falso = new BancoFalso();
    vi.stubGlobal("fetch", falso.responder);
  });

  it("lê tudo e manda a chave e o segredo em todo pedido", async () => {
    const { lerDados } = await import("./banco");
    const dados = await lerDados(cred);
    expect(dados.demo).toBe(false);
    expect(dados.config).toMatchObject({ nomeA: "Paulo", nomeB: "Giovana" });
    expect(dados.categorias.map((c) => c.id)).toEqual(["mercado"]);
    expect(falso.pedidos).toHaveLength(5);
    expect(dados.comprovantes).toEqual([]);
    for (const p of falso.pedidos) {
      expect(p.cabecalhos.apikey).toBe("sb_publishable_x");
      expect(p.cabecalhos["x-app-chave"]).toBe("certo");
    }
  });

  it("guarda um comprovante, lista sem o conteúdo, devolve o arquivo e apaga pelo lançamento", async () => {
    const { apagarComprovantes, guardarComprovante, lerArquivo, lerDados } = await import("./banco");
    const bytes = Buffer.from("%PDF-1.7 comprovante");
    await guardarComprovante(cred, {
      id: "abcdef0123456789", dono: "l1", nome: "boleto.pdf", tipo: "application/pdf",
      tamanho: bytes.byteLength, criadoPor: "b", conteudo: bytes.toString("base64"),
    });
    await guardarComprovante(cred, {
      id: "abcdef0123456780", dono: "g1", nome: "nota.jpg", tipo: "image/jpeg",
      tamanho: 3, criadoPor: "a", conteudo: "AAAA",
    });
    const pedidoDaLista = () => falso.pedidos.find((p) => p.caminho.startsWith("comprovantes?select="))!;
    const dados = await lerDados(cred);
    expect(pedidoDaLista().caminho).not.toContain("conteudo");
    expect(dados.comprovantes.map((c) => [c.dono, c.nome, c.criadoPor])).toEqual([["g1", "nota.jpg", "a"], ["l1", "boleto.pdf", "b"]]);
    expect(dados.comprovantes[0]).not.toHaveProperty("conteudo");

    const arquivo = await lerArquivo(cred, "abcdef0123456789");
    expect(arquivo?.tipo).toBe("application/pdf");
    expect(arquivo?.bytes.toString()).toBe("%PDF-1.7 comprovante");
    expect(await lerArquivo(cred, "0000000000000000")).toBeNull();

    await apagarComprovantes(cred, { donos: ["l1"] });
    expect(falso.tabelas.comprovantes!.map((c) => c.id)).toEqual(["abcdef0123456780"]);
  });

  it("sem a tabela de comprovantes, o resto continua abrindo", async () => {
    const { lerDados } = await import("./banco");
    delete falso.tabelas.comprovantes;
    const dados = await lerDados(cred);
    expect(dados.comprovantes).toEqual([]);
    expect(dados.categorias).toHaveLength(1);
  });

  it("cria, altera e apaga lançamentos sem tocar nos outros", async () => {
    const { gravar, lerDados } = await import("./banco");
    await gravar(cred, { lancamentos: { salvar: [lanc("aaaaaaaa1"), lanc("bbbbbbbb2"), lanc("cccccccc3")] } });
    await gravar(cred, {
      lancamentos: { salvar: [lanc("bbbbbbbb2", { valor: 99990, descricao: "Editado" }), lanc("dddddddd4")], remover: ["aaaaaaaa1"] },
    });
    const depois = (await lerDados(cred)).lancamentos;
    expect(depois.map((l) => l.id)).toEqual(["bbbbbbbb2", "cccccccc3", "dddddddd4"]);
    expect(depois[0]).toMatchObject({ valor: 99990, descricao: "Editado", criadoEm: "2026-11-16T12:00:00.000Z" });
    expect(falso.tabelas.lancamentos!.find((l) => l.id === "bbbbbbbb2")!.valor).toBe(999.9);
  });

  it("lê além de mil linhas, página por página", async () => {
    const { lerDados } = await import("./banco");
    falso.tabelas.lancamentos = Array.from({ length: 2300 }, (_, i) => ({
      id: `l${String(i).padStart(5, "0")}`, data: "2026-11-16", tipo: "despesa", valor: 1, pago_por: "a", de_quem: "a", parte_a: 50,
    }));
    const dados = await lerDados(cred);
    expect(dados.lancamentos).toHaveLength(2300);
    expect(new Set(dados.lancamentos.map((l) => l.id)).size).toBe(2300);
  });

  it("grava configuração, categoria e conta fixa", async () => {
    const { gravar, lerDados } = await import("./banco");
    const antes = await lerDados(cred);
    await gravar(cred, {
      config: { ...antes.config, corA: "verde", parteAPadrao: 60 },
      categorias: { salvar: [{ ...antes.categorias[0]!, orcamento: 140000 }] },
      fixas: {
        salvar: [{
          id: "aluguel01", descricao: "Aluguel", tipo: "despesa", valor: 240000, dia: 10, categoria: "mercado",
          pagoPor: "a", deQuem: "casal", parteA: 50, ativa: true, inicio: "", fim: "", bruto: 0, regime: "clt", dependentes: 0, outrosDescontos: 0, natureza: "conta", periodicidade: "mensal", mesAnual: 0,
        }],
      },
    });
    const depois = await lerDados(cred);
    expect(depois.config).toMatchObject({ corA: "verde", parteAPadrao: 60, nomeB: "Giovana" });
    expect(falso.tabelas.config).toHaveLength(1);
    expect(depois.categorias[0]!.orcamento).toBe(140000);
    expect(depois.fixas[0]).toMatchObject({ descricao: "Aluguel", valor: 240000 });
  });

  it("com o segredo errado, avisa em vez de mostrar um app vazio", async () => {
    const { gravar, lerDados } = await import("./banco");
    const errado = { ...cred, segredo: "outro" };
    await expect(lerDados(errado)).rejects.toBeInstanceOf(ErroDeConfiguracao);
    await expect(gravar(errado, { lancamentos: { salvar: [lanc("aaaaaaaa1")] } })).rejects.toBeInstanceOf(ErroDeConfiguracao);
    expect(falso.tabelas.lancamentos).toHaveLength(0);
  });

  it("o banco impede pagar a mesma conta fixa duas vezes no mês", async () => {
    const { gravar } = await import("./banco");
    await gravar(cred, { lancamentos: { salvar: [lanc("aaaaaaaa1", { fixaId: "aluguel", mesRef: "2026-11" })] } });
    await expect(
      gravar(cred, { lancamentos: { salvar: [lanc("bbbbbbbb2", { fixaId: "aluguel", mesRef: "2026-11" })] } }),
    ).rejects.toBeInstanceOf(ErroDeAcao);
  });

  it("o diagnóstico grava, altera, relê e apaga a linha de teste", async () => {
    const { diagnosticar } = await import("./banco");
    const d = await diagnosticar(cred);
    expect(d.passos.map((p) => [p.passo, p.ok])).toEqual([["ler", true], ["criar", true], ["alterar", true], ["apagar", true]]);
    expect(d.ok).toBe(true);
    expect(falso.tabelas.lancamentos).toHaveLength(0);
  });
});
