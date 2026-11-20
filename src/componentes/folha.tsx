"use client";

import { animate } from "motion";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Folha modal no jeito do iOS. No telefone sobe de baixo e pode ser arrastada para fechar;
 * no computador surge no centro. Toda animação é uma mola que parte do valor que está na tela,
 * então pode ser interrompida a qualquer momento.
 */

type Controle = ReturnType<typeof animate>;

const ehTelefone = () => window.matchMedia("(max-width: 640px)").matches;
const semMovimento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Onde o gesto pararia sozinho, como a desaceleração da rolagem do iOS. */
function projetar(velocidade: number, desaceleracao = 0.998): number {
  return ((velocidade / 1000) * desaceleracao) / (1 - desaceleracao);
}

/** Resistência progressiva além do limite, em vez de parar seco. */
function elastico(excesso: number, dimensao: number, constante = 0.55): number {
  return (excesso * dimensao * constante) / (dimensao + constante * Math.abs(excesso));
}

/** Folga, em px, que a folha anda no computador ao surgir. */
const CURSO_DESKTOP = 24;

export function Folha({
  aberta,
  aoFechar,
  rotuloId,
  children,
}: {
  aberta: boolean;
  aoFechar: () => void;
  /** id do título, para o leitor de tela anunciar a folha. */
  rotuloId: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [montada, setMontada] = useState(aberta);
  // Durante a saída, o conteúdo continua o último que estava aberto.
  const conteudo = useRef<ReactNode>(null);
  if (aberta) conteudo.current = children;

  const posicao = useRef(0);
  const curso = useRef(1);
  const telefone = useRef(false);
  const animacao = useRef<Controle | null>(null);
  const velocidadeDeSaida = useRef(0);
  const arrasto = useRef<{ id: number; inicio: number; base: number; pontos: { y: number; t: number }[] } | null>(null);
  // Depois de arrastar, o navegador dispara um clique no próprio diálogo; não é um toque no fundo.
  const acabouDeArrastar = useRef(false);

  /** Desenha a folha na posição: 0 = aberta, curso = fora. */
  const aplicar = (y: number) => {
    const d = ref.current;
    if (!d) return;
    posicao.current = y;
    const progresso = Math.min(1, Math.max(0, 1 - y / curso.current));
    d.style.setProperty("--progresso", String(progresso));
    if (semMovimento()) {
      d.style.opacity = String(progresso);
      d.style.transform = "";
    } else if (telefone.current) {
      d.style.opacity = "";
      d.style.transform = `translate3d(0, ${y}px, 0)`;
    } else {
      d.style.opacity = String(progresso);
      d.style.transform = `translate3d(0, ${Math.max(0, y)}px, 0) scale(${0.96 + 0.04 * progresso})`;
    }
  };

  const molaPara = (alvo: number, velocidade: number, quique: number, aoTerminar?: () => void) => {
    animacao.current?.stop();
    if (semMovimento()) {
      animacao.current = animate(posicao.current, alvo, { duration: 0.18, ease: "linear", onUpdate: aplicar, onComplete: aoTerminar });
      return;
    }
    animacao.current = animate(posicao.current, alvo, {
      type: "spring",
      velocity: velocidade,
      bounce: quique,
      duration: 0.42,
      onUpdate: aplicar,
      onComplete: aoTerminar,
    });
  };

  useEffect(() => {
    if (aberta) setMontada(true);
  }, [aberta]);

  useLayoutEffect(() => {
    const d = ref.current;
    if (!d || !montada) return;
    if (aberta && !d.open) {
      telefone.current = ehTelefone();
      d.showModal();
      curso.current = telefone.current ? d.offsetHeight : CURSO_DESKTOP;
      aplicar(curso.current);
      molaPara(0, 0, 0);
    } else if (!aberta && d.open) {
      const v = velocidadeDeSaida.current;
      velocidadeDeSaida.current = 0;
      // A saída segue o mesmo caminho da entrada; com o embalo do dedo, se houver.
      molaPara(curso.current, v, 0, () => {
        d.close();
        d.style.transform = "";
        d.style.opacity = "";
        setMontada(false);
        conteudo.current = null;
      });
    }
  }, [aberta, montada]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => animacao.current?.stop(), []);

  const pegar = (e: React.PointerEvent<HTMLDialogElement>) => {
    if (!telefone.current || semMovimento() || e.button !== 0) return;
    const alvo = e.target as HTMLElement;
    if (!alvo.closest(".folha-alca, .folha-topo") || alvo.closest("button, a, input, select, textarea")) return;
    animacao.current?.stop();
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasto.current = { id: e.pointerId, inicio: e.clientY, base: posicao.current, pontos: [{ y: e.clientY, t: e.timeStamp }] };
  };

  const mover = (e: React.PointerEvent<HTMLDialogElement>) => {
    const a = arrasto.current;
    if (!a || a.id !== e.pointerId) return;
    const bruto = a.base + (e.clientY - a.inicio);
    // Para cima, além de aberta, resiste; para baixo, segue o dedo 1:1.
    aplicar(bruto >= 0 ? bruto : -elastico(-bruto, curso.current));
    a.pontos.push({ y: e.clientY, t: e.timeStamp });
    while (a.pontos.length > 2 && e.timeStamp - a.pontos[0]!.t > 100) a.pontos.shift();
  };

  const soltar = (e: React.PointerEvent<HTMLDialogElement>) => {
    const a = arrasto.current;
    if (!a || a.id !== e.pointerId) return;
    arrasto.current = null;
    acabouDeArrastar.current = true;
    setTimeout(() => (acabouDeArrastar.current = false), 0);
    const primeiro = a.pontos[0]!;
    const ultimo = a.pontos[a.pontos.length - 1]!;
    const dt = (ultimo.t - primeiro.t) / 1000;
    const velocidade = dt > 0 ? (ultimo.y - primeiro.y) / dt : 0;
    const destino = posicao.current + projetar(velocidade);
    if (destino > curso.current * 0.5) {
      velocidadeDeSaida.current = velocidade;
      aoFechar();
    } else {
      // Voltou: um pouco de quique, porque o gesto trouxe embalo.
      molaPara(0, velocidade, posicao.current > 0 ? 0.18 : 0);
    }
  };

  if (!montada) return null;

  return (
    <dialog
      ref={ref}
      className="folha"
      aria-labelledby={rotuloId}
      onCancel={(e) => {
        e.preventDefault();
        aoFechar();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !acabouDeArrastar.current) aoFechar();
      }}
      onPointerDown={pegar}
      onPointerMove={mover}
      onPointerUp={soltar}
      onPointerCancel={soltar}
    >
      <div className="folha-alca" aria-hidden="true" />
      {conteudo.current}
    </dialog>
  );
}
