import { describe, expect, it } from "vitest";
import { comprovantesDe, donoDoComprovante, donosOrfaos, reconhecer, TAMANHO_MAXIMO, tamanhoLegivel } from "./comprovantes";
import type { Comprovante, Lancamento } from "./tipos";

const bytes = (...xs: number[]) => new Uint8Array([...xs, ...new Array(16).fill(0)]);
const texto = (s: string) => new Uint8Array([...new TextEncoder().encode(s), ...new Array(16).fill(0)]);

const lanc = (id: string, grupo = ""): Lancamento => ({
  id, grupo, data: "2026-11-10", tipo: "despesa", descricao: "x", valor: 100, categoria: "compras",
  pagoPor: "a", deQuem: "a", parteA: 50, parcela: grupo ? "1/3" : "", fixaId: "", mesRef: "", criadoEm: "", criadoPor: "a",
});
const comp = (id: string, dono: string): Comprovante => ({ id, dono, nome: "", tipo: "image/jpeg", tamanho: 10, criadoEm: "", criadoPor: "a" });

describe("reconhecer o arquivo pelo conteúdo", () => {
  it("aceita JPEG, PNG, WebP, HEIC e PDF", () => {
    expect(reconhecer(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(reconhecer(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(reconhecer(texto("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(reconhecer(texto("\0\0\0\x18ftypheic"))).toBe("image/heic");
    expect(reconhecer(texto("\0\0\0\x18ftypmif1"))).toBe("image/heic");
    expect(reconhecer(texto("%PDF-1.7"))).toBe("application/pdf");
  });

  it("recusa o resto, mesmo com nome de imagem", () => {
    expect(reconhecer(texto("<html><script>"))).toBeNull();
    expect(reconhecer(texto("GIF89a"))).toBeNull();
    expect(reconhecer(texto("RIFF\0\0\0\0WAVEfmt "))).toBeNull();
    expect(reconhecer(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("a quem pertence", () => {
  it("lançamento avulso usa o próprio id; parcelado usa o grupo, valendo para todas as parcelas", () => {
    expect(donoDoComprovante(lanc("l1"))).toBe("l1");
    expect(donoDoComprovante(lanc("p1", "g1"))).toBe("g1");
    const todos = [comp("c1", "l1"), comp("c2", "g1"), comp("c3", "g1")];
    expect(comprovantesDe(todos, lanc("p2", "g1")).map((c) => c.id)).toEqual(["c2", "c3"]);
  });

  it("ao excluir, só sobram órfãos os donos que nenhum lançamento usa mais", () => {
    const antes = [lanc("l1"), lanc("p1", "g1"), lanc("p2", "g1"), lanc("l2")];
    // Excluir uma parcela não apaga o comprovante da compra; excluir o avulso, sim.
    expect(donosOrfaos(antes, ["p1", "l1"])).toEqual(["l1"]);
    expect(donosOrfaos(antes, ["p1", "p2"])).toEqual(["g1"]);
    expect(donosOrfaos(antes, [])).toEqual([]);
  });
});

describe("tamanho", () => {
  it("escreve em KB ou MB, e o limite cabe no envio", () => {
    expect(tamanhoLegivel(812)).toBe("1 KB");
    expect(tamanhoLegivel(245_000)).toBe("239 KB");
    expect(tamanhoLegivel(2_400_000)).toBe("2,3 MB");
    expect(TAMANHO_MAXIMO).toBeLessThanOrEqual(3_200_000);
  });
});
