"use client";

import { useEffect, useId, useRef, useState } from "react";
import { centavosDeDigitos, partesBRL } from "@/lib/dinheiro";
import type { Dono, PessoaId } from "@/lib/tipos";
import { Avatar } from "./ui";

/** Valor digitado como em app de banco: os dígitos entram pelos centavos. */
export function CampoValor({
  valor,
  aoMudar,
  rotulo,
  grande,
  autoFoco,
  selecionarAoFocar,
  id,
}: {
  valor: number;
  aoMudar: (centavos: number) => void;
  rotulo: string;
  grande?: boolean;
  autoFoco?: boolean;
  /** Seleciona o valor inteiro ao focar, para a pessoa digitar o novo por cima. */
  selecionarAoFocar?: boolean;
  id?: string;
}) {
  const proprio = useId();
  const ref = useRef<HTMLInputElement>(null);
  const tudoSelecionado = useRef(false);
  // Dentro de um diálogo, abrir a janela move o foco para o primeiro botão; foca depois disso.
  useEffect(() => {
    if (!autoFoco) return;
    const quadro = requestAnimationFrame(() => ref.current?.focus());
    return () => cancelAnimationFrame(quadro);
  }, [autoFoco]);
  const p = partesBRL(valor);
  const texto = `${p.inteiro},${p.centavos}`;
  const entrada = (
    <input
      id={id ?? proprio}
      className={grande ? undefined : "entrada num"}
      inputMode="numeric"
      autoComplete="off"
      ref={ref}
      aria-label={grande ? `${rotulo}, em reais` : undefined}
      value={grande ? texto : `R$ ${texto}`}
      onSelect={(e) => {
        const el = e.currentTarget;
        tudoSelecionado.current = el.value.length > 0 && el.selectionStart === 0 && el.selectionEnd === el.value.length;
      }}
      onChange={(e) => {
        const ev = e.nativeEvent as InputEvent;
        const digitado = ev.data?.replace(/\D/g, "") ?? "";
        if (tudoSelecionado.current) {
          // Texto inteiro selecionado e digitado por cima: vale só o que foi digitado.
          aoMudar(centavosDeDigitos(e.target.value));
        } else if (ev.inputType === "insertText" && digitado) {
          // Vale o que foi digitado, não onde o cursor estava: cada dígito entra pela direita.
          aoMudar(centavosDeDigitos(`${valor}${digitado}`));
        } else if (ev.inputType === "deleteContentBackward" || ev.inputType === "deleteContentForward") {
          aoMudar(Math.floor(valor / 10));
        } else {
          aoMudar(centavosDeDigitos(e.target.value));
        }
        tudoSelecionado.current = false;
      }}
      onFocus={(e) => {
        const el = e.currentTarget;
        // Para trocar um valor sugerido, tudo já vem selecionado; senão o cursor vai para o fim.
        const posicionar = () =>
          selecionarAoFocar ? el.setSelectionRange(0, el.value.length) : el.setSelectionRange(el.value.length, el.value.length);
        posicionar();
        requestAnimationFrame(posicionar);
      }}
    />
  );
  if (!grande) return entrada;
  return (
    <div className="valor-grande">
      <span aria-hidden="true">R$</span>
      {entrada}
    </div>
  );
}

