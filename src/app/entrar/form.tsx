"use client";

import { useState } from "react";
import { Marca } from "@/componentes/ui";

export function FormEntrar() {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senha) return setErro("Digite a senha.");
    setEnviando(true);
    setErro("");
    try {
      const r = await fetch("/api/entrar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      if (r.ok) {
        window.location.href = "/";
        return;
      }
      setErro(r.status === 401 ? "Senha incorreta. Confira e tente de novo." : "Não foi possível entrar agora.");
    } catch {
      setErro("Sem conexão. Tente de novo.");
    }
    setEnviando(false);
  };

  return (
    <main className="centro">
      <form className="centro-cartao" onSubmit={enviar} noValidate>
        <Marca tamanho={48} />
        <div>
          <h1>A dois</h1>
          <p className="mudo" style={{ marginTop: 8 }}>O controle financeiro de vocês. Entre com a senha combinada.</p>
        </div>
        <div className="campo">
          <label htmlFor="senha">Senha</label>
          <input
            id="senha" type="password" className="entrada" value={senha} autoComplete="current-password" autoFocus
            aria-describedby={erro ? "senha-erro" : undefined} aria-invalid={erro ? true : undefined}
            onChange={(e) => { setSenha(e.target.value); setErro(""); }}
          />
          {erro ? <p className="erro-campo" id="senha-erro" role="alert">{erro}</p> : null}
        </div>
        <button type="submit" className="botao primario alto largo" disabled={enviando}>
          {enviando ? "Entrando" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
