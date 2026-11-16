import { generateKeyPairSync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Lancamento } from "../tipos";

vi.mock("server-only", () => ({}));

/** Uma planilha do Google de mentira, em memória, com as chamadas que o app usa. */
class PlanilhaFalsa {
  abas = new Map<string, unknown[][]>();
  ids = new Map<string, number>();
  chamadas: string[] = [];

  private celula(a1: string): { aba: string; linha: number } {
    const [aba, resto = "A1"] = a1.split("!");
    return { aba: aba!, linha: Number(/\d+/.exec(resto)?.[0] ?? 1) };
  }

  responder = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const u = new URL(String(url));
    const corpo = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    const json = (dados: unknown, status = 200) =>
      new Response(JSON.stringify(dados), { status, headers: { "content-type": "application/json" } });

    if (u.host === "oauth2.googleapis.com") return json({ access_token: "t", expires_in: 3600 });
    const caminho = decodeURIComponent(u.pathname.replace("/v4/spreadsheets/planilha-1", ""));
    this.chamadas.push(`${init?.method ?? "GET"} ${caminho}`);

    if (caminho === "/values:batchGet") {
      const faixas = u.searchParams.getAll("ranges");
      if (faixas.some((f) => !this.abas.has(this.celula(f).aba))) return json({ error: "Unable to parse range" }, 400);
      return json({
        valueRanges: faixas.map((f) => {
          const { aba, linha } = this.celula(f);
          return { values: this.abas.get(aba)!.slice(linha - 1) };
        }),
      });
    }
    if (caminho === "" && u.searchParams.has("fields")) {
      return json({ sheets: [...this.ids].map(([title, sheetId]) => ({ properties: { title, sheetId } })) });
    }
    if (caminho === ":batchUpdate") {
      for (const r of corpo.requests) {
        if (r.addSheet) {
          const titulo = r.addSheet.properties.title as string;
          this.abas.set(titulo, []);
          this.ids.set(titulo, this.ids.size + 100);
        }
        if (r.deleteDimension) {
          const { sheetId, startIndex, endIndex } = r.deleteDimension.range;
          const aba = [...this.ids].find(([, id]) => id === sheetId)![0];
          this.abas.get(aba)!.splice(startIndex, endIndex - startIndex);
        }
      }
      return json({});
    }
    if (caminho === "/values:batchUpdate") {
      for (const d of corpo.data as { range: string; values: unknown[][] }[]) {
        const { aba, linha } = this.celula(d.range);
        const linhas = this.abas.get(aba)!;
        d.values.forEach((v, i) => (linhas[linha - 1 + i] = v));
      }
      return json({});
    }
    const anexar = /^\/values\/(.+):append$/.exec(caminho);
    if (anexar) {
      this.abas.get(this.celula(anexar[1]!).aba)!.push(...(corpo.values as unknown[][]));
      return json({});
    }
    const coluna = /^\/values\/(.+)$/.exec(caminho);
    if (coluna) {
      const { aba, linha } = this.celula(coluna[1]!);
      return json({ values: this.abas.get(aba)!.slice(linha - 1).map((r) => [r[0]]) });
    }
    return json({ error: `não previsto: ${caminho}` }, 500);
  };
}

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const cred = {
  email: "app@projeto.iam.gserviceaccount.com",
  chave: privateKey.export({ type: "pkcs8", format: "pem" }) as string,
  planilhaId: "planilha-1",
};

function lanc(id: string, p: Partial<Lancamento> = {}): Lancamento {
  return {
    id, data: "2026-11-16", tipo: "despesa", descricao: `Item ${id}`, valor: 1000, categoria: "mercado",
    pagoPor: "a", deQuem: "casal", parteA: 50, parcela: "", grupo: "", fixaId: "", mesRef: "",
    criadoEm: "2026-11-16T12:00:00.000Z", criadoPor: "a", ...p,
  };
}