export function EscolhaPessoa({
  valor,
  aoMudar,
  nomes,
  rotulo,
}: {
  valor: PessoaId;
  aoMudar: (p: PessoaId) => void;
  nomes: Record<PessoaId, string>;
  rotulo: string;
}) {
  return (
    <div className="campo">
      <span className="rotulo-campo" id={`${rotulo}-r`}>{rotulo}</span>
      <div className="fichas" role="group" aria-label={rotulo}>
        {(["a", "b"] as const).map((p) => (
          <button key={p} type="button" className="ficha com-avatar" aria-pressed={valor === p} onClick={() => aoMudar(p)}>
            <Avatar pessoa={p} nome={nomes[p]} tamanho="p" />
            {nomes[p]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function EscolhaDono({
  valor,
  aoMudar,
  parteA,
  aoMudarParte,
  nomes,
  rotulo,
}: {
  valor: Dono;
  aoMudar: (d: Dono) => void;
  parteA: number;
  aoMudarParte: (n: number) => void;
  nomes: Record<PessoaId, string>;
  rotulo: string;
}) {
  const [ajustando, setAjustando] = useState(false);
  const idFaixa = useId();
  return (
    <div className="campo">
      <span className="rotulo-campo">{rotulo}</span>
      <div className="fichas" role="group" aria-label={rotulo}>
        <button type="button" className="ficha" aria-pressed={valor === "casal"} onClick={() => aoMudar("casal")}>
          Nosso
        </button>
        {(["a", "b"] as const).map((p) => (
          <button key={p} type="button" className="ficha com-avatar" aria-pressed={valor === p} onClick={() => aoMudar(p)}>
            <Avatar pessoa={p} nome={nomes[p]} tamanho="p" />
            Só {nomes[p]}
          </button>
        ))}
      </div>
      {valor === "casal" ? (
        <>
          <div className="entre">
            <span className="campo-dica">
              {nomes.a} {parteA}%, {nomes.b} {100 - parteA}%
            </span>
            <button type="button" className="ligacao" style={{ background: "none", border: 0, padding: 0 }} aria-expanded={ajustando} onClick={() => setAjustando((v) => !v)}>
              {ajustando ? "Pronto" : "Mudar divisão"}
            </button>
          </div>
          {ajustando ? (
            <>
              <label className="so-leitor" htmlFor={idFaixa}>Parte de {nomes.a}, em porcentagem</label>
              <input
                id={idFaixa}
                type="range"
                min={0}
                max={100}
                step={5}
                value={parteA}
                onChange={(e) => aoMudarParte(Number(e.target.value))}
                style={{ width: "100%", accentColor: "var(--text)" }}
              />
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

const NOMES_DOS_MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Mês e ano em dois seletores; o valor é "yyyy-mm", ou vazio quando não há data. */
export function CampoMes({
  valor,
  aoMudar,
  rotulo,
  semData,
  referencia,
}: {
  valor: string;
  aoMudar: (mes: string) => void;
  rotulo: string;
  /** Texto da opção sem data, como "Sem término". */
  semData: string;
  /** Mês de hoje (yyyy-mm): escolher só o mês leva à próxima vez que ele acontece. */
  referencia: string;
}) {
  const id = useId();
  const anoAtual = Number(referencia.slice(0, 4));
  const mesAtual = Number(referencia.slice(5, 7));
  const ano = valor ? Number(valor.slice(0, 4)) : anoAtual;
  const mes = valor ? Number(valor.slice(5, 7)) : 0;
  const anos = Array.from({ length: 13 }, (_, i) => anoAtual - 2 + i);
  if (!anos.includes(ano)) anos.unshift(ano);
  const montar = (m: number, a: number) => (m ? `${a}-${String(m).padStart(2, "0")}` : "");
  const escolherMes = (m: number) => {
    if (!m) return aoMudar("");
    // Sem data antes, o ano vem da próxima ocorrência do mês; com data, mantém o ano escolhido.
    aoMudar(montar(m, valor ? ano : m >= mesAtual ? anoAtual : anoAtual + 1));
  };
  return (
    <div className="campo">
      <label htmlFor={`${id}-mes`}>{rotulo}</label>
      <div className="mes-ano">
        <select id={`${id}-mes`} className="selecao" value={mes} onChange={(e) => escolherMes(Number(e.target.value))}>
          <option value={0}>{semData}</option>
          {NOMES_DOS_MESES.map((nome, i) => (
            <option key={nome} value={i + 1}>{nome}</option>
          ))}
        </select>
        <select
          className="selecao"
          aria-label={`${rotulo}, ano`}
          value={ano}
          disabled={!mes}
          onChange={(e) => aoMudar(montar(mes, Number(e.target.value)))}
        >
          {anos.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
