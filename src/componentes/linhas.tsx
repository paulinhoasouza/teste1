"use client";

import { formatar } from "@/lib/dinheiro";
import { diaDe, nomeDoMes } from "@/lib/datas";
import { outra, type FixaDoMes, type Parcelamento } from "@/lib/dominio";
import type { Lancamento } from "@/lib/tipos";
import { useApp } from "./provedor";
import { Avatar, MarcaDono } from "./ui";

export function useNomeDaCategoria(): (id: string) => string {
  const { dados } = useApp();
  return (id) => dados.categorias.find((c) => c.id === id)?.nome ?? "Sem categoria";
}

/** Uma linha de lançamento; tocar abre a edição. */
export function LinhaLancamento({ l, comData }: { l: Lancamento; comData?: boolean }) {
  const { nomes, abrirLancamento } = useApp();
  const categoria = useNomeDaCategoria();

  let titulo = l.descricao || categoria(l.categoria);
  let detalhe = categoria(l.categoria);
  if (l.tipo === "acerto") {
    titulo = `${nomes[l.pagoPor]} pagou ${nomes[outra(l.pagoPor)]}`;
    detalhe = "Acerto do casal";
  } else if (l.tipo === "despesa" && l.deQuem !== l.pagoPor) {
    detalhe = `${detalhe}, ${nomes[l.pagoPor]} pagou`;
  }
  if (comData) detalhe = `${diaDe(l.data)}/${l.data.slice(5, 7)}, ${detalhe.charAt(0).toLowerCase()}${detalhe.slice(1)}`;

  const dono =
    l.tipo === "acerto" ? `acerto` : l.deQuem === "casal" ? "dos dois" : `de ${nomes[l.deQuem]}`;

  return (
    <li>
      <button
        type="button"
        className="linha"
        aria-label={`${titulo}, ${formatar(l.valor)}, ${dono}. Editar`}
        onClick={() => abrirLancamento({ modo: "editar", lancamento: l })}
      >
        {l.tipo === "acerto" ? <Avatar pessoa={l.pagoPor} nome={nomes[l.pagoPor]} /> : <MarcaDono dono={l.deQuem} nomes={nomes} />}
        <span className="linha-texto">
          <span className="linha-l1">
            <span>{titulo}</span>
            {l.parcela ? <span className="pilula">{l.parcela}</span> : null}
          </span>
          <span className="linha-l2" style={{ display: "block" }}>{detalhe}</span>
        </span>
        <span className={`num ${l.tipo === "receita" ? "positivo forte" : ""}`}>
          {l.tipo === "receita" ? "+" : ""}
          {formatar(l.valor)}
        </span>
      </button>
    </li>
  );
}

export function LinhaConta({ c }: { c: FixaDoMes }) {
  const { abrirLancamento, abrirFixa } = useApp();
  const receita = c.fixa.tipo === "receita";
  const dia = diaDe(c.vencimento);
  const quando =
    c.estado === "paga"
      ? receita ? "Recebida" : "Paga"
      : c.estado === "atrasada"
        ? receita ? `Era para entrar dia ${dia}` : `Venceu dia ${dia}`
        : c.estado === "hoje"
          ? receita ? "Entra hoje" : "Vence hoje"
          : receita ? `Entra dia ${dia}` : `Vence dia ${dia}`;
  return (
    <li className="linha sem-midia">
      <div className="linha-texto">
        <div className="linha-l1">
          <button
            type="button"
            style={{ background: "none", border: 0, padding: 0, textAlign: "left", minWidth: 0 }}
            aria-label={`${c.fixa.descricao}. Editar conta fixa`}
            onClick={() => abrirFixa({ fixa: c.fixa })}
          >
            <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.fixa.descricao}</span>
          </button>
        </div>
        <div className={`linha-l2 ${c.estado === "atrasada" && !receita ? "ruim" : c.estado === "hoje" ? "atencao" : ""}`}>{quando}</div>
      </div>
      <div className="linha-fim">
        <span className={`num ${c.estado === "paga" ? "mudo" : ""}`}>
          {receita ? "+" : ""}
          {formatar(c.valor)}
        </span>
        <span className="linha-acao">
          {c.estado === "paga" ? (
            <span className="pilula bom">{receita ? "Recebida" : "Paga"}</span>
          ) : (
            <button type="button" className="botao menor" onClick={() => abrirLancamento({ modo: "pagar", conta: c })}>
              {receita ? "Receber" : "Pagar"}
            </button>
          )}
        </span>
      </div>
    </li>
  );
}

export function LinhaParcelamento({ p }: { p: Parcelamento }) {
  const { nomes } = useApp();
  return (
    <li className="linha">
      <MarcaDono dono={p.deQuem} nomes={nomes} />
      <div className="linha-texto">
        <div className="linha-l1"><span>{p.descricao}</span></div>
        <div className="linha-l2">Parcela {p.numero} de {p.total}, até {nomeDoMes(p.ultimoMes)}</div>
      </div>
      <div className="linha-texto" style={{ textAlign: "right" }}>
        <div className="num">{formatar(p.valorDoMes)}</div>
        <div className="linha-l2 num">resta {formatar(p.restante)}</div>
      </div>
    </li>
  );
}
