"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { aplicarTema, lerPreferencia, salvarPreferencia, type Preferencia } from "@/lib/tema";
import { Segmentado } from "./ui";

/** Preferência de tema guardada no aparelho, e o modo automático acompanhando o sistema. */
export function useTema(): [Preferencia, (p: Preferencia) => void] {
  const [pref, setPref] = useState<Preferencia>("auto");

  useEffect(() => {
    setPref(lerPreferencia());
    const midia = window.matchMedia("(prefers-color-scheme: dark)");
    const mudou = () => {
      if (lerPreferencia() === "auto") aplicarTema("auto", true);
    };
    midia.addEventListener("change", mudou);
    // Outra aba ou o menu podem ter trocado: mantém todos os seletores em sincronia.
    const sincronizar = (e: Event) => setPref((e as CustomEvent<Preferencia>).detail);
    window.addEventListener("tema-mudou", sincronizar);
    return () => {
      midia.removeEventListener("change", mudou);
      window.removeEventListener("tema-mudou", sincronizar);
    };
  }, []);

  const escolher = (p: Preferencia) => {
    salvarPreferencia(p);
    setPref(p);
    window.dispatchEvent(new CustomEvent("tema-mudou", { detail: p }));
  };
  return [pref, escolher];
}

const OPCOES: { valor: Preferencia; rotulo: string }[] = [
  { valor: "auto", rotulo: "Automático" },
  { valor: "claro", rotulo: "Claro" },
  { valor: "escuro", rotulo: "Escuro" },
];

/** Seletor compacto, para o menu da conta. */
export function TemaRapido() {
  const [pref, escolher] = useTema();
  return (
    <div className="tema-rapido">
      <Segmentado
        valor={pref}
        aoMudar={escolher}
        rotulo="Aparência"
        opcoes={[
          { valor: "auto", rotulo: "Auto" },
          { valor: "claro", rotulo: "Claro" },
          { valor: "escuro", rotulo: "Escuro" },
        ]}
      />
    </div>
  );
}

/** As três telinhas de Ajustes, como em Tela e Brilho do iPhone. */
export function EscolhaDeAparencia() {
  const [pref, escolher] = useTema();
  return (
    <div className="aparencias" role="radiogroup" aria-label="Aparência">
      {OPCOES.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={pref === o.valor}
          className="aparencia"
          onClick={() => escolher(o.valor)}
        >
          <span className="aparencia-tela" aria-hidden="true">
            {o.valor !== "escuro" ? (
              <span className="tela-claro"><i /><i /><i /></span>
            ) : null}
            {o.valor !== "claro" ? (
              <span className={`tela-escuro ${o.valor === "auto" ? "metade" : ""}`}><i /><i /><i /></span>
            ) : null}
          </span>
          <span>{o.rotulo}</span>
          <span className="aparencia-marca" aria-hidden="true">
            {pref === o.valor ? <Check size={14} strokeWidth={3} /> : null}
          </span>
        </button>
      ))}
    </div>
  );
}
