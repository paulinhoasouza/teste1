"use client";

import { useEffect, useId, useRef, useState } from "react";
import { nomeDoMes } from "@/lib/datas";
import { formatar, formatarCurto } from "@/lib/dinheiro";
import type { MesDoFluxo } from "@/lib/fluxo";

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Degraus redondos para o eixo: 1, 2, 2,5 ou 5 vezes uma potência de dez. */
function passoRedondo(amplitude: number, linhas: number): number {
  const bruto = Math.max(1, amplitude) / linhas;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  return ([1, 2, 2.5, 5, 10].find((m) => m * potencia >= bruto) ?? 10) * potencia;
}

function rotuloEixo(centavos: number): string {
  const reais = centavos / 100;
  const sinal = reais < 0 ? "-" : "";
  const abs = Math.abs(reais);
  if (abs >= 1000) return `${sinal}R$ ${(abs / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `${sinal}R$ ${Math.round(abs)}`;
}

/** Barra presa na linha do zero, com a ponta (de cima, ou de baixo se negativa) arredondada. */
function barra(x: number, zero: number, ponta: number, largura: number, raio: number): string {
  const altura = Math.abs(ponta - zero);
  if (altura < 0.5) return "";
  const r = Math.min(raio, largura / 2, altura);
  if (ponta < zero) {
    return `M${x},${zero} V${ponta + r} Q${x},${ponta} ${x + r},${ponta} H${x + largura - r} Q${x + largura},${ponta} ${x + largura},${ponta + r} V${zero} Z`;
  }
  return `M${x},${zero} V${ponta - r} Q${x},${ponta} ${x + r},${ponta} H${x + largura - r} Q${x + largura},${ponta} ${x + largura},${ponta - r} V${zero} Z`;
}

/** Quanto vocês terão no fim de cada mês: o que já aconteceu cheio, o que ainda vai acontecer hachurado. */
export function GraficoFluxo({ meses, mesAtual }: { meses: MesDoFluxo[]; mesAtual: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(640);
  const [foco, setFoco] = useState<number | null>(null);
  const id = useId().replace(/:/g, "");

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.max(280, Math.round(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (meses.length === 0) return null;
  const altura = 240;
  const margem = { topo: 22, base: 26, esquerda: 68, direita: 6 };
  const plotW = largura - margem.esquerda - margem.direita;
  const plotH = altura - margem.topo - margem.base;
  const saldos = meses.map((m) => m.saldoFinal);
  const maior = Math.max(0, ...saldos);
  const menor = Math.min(0, ...saldos);
  const passo = passoRedondo(maior - menor, 4);
  const teto = Math.ceil(maior / passo) * passo || passo;
  const piso = Math.floor(menor / passo) * passo;
  const y = (v: number) => margem.topo + ((teto - v) / (teto - piso)) * plotH;
  const faixa = plotW / meses.length;
  const larguraBarra = Math.max(8, Math.min(34, faixa * 0.5));
  const linhas: number[] = [];
  for (let v = piso; v <= teto + 1; v += passo) linhas.push(v);
  const algumPrevisto = meses.some((m) => m.situacao !== "passado");
  const algumNegativo = menor < 0;
  const focado = foco !== null ? meses[foco] : null;
  // Rótulos diretos só onde importa: o mês atual e o último.
  const rotulados = new Set([meses.findIndex((m) => m.mes === mesAtual), meses.length - 1]);

  return (
    <div ref={caixa} style={{ position: "relative" }}>
      <ul className="legenda" style={{ marginBottom: 12 }}>
        <li><span className="amostra fluxo-pos" /><span className="rotulo">Sobrando</span></li>
        {algumNegativo ? <li><span className="amostra fluxo-neg" /><span className="rotulo">Faltando</span></li> : null}
        {algumPrevisto ? <li><span className="amostra fluxo-previsto" /><span className="rotulo">Previsto, ainda vai acontecer</span></li> : null}
      </ul>
      <svg
        className="grafico"
        width={largura}
        height={altura}
        role="img"
        aria-label={`Saldo no fim de cada mês, de ${nomeDoMes(meses[0]!.mes)} a ${nomeDoMes(meses[meses.length - 1]!.mes)}. A tabela abaixo traz os valores.`}
      >
        <defs>
          {(["pos", "neg"] as const).map((t) => (
            <pattern key={t} id={`${id}-${t}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" className={`hachura-fundo fluxo-${t}`} />
              <line x1="0" y1="0" x2="0" y2="6" className={`hachura-traco fluxo-${t}`} />
            </pattern>
          ))}
        </defs>
        {linhas.map((v) => (
          <g key={v}>
            <line className={v === 0 ? "base" : "grade-linha"} x1={margem.esquerda} x2={largura - margem.direita} y1={y(v)} y2={y(v)} />
            <text x={margem.esquerda - 8} y={y(v)} dy="0.32em" textAnchor="end">{rotuloEixo(v)}</text>
          </g>
        ))}
        {meses.map((m, i) => {
          const centro = margem.esquerda + faixa * i + faixa / 2;
          const tipo = m.saldoFinal < 0 ? "neg" : "pos";
          const previsto = m.situacao !== "passado";
          const ponta = y(m.saldoFinal);
          const indiceMes = Number(m.mes.slice(5, 7)) - 1;
          return (
            <g key={m.mes} className={`mes-grupo ${foco !== null && foco !== i ? "apagado" : ""}`} style={{ "--i": i } as React.CSSProperties}>
              <path
                className={`barra-fluxo fluxo-${tipo} ${previsto ? "previsto" : ""}`}
                d={barra(centro - larguraBarra / 2, y(0), ponta, larguraBarra, 4)}
                fill={previsto ? `url(#${id}-${tipo})` : undefined}
              />
              {rotulados.has(i) ? (
                <text
                  className="rotulo-valor"
                  x={centro}
                  y={m.saldoFinal < 0 ? ponta + 14 : ponta - 6}
                  textAnchor="middle"
                >
                  {formatarCurto(m.saldoFinal)}
                </text>
              ) : null}
              <text x={centro} y={altura - 6} textAnchor="middle" className={m.mes === mesAtual ? "rotulo-atual" : undefined}>
                {MESES_CURTOS[indiceMes]}
                {indiceMes === 0 || i === 0 ? ` ${m.mes.slice(2, 4)}` : ""}
              </text>
              <rect
                className="alvo"
                x={centro - faixa / 2}
                y={margem.topo}
                width={faixa}
                height={plotH + margem.base}
                tabIndex={0}
                aria-label={`${nomeDoMes(m.mes)}: começa com ${formatar(m.saldoInicial)}, entra ${formatar(m.entradas)}, sai ${formatar(m.saidas)}, termina com ${formatar(m.saldoFinal)}${previsto ? ", previsto" : ""}`}
                onPointerEnter={() => setFoco(i)}
                onPointerLeave={() => setFoco(null)}
                onFocus={() => setFoco(i)}
                onBlur={() => setFoco(null)}
              />
            </g>
          );
        })}
      </svg>
      {focado ? (
        <div
          className="grafico-dica"
          role="status"
          style={{ top: 34, left: Math.min(Math.max(0, margem.esquerda + faixa * foco! + faixa / 2 - 105), largura - 210) }}
        >
          <strong>
            {nomeDoMes(focado.mes)}
            {focado.situacao === "futuro" ? " · previsto" : focado.situacao === "atual" ? " · em andamento" : ""}
          </strong>
          <div className="entre"><span className="mudo">Começa com</span><span className="num">{formatar(focado.saldoInicial)}</span></div>
          <div className="entre"><span className="mudo">Entra</span><span className="num">+{formatar(focado.entradas)}</span></div>
          {focado.simulado > 0 ? (
            <div className="entre"><span className="mudo">salário simulado</span><span className="num">{formatar(focado.simulado)}</span></div>
          ) : null}
          <div className="entre"><span className="mudo">Sai</span><span className="num">−{formatar(focado.saidas)}</span></div>
          <div className="entre">
            <span className="mudo">Termina com</span>
            <span className={`num forte ${focado.saldoFinal < 0 ? "negativo" : ""}`}>{formatar(focado.saldoFinal)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
