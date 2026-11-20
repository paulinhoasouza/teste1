/** Aparência do app: segue o sistema, ou fica sempre clara ou sempre escura. */
export type Preferencia = "auto" | "claro" | "escuro";

const COOKIE = "tema";
const COR_DA_BARRA = { claro: "#efe8df", escuro: "#0c0907" } as const;

export function lerPreferencia(): Preferencia {
  const m = /(?:^|; )tema=(auto|claro|escuro)/.exec(document.cookie);
  return (m?.[1] as Preferencia) ?? "auto";
}

function resolver(p: Preferencia): "claro" | "escuro" {
  if (p !== "auto") return p;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
}

/** Aplica no <html> e na barra do navegador; com transição suave quando vem de um toque. */
export function aplicarTema(p: Preferencia, suave = false): void {
  const raiz = document.documentElement;
  const tema = resolver(p);
  if (suave && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    raiz.classList.add("trocando-tema");
    window.setTimeout(() => raiz.classList.remove("trocando-tema"), 450);
  }
  raiz.dataset.tema = tema;
  raiz.dataset.preferencia = p;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", COR_DA_BARRA[tema]);
}

export function salvarPreferencia(p: Preferencia): void {
  document.cookie = `${COOKIE}=${p}; path=/; max-age=31536000; samesite=lax`;
  aplicarTema(p, true);
}

/** Quanto o vidro é fosco: 0 deixa ver o fundo, 100 quase não deixa. */
export const VIDRO_PADRAO = 55;

export function lerVidro(): number {
  const m = /(?:^|; )vidro=(\d{1,3})/.exec(document.cookie);
  const v = m ? Number(m[1]) : VIDRO_PADRAO;
  return Math.min(100, Math.max(0, v));
}

export function aplicarVidro(v: number): void {
  document.documentElement.style.setProperty("--vidro-k", String(v / 100));
}

export function salvarVidro(v: number): void {
  document.cookie = `vidro=${Math.round(v)}; path=/; max-age=31536000; samesite=lax`;
  aplicarVidro(v);
}

/**
 * Roda no <head>, antes da primeira pintura, para não piscar o tema errado.
 * Precisa ser autocontido: vira texto dentro de uma tag <script>.
 */
export const SCRIPT_DE_TEMA = `(function(){try{var m=document.cookie.match(/(?:^|; )tema=(auto|claro|escuro)/);var p=m?m[1]:"auto";var e=p==="escuro"||(p!=="claro"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.dataset.tema=e?"escuro":"claro";r.dataset.preferencia=p;var c=document.querySelector('meta[name="theme-color"]');if(c)c.setAttribute("content",e?"#0c0907":"#efe8df");var v=document.cookie.match(/(?:^|; )vidro=(\\d{1,3})/);if(v)r.style.setProperty("--vidro-k",String(Math.min(100,Number(v[1]))/100));}catch(_){}})();`;
