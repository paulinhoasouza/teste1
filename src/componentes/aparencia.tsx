"use client";

import { Check, Moon, SlidersHorizontal, Sun } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
  aplicarTema, lerPreferencia, lerVidro, salvarPreferencia, salvarVidro, VIDRO_PADRAO, type Preferencia,
} from "@/lib/tema";
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

/** Sol ou lua: troca na hora entre claro e escuro, sem passar pelo automático. */
export function TrocaDeTema() {
  const [, escolher] = useTema();
  const [escuro, setEscuro] = useState(false);
  useEffect(() => {
    const ler = () => setEscuro(document.documentElement.dataset.tema === "escuro");
    ler();
    const obs = new MutationObserver(ler);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
    return () => obs.disconnect();
  }, []);
  return (
    <button
      type="button"
      className="icone-botao troca-tema"
      aria-label={escuro ? "Usar tema claro" : "Usar tema escuro"}
      title={escuro ? "Tema claro" : "Tema escuro"}
      onClick={() => escolher(escuro ? "claro" : "escuro")}
    >
      <span className="sol-lua" data-escuro={escuro}>
        <Sun size={18} strokeWidth={1.75} />
        <Moon size={17} strokeWidth={1.75} />
      </span>
    </button>
  );
}

/** Nível do vidro guardado no aparelho, sincronizado entre os seletores abertos. */
function useVidro(): [number, (v: number) => void] {
  const [nivel, setNivel] = useState(VIDRO_PADRAO);
  useEffect(() => {
    setNivel(lerVidro());
    const ouvir = (e: Event) => setNivel((e as CustomEvent<number>).detail);
    window.addEventListener("vidro-mudou", ouvir);
    return () => window.removeEventListener("vidro-mudou", ouvir);
  }, []);
  const mudar = (v: number) => {
    salvarVidro(v);
    window.dispatchEvent(new CustomEvent("vidro-mudou", { detail: v }));
  };
  return [nivel, mudar];
}

/** A régua do vidro, de transparente a fosco. */
export function ReguaDeVidro() {
  const [nivel, mudar] = useVidro();
  return (
    <div className="regua-vidro">
      <div className="entre">
        <strong className="forte-medio">Vidro</strong>
        <span className="mudo pequeno num">{nivel}% fosco</span>
      </div>
      <input
        type="range"
        className="regua"
        min={0}
        max={100}
        step={1}
        value={nivel}
        aria-label="Quanto o vidro é fosco"
        aria-valuetext={`${nivel}% fosco`}
        style={{ "--p": `${nivel}%` } as React.CSSProperties}
        onChange={(e) => mudar(Number(e.target.value))}
      />
      <div className="entre pequeno mudo">
        <span>Transparente</span>
        {nivel !== VIDRO_PADRAO ? (
          <button type="button" className="ligacao pequeno" onClick={() => mudar(VIDRO_PADRAO)}>Padrão</button>
        ) : null}
        <span>Fosco</span>
      </div>
    </div>
  );
}

/** Botão "Ajustar vidro" da barra, com a régua num balão. */
export function AjusteDeVidro() {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  return (
    <div className="ajuste-vidro" ref={ref}>
      <button type="button" className="texto-botao" aria-expanded={aberto} aria-controls={id} onClick={() => setAberto((v) => !v)}>
        <SlidersHorizontal size={17} strokeWidth={1.75} />
        Ajustar vidro
      </button>
      {aberto ? (
        <div className="vidro-pop" id={id} role="dialog" aria-label="Ajustar vidro">
          <ReguaDeVidro />
        </div>
      ) : null}
    </div>
  );
}
