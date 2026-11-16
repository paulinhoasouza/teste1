import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("senha", () => {
  it("confere a senha certa e recusa a errada", async () => {
    const { conferirSenha, gerarHash } = await import("./senha");
    const hash = await gerarHash("uma senha qualquer");
    expect(hash.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(await conferirSenha("uma senha qualquer", hash)).toBe(true);
    expect(await conferirSenha("uma senha qualquer ", hash)).toBe(false);
    expect(await conferirSenha("", hash)).toBe(false);
  });

  it("gera um hash diferente a cada vez, por causa do sal", async () => {
    const { gerarHash } = await import("./senha");
    expect(await gerarHash("igual")).not.toBe(await gerarHash("igual"));
  });

  it("recusa hash malformado sem estourar", async () => {
    const { HASH_DE_ENCHIMENTO, conferirSenha } = await import("./senha");
    expect(await conferirSenha("x", "")).toBe(false);
    expect(await conferirSenha("x", "md5$abc")).toBe(false);
    expect(await conferirSenha("x", HASH_DE_ENCHIMENTO)).toBe(false);
  });
});
