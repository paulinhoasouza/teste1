/** Aparência do app: segue o sistema, ou fica sempre clara ou sempre escura. */
export type Preferencia = "auto" | "claro" | "escuro";

const COOKIE = "tema";
const COR_DA_BARRA = { claro: "#f5f5f7", escuro: "#000000" } as const;

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

/**
 * Roda no <head>, antes da primeira pintura, para não piscar o tema errado.
 * Precisa ser autocontido: vira texto dentro de uma tag <script>.
 */
export const SCRIPT_DE_TEMA = `(function(){try{var m=document.cookie.match(/(?:^|; )tema=(auto|claro|escuro)/);var p=m?m[1]:"auto";var e=p==="escuro"||(p!=="claro"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.dataset.tema=e?"escuro":"claro";r.dataset.preferencia=p;var c=document.querySelector('meta[name="theme-color"]');if(c)c.setAttribute("content",e?"#000000":"#f5f5f7");}catch(_){}})();`;
