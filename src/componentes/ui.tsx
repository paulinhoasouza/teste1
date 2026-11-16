"use client";

import type { ReactNode } from "react";
import { formatar, partesBRL } from "@/lib/dinheiro";
import type { Dono, PessoaId } from "@/lib/tipos";

/** Dois círculos que se sobrepõem: cada pessoa e o que é dos dois. */
export function Marca({ tamanho = 28 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="72 132 368 248" aria-hidden="true">
      <circle cx="196" cy="256" r="124" fill="var(--a)" />
      <circle cx="316" cy="256" r="124" fill="var(--b)" />
      <path d="M256 147.5a124 124 0 0 1 0 217 124 124 0 0 1 0-217z" fill="var(--text)" />
    </svg>
  );
}

export function Avatar({
  pessoa,
  nome,
  tamanho,
}: {
  pessoa: PessoaId;
  nome: string;
  tamanho?: "p" | "m";
}) {
  return (
    <span className={`avatar av-${pessoa} ${tamanho ?? ""}`} aria-hidden="true">
      {(nome.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

/** Marca de quem é um lançamento: uma pessoa, ou os dois sobrepostos. */
export function MarcaDono({ dono, nomes }: { dono: Dono; nomes: Record<PessoaId, string> }) {
  if (dono !== "casal") return <Avatar pessoa={dono} nome={nomes[dono]} />;
  return (
    <span className="dupla" aria-hidden="true">
      <span className="av-a" />
      <span className="av-b" />
    </span>
  );
}

/** Valor com os centavos menores, para os números grandes. */
export function Valor({ centavos, className = "" }: { centavos: number; className?: string }) {
  const p = partesBRL(centavos);
  return (
    <span className={`num ${className}`} aria-label={formatar(centavos)}>
      <span aria-hidden="true">
        {p.sinal}R$ {p.inteiro}
        <span className="cent">,{p.centavos}</span>
      </span>
    </span>
  );
}

export interface Segmento {
  classe: string;
  valor: number;
}

/** Barra de comprimento fixo; cada segmento ocupa a sua fração do total. */
export function Trilho({
  segmentos,
  total,
  fino,
  rotulo,
}: {
  segmentos: Segmento[];
  total: number;
  fino?: boolean;
  rotulo: string;
}) {
  const base = Math.max(total, segmentos.reduce((s, x) => s + Math.max(0, x.valor), 0), 1);
  return (
    <div className={`trilho ${fino ? "fino" : ""}`} role="img" aria-label={rotulo}>
      {segmentos
        .filter((s) => s.valor > 0)
        .map((s, i) => (
          <span key={i} className={s.classe} style={{ width: `${(s.valor / base) * 100}%` }} />
        ))}
    </div>
  );
}

export function Segmentado<T extends string>({
  valor,
  opcoes,
  aoMudar,
  rotulo,
  largo,
}: {
  valor: T;
  opcoes: { valor: T; rotulo: string }[];
  aoMudar: (v: T) => void;
  rotulo: string;
  largo?: boolean;
}) {
  return (
    <div className={`segmentado ${largo ? "largo" : ""}`} role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button key={o.valor} type="button" aria-pressed={o.valor === valor} onClick={() => aoMudar(o.valor)}>
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

export function Cartao({
  titulo,
  acao,
  sub,
  className = "",
  children,
}: {
  titulo: string;
  acao?: ReactNode;
  sub?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`cartao ${className}`}>
      <div className="cartao-topo">
        <h2>{titulo}</h2>
        {acao}
      </div>
      {sub ? <p className="cartao-sub">{sub}</p> : null}
      {children}
    </section>
  );
}
