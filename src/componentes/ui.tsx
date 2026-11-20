"use client";

import { animate } from "motion";
import { useEffect, useRef } from "react";

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

/**
 * Valor com os centavos menores, para os números grandes.
 * Quando o valor muda (outro mês, outra pessoa), os dígitos rolam até o novo número com uma mola.
 */
export function Valor({ centavos, className = "" }: { centavos: number; className?: string }) {
  const inteiro = useRef<HTMLSpanElement>(null);
  const cent = useRef<HTMLSpanElement>(null);
  const anterior = useRef(centavos);
  const p = partesBRL(centavos);

  useEffect(() => {
    const de = anterior.current;
    anterior.current = centavos;
    if (de === centavos || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const escrever = (v: number) => {
      const q = partesBRL(Math.round(v));
      if (inteiro.current) inteiro.current.textContent = `${q.sinal}R$ ${q.inteiro}`;
      if (cent.current) cent.current.textContent = `,${q.centavos}`;
    };
    const controle = animate(de, centavos, { type: "spring", bounce: 0, duration: 0.7, onUpdate: escrever });
    return () => {
      controle.stop();
      escrever(centavos);
    };
  }, [centavos]);

  return (
    <span className={`num ${className}`} aria-label={formatar(centavos)}>
      <span aria-hidden="true">
        <span ref={inteiro}>{p.sinal}R$ {p.inteiro}</span>
        <span className="cent" ref={cent}>,{p.centavos}</span>
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
  const indice = Math.max(0, opcoes.findIndex((o) => o.valor === valor));
  return (
    <div className={`segmentado ${largo ? "largo" : ""}`} role="group" aria-label={rotulo}>
      {/* As opções têm a mesma largura: o polegar anda uma largura inteira por opção. */}
      <span
        className="segmentado-polegar"
        aria-hidden="true"
        style={{ width: `calc((100% - 4px) / ${opcoes.length})`, transform: `translateX(calc(2px + ${indice * 100}%))` }}
      />
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
