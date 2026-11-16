"use client";

import { useState } from "react";
import { useApp } from "./provedor";
import { Marca } from "./ui";

/** Primeira vez numa planilha nova: só falta saber como vocês se chamam. */
export function BoasVindas() {
  const { dados, executar } = useApp();
  const [nomeA, setNomeA] = useState(dados.config.nomeA);
  const [nomeB, setNomeB] = useState(dados.config.nomeB);
  const [erro, setErro] = useState("");

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeA.trim() || !nomeB.trim()) return setErro("Preencha os dois nomes.");
    void executar({ acao: "config.salvar", ...dados.config, nomeA, nomeB });
  };

  return (
    <main className="centro">
      <form className="centro-cartao" onSubmit={enviar} noValidate>
        <Marca tamanho={48} />
        <div>
          <h1>Como vocês se chamam?</h1>
          <p className="mudo" style={{ marginTop: 8 }}>
            Os nomes aparecem em cada lançamento, para saber quem pagou e de quem é.
          </p>
        </div>
        <div className="campo">
          <label htmlFor="bv-a">Seu nome</label>
          <input id="bv-a" className="entrada" value={nomeA} maxLength={24} autoComplete="given-name" onChange={(e) => { setNomeA(e.target.value); setErro(""); }} />
        </div>
        <div className="campo">
          <label htmlFor="bv-b">Nome da outra pessoa</label>
          <input id="bv-b" className="entrada" value={nomeB} maxLength={24} autoComplete="off" onChange={(e) => { setNomeB(e.target.value); setErro(""); }} />
        </div>
        {erro ? <p className="erro-campo" role="alert">{erro}</p> : null}
        <button type="submit" className="botao primario alto largo">Começar</button>
      </form>
    </main>
  );
}