describe("planilha", () => {
  let falsa: PlanilhaFalsa;
  beforeEach(() => {
    falsa = new PlanilhaFalsa();
    vi.stubGlobal("fetch", falsa.responder);
  });

  it("prepara uma planilha em branco na primeira leitura", async () => {
    const { lerDados } = await import("./planilha");
    const dados = await lerDados(cred);
    expect([...falsa.abas.keys()].sort()).toEqual(["Categorias", "Config", "Fixas", "Lancamentos"]);
    expect(falsa.abas.get("Lancamentos")![0]![0]).toBe("id");
    expect(dados.lancamentos).toEqual([]);
    expect(dados.categorias.map((c) => c.id)).toContain("mercado");
    expect(dados.config).toMatchObject({ nomeA: "Paulo", nomeB: "Giovana", parteAPadrao: 50 });
    expect(dados.demo).toBe(false);
  });

  it("acrescenta, altera na mesma linha e apaga sem tocar nas outras", async () => {
    const { gravar, lerDados } = await import("./planilha");
    await lerDados(cred);
    await gravar(cred, { lancamentos: { salvar: [lanc("aaaaaaaa1"), lanc("bbbbbbbb2"), lanc("cccccccc3")] } });
    expect((await lerDados(cred)).lancamentos.map((l) => l.id)).toEqual(["aaaaaaaa1", "bbbbbbbb2", "cccccccc3"]);

    await gravar(cred, {
      lancamentos: { salvar: [lanc("bbbbbbbb2", { valor: 99990, descricao: "Editado" }), lanc("dddddddd4")], remover: ["aaaaaaaa1"] },
    });
    const depois = (await lerDados(cred)).lancamentos;
    expect(depois.map((l) => l.id)).toEqual(["bbbbbbbb2", "cccccccc3", "dddddddd4"]);
    expect(depois[0]).toMatchObject({ valor: 99990, descricao: "Editado" });
    expect(falsa.abas.get("Lancamentos")![1]![4]).toBe(999.9);
    expect(falsa.abas.get("Lancamentos")).toHaveLength(4);
  });

  it("apaga várias linhas de uma vez, de baixo para cima", async () => {
    const { gravar, lerDados } = await import("./planilha");
    await lerDados(cred);
    await gravar(cred, { lancamentos: { salvar: ["a", "b", "c", "d", "e"].map((x) => lanc(`${x}0000000`)) } });
    await gravar(cred, { lancamentos: { remover: ["a0000000", "c0000000", "e0000000"] } });
    expect((await lerDados(cred)).lancamentos.map((l) => l.id)).toEqual(["b0000000", "d0000000"]);
  });

  it("grava configuração, categoria e conta fixa", async () => {
    const { gravar, lerDados } = await import("./planilha");
    const antes = await lerDados(cred);
    const mercado = antes.categorias.find((c) => c.id === "mercado")!;
    await gravar(cred, {
      config: { ...antes.config, corA: "verde", parteAPadrao: 60 },
      categorias: { salvar: [{ ...mercado, orcamento: 140000 }] },
      fixas: {
        salvar: [{
          id: "aluguel01", descricao: "Aluguel", tipo: "despesa", valor: 240000, dia: 10, categoria: "moradia",
          pagoPor: "a", deQuem: "casal", parteA: 50, ativa: true, inicio: "", fim: "",
        }],
      },
    });
    const depois = await lerDados(cred);
    expect(depois.config).toMatchObject({ corA: "verde", parteAPadrao: 60, nomeB: "Giovana" });
    expect(depois.categorias.find((c) => c.id === "mercado")!.orcamento).toBe(140000);
    expect(depois.categorias).toHaveLength(antes.categorias.length);
    expect(depois.fixas).toHaveLength(1);
    expect(depois.fixas[0]).toMatchObject({ descricao: "Aluguel", valor: 240000, ativa: true });
  });
});
