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
  id,
}: {
  valor: number;
  aoMudar: (centavos: number) => void;
  rotulo: string;
  grande?: boolean;
  autoFoco?: boolean;
  id?: string;
}) {
  const proprio = useId();
  const ref = useRef<HTMLInputElement>(null);
  // Dentro de um diálogo o atributo autofocus chega antes de ele abrir; foca depois.
  useEffect(() => {
    if (autoFoco) ref.current?.focus();
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
      onChange={(e) => {
        // Vale o que foi digitado, não onde o cursor estava: cada dígito entra pela direita.
        const ev = e.nativeEvent as InputEvent;
        const digitado = ev.data?.replace(/\D/g, "") ?? "";
        if (ev.inputType === "insertText" && digitado) {
          aoMudar(centavosDeDigitos(`${valor}${digitado}`));
        } else if (ev.inputType === "deleteContentBackward" || ev.inputType === "deleteContentForward") {
          aoMudar(Math.floor(valor / 10));
        } else {
          aoMudar(centavosDeDigitos(e.target.value));
        }
      }}
      onFocus={(e) => {
        const el = e.currentTarget;
        const fim = () => el.setSelectionRange(el.value.length, el.value.length);
        fim();
        requestAnimationFrame(fim);
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
