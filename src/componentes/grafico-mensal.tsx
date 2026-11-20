"use client";

import { useEffect, useRef, useState } from "react";
import { nomeDoMes } from "@/lib/datas";
import { formatar, formatarCurto } from "@/lib/dinheiro";
import type { MesDoRelatorio } from "@/lib/relatorio";

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Degraus redondos para o eixo: 1, 2, 2,5 ou 5 vezes uma potência de dez. */
function passoRedondo(maximo: number, linhas: number): number {
  const bruto = maximo / linhas;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  return ([1, 2, 2.5, 5, 10].find((m) => m * potencia >= bruto) ?? 10) * potencia;
}

function rotuloEixo(centavos: number): string {
  const reais = centavos / 100;
  if (reais >= 1000) return `R$ ${(reais / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `R$ ${Math.round(reais)}`;
}

/** Barra só com os cantos de cima arredondados, presa na base. */
function barra(x: number, y: number, largura: number, altura: number, raio: number): string {
  const r = Math.min(raio, largura / 2, altura);
  if (altura <= 0) return "";
  return `M${x},${y + altura} V${y + r} Q${x},${y} ${x + r},${y} H${x + largura - r} Q${x + largura},${y} ${x + largura},${y + r} V${y + altura} Z`;
}

/** Saídas de cada mês em barras; a renda do mês como um traço por cima. */
export function GraficoMensal({ serie, mesAtual }: { serie: MesDoRelatorio[]; mesAtual: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(640);
  const [foco, setFoco] = useState<number | null>(null);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.max(280, Math.round(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const altura = 220;
  const margem = { topo: 12, base: 26, esquerda: 64, direita: 4 };
  const plotW = largura - margem.esquerda - margem.direita;
  const plotH = altura - margem.topo - margem.base;
  const maior = Math.max(1, ...serie.map((m) => Math.max(m.renda, m.saidas)));
  const passo = passoRedondo(maior, 3);
  const topo = Math.ceil(maior / passo) * passo;
  const y = (v: number) => margem.topo + plotH - (v / topo) * plotH;
  const faixa = plotW / serie.length;
  const larguraBarra = Math.max(6, Math.min(30, faixa * 0.46));
  const linhasDeGrade = Array.from({ length: Math.round(topo / passo) + 1 }, (_, i) => i * passo);
  const algumSimulado = serie.some((m) => m.rendaSimulada > 0);
  const focado = foco !== null ? serie[foco] : null;

  return (
    <div ref={caixa} style={{ position: "relative" }}>
      <ul className="legenda" style={{ marginBottom: 12 }}>
        <li><span className="amostra saida" /><span className="rotulo">Saídas</span></li>
        <li><span className="amostra renda" /><span className="rotulo">Renda</span></li>
        {algumSimulado ? (
          <li><span className="amostra renda simulada" /><span className="rotulo">Renda com salário simulado</span></li>
        ) : null}
      </ul>
      <svg
        className="grafico"
        width={largura}
        height={altura}
        role="img"
        aria-label={`Saídas e renda de ${nomeDoMes(serie[0]!.mes)} a ${nomeDoMes(serie[serie.length - 1]!.mes)}. A tabela abaixo traz os valores.`}
      >
        {linhasDeGrade.map((v) => (
          <g key={v}>
            <line className={v === 0 ? "base" : "grade-linha"} x1={margem.esquerda} x2={largura - margem.direita} y1={y(v)} y2={y(v)} />
            <text x={margem.esquerda - 8} y={y(v)} dy="0.32em" textAnchor="end">{rotuloEixo(v)}</text>
          </g>
        ))}
        {serie.map((m, i) => {
          const centro = margem.esquerda + faixa * i + faixa / 2;
          const indiceMes = Number(m.mes.slice(5, 7)) - 1;
          const traco = Math.min(faixa * 0.78, larguraBarra + 18);
          return (
            <g key={m.mes} className={`mes-grupo ${foco !== null && foco !== i ? "apagado" : ""}`} style={{ "--i": i } as React.CSSProperties}>
              <path className="saida" d={barra(centro - larguraBarra / 2, y(m.saidas), larguraBarra, y(0) - y(m.saidas), 4)} />
              {m.renda > 0 ? (
                <line
                  className={`renda ${m.rendaSimulada > 0 ? "simulada" : ""}`}
                  x1={centro - traco / 2}
                  x2={centro + traco / 2}
                  y1={y(m.renda)}
                  y2={y(m.renda)}
                />
              ) : null}
              <text
                x={centro}
                y={altura - 6}
                textAnchor="middle"
                className={m.mes === mesAtual ? "rotulo-atual" : undefined}
              >
                {MESES_CURTOS[indiceMes]}
              </text>
              <rect
                className="alvo"
                x={centro - faixa / 2}
                y={margem.topo}
                width={faixa}
                height={plotH + margem.base}
                tabIndex={0}
                aria-label={`${nomeDoMes(m.mes)}: renda ${formatar(m.renda)}, saídas ${formatar(m.saidas)}, sobra ${formatar(m.sobra)}`}
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
          style={{
            top: 32,
            left: Math.min(
              Math.max(0, margem.esquerda + faixa * foco! + faixa / 2 - 100),
              largura - 200,
            ),
          }}
        >
          <strong>{nomeDoMes(focado.mes)}</strong>
          <div className="entre"><span className="mudo">Renda</span><span className="num">{formatar(focado.renda)}</span></div>
          {focado.rendaSimulada > 0 ? (
            <div className="entre"><span className="mudo">ainda simulado</span><span className="num">{formatar(focado.rendaSimulada)}</span></div>
          ) : null}
          <div className="entre"><span className="mudo">Saídas</span><span className="num">{formatar(focado.saidas)}</span></div>
          <div className="entre">
            <span className="mudo">Sobra</span>
            <span className={`num forte ${focado.sobra < 0 ? "negativo" : ""}`}>{formatarCurto(focado.sobra)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
