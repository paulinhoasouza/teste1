"use client";

import { animate, type AnimationPlaybackControls } from "motion";
import { useEffect, useLayoutEffect, useRef } from "react";

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

/** power3.out: a borda da frente sai rápido e assenta suave. */
const SAIDA: [number, number, number, number] = [0.215, 0.61, 0.355, 1];

interface Bordas {
  l: number;
  r: number;
}

/**
 * Pílula que estica até o item ativo: a borda da frente corre na direção do movimento,
 * a de trás sai um instante depois e alcança. Parece uma gota de vidro escorrendo.
 * O item ativo é o filho que casa com `seletor`; a caixa precisa de position: relative.
 */
export function usePilula<C extends HTMLElement>(
  chave: unknown,
  seletor = '[aria-current="page"], [aria-pressed="true"]',
) {
  const caixa = useRef<C>(null);
  const pilula = useRef<HTMLSpanElement>(null);
  const antes = useRef<Bordas | null>(null);
  const emCurso = useRef<AnimationPlaybackControls[]>([]);

  useLayoutEffect(() => {
    const c = caixa.current;
    const p = pilula.current;
    if (!c || !p) return;
    const alvo = () => c.querySelector<HTMLElement>(seletor);
    const medir = (a: HTMLElement): Bordas & { t: number; b: number } => ({
      l: a.offsetLeft,
      r: c.clientWidth - a.offsetLeft - a.offsetWidth,
      t: a.offsetTop,
      b: c.clientHeight - a.offsetTop - a.offsetHeight,
    });
    const pousar = (m: Bordas & { t: number; b: number }) => {
      Object.assign(p.style, { left: `${m.l}px`, right: `${m.r}px`, top: `${m.t}px`, bottom: `${m.b}px` });
      antes.current = { l: m.l, r: m.r };
    };

    emCurso.current.forEach((a) => a.stop());
    emCurso.current = [];
    const a = alvo();
    if (!a) {
      p.style.opacity = "0";
      return;
    }
    const para = medir(a);
    const de = antes.current;
    const calma = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    p.style.opacity = "1";
    if (!de || calma || (de.l === para.l && de.r === para.r)) {
      pousar(para);
    } else {
      p.style.top = `${para.t}px`;
      p.style.bottom = `${para.b}px`;
      const indoParaDireita = para.l > de.l;
      const frente = indoParaDireita ? "right" : "left";
      const tras = indoParaDireita ? "left" : "right";
      const valor = (lado: "left" | "right") => `${lado === "left" ? para.l : para.r}px`;
      emCurso.current = [
        animate(p, { [frente]: valor(frente) }, { duration: 0.36, ease: SAIDA }),
        animate(p, { [tras]: valor(tras) }, { duration: 0.52, delay: 0.07, ease: [0.22, 1, 0.36, 1] }),
      ];
      antes.current = { l: para.l, r: para.r };
    }

    // Mudou o tamanho da caixa (janela, fonte): reposiciona sem animar.
    let largura = c.clientWidth;
    const obs = new ResizeObserver(() => {
      if (c.clientWidth === largura) return;
      largura = c.clientWidth;
      const agora = alvo();
      if (agora) pousar(medir(agora));
    });
    obs.observe(c);
    return () => obs.disconnect();
  }, [chave, seletor]);

  return { caixa, pilula };
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
  const { caixa, pilula } = usePilula<HTMLDivElement>(valor);
  return (
    <div ref={caixa} className={`segmentado ${largo ? "largo" : ""}`} role="group" aria-label={rotulo}>
      <span ref={pilula} className="segmentado-polegar" aria-hidden="true" />
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
