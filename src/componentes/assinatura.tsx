"use client";

/** Cores de ícone de app: identidade, não dado. */
const CORES_DE_ICONE = ["#0071e3", "#248a3d", "#d70015", "#8944ab", "#c93400", "#0a7b83", "#636366", "#b8005c"];

function corDoNome(nome: string): string {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CORES_DE_ICONE[h % CORES_DE_ICONE.length]!;
}

function iniciais(nome: string): string {
  const partes = nome.replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/);
  const duas = partes.length > 1 ? `${partes[0]![0]}${partes[1]![0]}` : (partes[0] ?? "?").slice(0, 2);
  return duas.toUpperCase();
}

export function IconeAssinatura({ nome }: { nome: string }) {
  return (
    <span className="marca-assin" style={{ background: corDoNome(nome) }} aria-hidden="true">
      {iniciais(nome)}
    </span>
  );
}
