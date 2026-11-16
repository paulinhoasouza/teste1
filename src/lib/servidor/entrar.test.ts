import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Linha = Record<string, unknown>;

/** Só a tabela de usuários, como a API de dados a serve. */
class UsuariosFalsos {
  linhas: Linha[] = [];
  responder = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const u = new URL(String(url));
    const email = (u.searchParams.get("email") ?? "").replace("eq.", "");
    const achados = this.linhas.filter((l) => l.email === email);
    if ((init?.method ?? "GET") === "GET") return new Response(JSON.stringify(achados));
    for (const l of achados) Object.assign(l, JSON.parse(String(init?.body)));
    return new Response(null, { status: 204 });
  };
}

const pedido = (corpo: unknown) =>
  new Request("http://app.local/api/entrar", { method: "POST", body: JSON.stringify(corpo) });

describe("entrar", () => {
  let banco: UsuariosFalsos;
  beforeEach(async () => {
    vi.stubEnv("SUPABASE_URL", "https://projeto.supabase.co");
    vi.stubEnv("SUPABASE_KEY", "sb_publishable_x");
    vi.stubEnv("BANCO_SEGREDO", "segredo-de-teste");
    banco = new UsuariosFalsos();
    vi.stubGlobal("fetch", banco.responder);
    const { gerarHash } = await import("./senha");
    banco.linhas.push({ email: "ana@exemplo.com", pessoa: "b", senha_hash: await gerarHash("senha-da-ana"), falhas: 0, bloqueado_ate: null });
  });

  it("entra com e-mail e senha certos e recebe a sessão da pessoa", async () => {
    const { POST } = await import("@/app/api/entrar/route");
    const { lerSessao } = await import("./sessao");
    const r = await POST(pedido({ email: "  Ana@Exemplo.com ", senha: "senha-da-ana" }));
    expect(r.status).toBe(200);
    const cookie = r.cookies.get("sessao");
    expect(cookie?.httpOnly).toBe(true);
    expect(await lerSessao(cookie?.value)).toBe("b");
  });

  it("recusa senha errada e e-mail desconhecido com a mesma resposta, sem sessão", async () => {
    const { POST } = await import("@/app/api/entrar/route");
    const errada = await POST(pedido({ email: "ana@exemplo.com", senha: "outra" }));
    const ninguem = await POST(pedido({ email: "ninguem@exemplo.com", senha: "senha-da-ana" }));
    expect([errada.status, ninguem.status]).toEqual([401, 401]);
    expect(await errada.json()).toEqual(await ninguem.json());
    expect(errada.cookies.get("sessao")).toBeUndefined();
    expect(banco.linhas[0]!.falhas).toBe(1);
  });

  it("bloqueia depois de cinco erros seguidos, mesmo para a senha certa", async () => {
    const { POST } = await import("@/app/api/entrar/route");
    for (let i = 0; i < 5; i++) await POST(pedido({ email: "ana@exemplo.com", senha: "chute" }));
    expect(banco.linhas[0]!.bloqueado_ate).toBeTruthy();
    const r = await POST(pedido({ email: "ana@exemplo.com", senha: "senha-da-ana" }));
    expect(r.status).toBe(429);
    expect((await r.json()).erro).toMatch(/15 minutos/);
  });

  it("entrar com sucesso zera a contagem de erros", async () => {
    const { POST } = await import("@/app/api/entrar/route");
    await POST(pedido({ email: "ana@exemplo.com", senha: "chute" }));
    await POST(pedido({ email: "ana@exemplo.com", senha: "senha-da-ana" }));
    expect(banco.linhas[0]!.falhas).toBe(0);
  });

  it("sessão forjada ou de outro segredo não vale", async () => {
    const { criarSessao, lerSessao } = await import("./sessao");
    const boa = await criarSessao("a");
    expect(await lerSessao(boa)).toBe("a");
    expect(await lerSessao(`${boa}x`)).toBeNull();
    vi.stubEnv("BANCO_SEGREDO", "outro-segredo");
    expect(await lerSessao(boa)).toBeNull();
  });
});
