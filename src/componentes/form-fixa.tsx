"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Dono, Fixa, PessoaId, TipoCategoria } from "@/lib/tipos";
import { CampoValor, EscolhaDono, EscolhaPessoa } from "./campos";
import { useApp } from "./provedor";
import { Segmentado } from "./ui";

export function FormFixa() {
  const { pedidoFixa, abrirFixa } = useApp();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (pedidoFixa && !d.open) d.showModal();
    if (!pedidoFixa && d.open) d.close();
  }, [pedidoFixa]);

  return (
    <dialog
      ref={ref}
      className="folha"
      aria-labelledby="titulo-fixa"
      onClose={() => abrirFixa(null)}
      onClick={(e) => {
        if (e.target === ref.current) abrirFixa(null);
      }}
    >
      {pedidoFixa ? <Corpo fixa={pedidoFixa.fixa} fechar={() => abrirFixa(null)} /> : null}
    </dialog>
  );
}

function Corpo({ fixa, fechar }: { fixa: Fixa | null; fechar: () => void }) {
  const { dados, quem, nomes, executar } = useApp();
  const [tipo, setTipo] = useState<TipoCategoria>(fixa?.tipo ?? "despesa");
  const [descricao, setDescricao] = useState(fixa?.descricao ?? "");
  const [valor, setValor] = useState(fixa?.valor ?? 0);
  const [dia, setDia] = useState(String(fixa?.dia ?? 10));
  const [categoria, setCategoria] = useState(fixa?.categoria ?? "");
  const [pagoPor, setPagoPor] = useState<PessoaId>(fixa?.pagoPor ?? quem);
  const [deQuem, setDeQuem] = useState<Dono>(fixa?.deQuem ?? "casal");
  const [parteA, setParteA] = useState(fixa?.parteA ?? dados.config.parteAPadrao);
  const [ativa, setAtiva] = useState(fixa?.ativa ?? true);
  const [erro, setErro] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  const categorias = dados.categorias.filter((c) => c.tipo === tipo && (!c.arquivada || c.id === categoria));
  const receita = tipo === "receita";

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const d = Number(dia);
    if (!descricao.trim()) return setErro("Dê um nome à conta.");
    if (valor <= 0) return setErro("Informe o valor.");
    if (!Number.isInteger(d) || d < 1 || d > 31) return setErro("O dia vai de 1 a 31.");
    if (!categoria) return setErro("Escolha uma categoria.");
    void executar(
      {
        acao: "fixa.salvar",
        ...(fixa ? { id: fixa.id, inicio: fixa.inicio, fim: fixa.fim } : {}),
        descricao, tipo, valor, dia: d, categoria,
        pagoPor: receita && deQuem !== "casal" ? deQuem : pagoPor,
        deQuem, parteA, ativa,
      },
      fixa ? "Alterações salvas" : "Conta fixa criada",
    );
    fechar();
  };

  return (
    <form onSubmit={enviar} style={{ display: "contents" }} noValidate>
      <div className="folha-topo">
        <h2 id="titulo-fixa">{fixa ? "Editar conta fixa" : "Nova conta fixa"}</h2>
        <button type="button" className="fechar" aria-label="Fechar" onClick={fechar}>
          <X size={18} strokeWidth={1.75} />
        </button>
      </div>

      <div className="folha-corpo">
        {!fixa ? (
          <Segmentado
            valor={tipo}
            opcoes={[{ valor: "despesa", rotulo: "A pagar" }, { valor: "receita", rotulo: "A receber" }]}
            aoMudar={(t) => { setTipo(t); setCategoria(""); if (t === "receita" && deQuem === "casal") setDeQuem(quem); }}
            rotulo="Tipo de conta"
            largo
          />
        ) : null}

        <div className="campo">
          <label htmlFor="f-descricao">Nome</label>
          <input
            id="f-descricao" className="entrada" value={descricao} maxLength={120} autoComplete="off"
            placeholder={receita ? "Salário" : "Aluguel, internet, academia"}
            onChange={(e) => { setDescricao(e.target.value); setErro(""); }}
          />
        </div>

        <div className="dois">
          <div className="campo">
            <label htmlFor="f-valor">Valor por mês</label>
            <CampoValor id="f-valor" valor={valor} aoMudar={(v) => { setValor(v); setErro(""); }} rotulo="Valor por mês" />
          </div>
          <div className="campo">
            <label htmlFor="f-dia">{receita ? "Dia em que entra" : "Dia do vencimento"}</label>
            <input id="f-dia" className="entrada num" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, "").slice(0, 2))} />
          </div>
        </div>

        <div className="campo">
          <label htmlFor="f-categoria">Categoria</label>
          <select id="f-categoria" className="selecao" value={categoria} onChange={(e) => { setCategoria(e.target.value); setErro(""); }}>
            <option value="">Escolha</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>

        {!receita ? <EscolhaPessoa valor={pagoPor} aoMudar={setPagoPor} nomes={nomes} rotulo="Quem costuma pagar" /> : null}
        <EscolhaDono
          valor={deQuem} aoMudar={setDeQuem} parteA={parteA} aoMudarParte={setParteA} nomes={nomes}
          rotulo={receita ? "De quem é a receita" : "De quem é a conta"}
        />

        {fixa ? (
          <label className="entre" style={{ cursor: "pointer" }}>
            <span>
              <span className="rotulo-campo" style={{ display: "block", fontSize: 14, fontWeight: 500 }}>Conta ativa</span>
              <span className="campo-dica">Desligue para pausar sem perder o histórico.</span>
            </span>
            <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} style={{ width: 20, height: 20, accentColor: "var(--text)" }} />
          </label>
        ) : null}

        {erro ? <p className="erro-campo" role="alert">{erro}</p> : null}
      </div>

      {excluindo && fixa ? (
        <div className="folha-pe">
          <button type="button" className="botao" onClick={() => setExcluindo(false)}>Cancelar</button>
          <button
            type="button" className="botao perigo"
            onClick={() => { void executar({ acao: "fixa.remover", id: fixa.id }, "Conta fixa excluída"); fechar(); }}
          >
            Excluir “{fixa.descricao}”
          </button>
        </div>
      ) : (
        <div className="folha-pe">
          {fixa ? <button type="button" className="botao perigo" onClick={() => setExcluindo(true)}>Excluir</button> : null}
          <button type="submit" className="botao primario alto">{fixa ? "Salvar alterações" : "Criar conta fixa"}</button>
        </div>
      )}
    </form>
  );
}
