"use client";

import { Paperclip } from "lucide-react";
import { comprovantesDe } from "@/lib/comprovantes";
import { formatar } from "@/lib/dinheiro";
import { diaDe, nomeDoMes } from "@/lib/datas";
import { outra, type FixaDoMes, type Parcelamento } from "@/lib/dominio";
import type { Fixa, Lancamento } from "@/lib/tipos";
import { useApp } from "./provedor";
import { Avatar, MarcaDono } from "./ui";

export function useNomeDaCategoria(): (id: string) => string {
  const { dados } = useApp();
  return (id) => dados.categorias.find((c) => c.id === id)?.nome ?? "Sem categoria";
}

/** Uma linha de lançamento; tocar abre a edição. */
export function LinhaLancamento({ l, comData }: { l: Lancamento; comData?: boolean }) {
  const { dados, nomes, abrirLancamento } = useApp();
  const categoria = useNomeDaCategoria();
  const anexos = comprovantesDe(dados.comprovantes ?? [], l).length;

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
        aria-label={`${titulo}, ${formatar(l.valor)}, ${dono}${anexos ? `, ${anexos === 1 ? "1 comprovante" : `${anexos} comprovantes`}` : ""}. Editar`}
        onClick={() => abrirLancamento({ modo: "editar", lancamento: l })}
      >
        {l.tipo === "acerto" ? <Avatar pessoa={l.pagoPor} nome={nomes[l.pagoPor]} /> : <MarcaDono dono={l.deQuem} nomes={nomes} />}
        <span className="linha-texto">
          <span className="linha-l1">
            <span>{titulo}</span>
            {l.parcela ? <span className="pilula">{l.parcela}</span> : null}
            {anexos ? <ClipeDeAnexos n={anexos} /> : null}
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

/** Clipe com a quantidade, ao lado do nome: este lançamento tem comprovante. */
export function ClipeDeAnexos({ n }: { n: number }) {
  return (
    <span className="clipe" aria-hidden="true">
      <Paperclip size={13} strokeWidth={2} />
      {n > 1 ? n : null}
    </span>
  );
}

export function LinhaConta({ c }: { c: FixaDoMes }) {
  const { dados, abrirLancamento, abrirFixa } = useApp();
  // Conta paga: tocar no "Paga" abre o pagamento, onde dá para ver ou anexar o comprovante.
  const pagamento = c.lancamentoId ? dados.lancamentos.find((l) => l.id === c.lancamentoId) : undefined;
  const anexos = pagamento ? comprovantesDe(dados.comprovantes ?? [], pagamento).length : 0;
  const receita = c.fixa.tipo === "receita";
  const dia = diaDe(c.vencimento);
  const salario = c.fixa.bruto > 0 && receita;
  let quando =
    c.estado === "paga"
      ? receita ? "Recebida" : "Paga"
      : c.estado === "atrasada"
        ? receita ? `Era para entrar dia ${dia}` : `Venceu dia ${dia}`
        : c.estado === "hoje"
          ? receita ? "Entra hoje" : "Vence hoje"
          : receita ? `Entra dia ${dia}` : `Vence dia ${dia}`;
  if (salario && c.estado === "paga") {
    quando = c.diferenca === 0
      ? "Recebido, igual ao simulado"
      : `Recebido, ${formatar(Math.abs(c.diferenca))} ${c.diferenca > 0 ? "acima" : "abaixo"} do simulado`;
  } else if (c.simulado) {
    quando = `${quando}, bruto de ${formatar(c.fixa.bruto)}`;
  }
  if (c.fixa.fim && c.estado !== "paga") quando = `${quando}, até ${nomeDoMes(c.fixa.fim)}`;

  return (
    <li className="linha sem-midia">
      <div className="linha-texto">
        <div className="linha-l1">
          <button
            type="button"
            style={{ background: "none", border: 0, padding: 0, textAlign: "left", minWidth: 0 }}
            aria-label={`${c.fixa.descricao}. Editar ${receita ? "receita" : "conta"} fixa`}
            onClick={() => abrirFixa({ fixa: c.fixa })}
          >
            <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.fixa.descricao}</span>
          </button>
          {c.simulado ? <span className="pilula aviso">Simulado</span> : null}
        </div>
        <div className={`linha-l2 quebra ${c.estado === "atrasada" && !receita ? "ruim" : c.estado === "hoje" || (c.estado === "atrasada" && c.simulado) ? "atencao" : ""}`}>
          {quando}
        </div>
      </div>
      <div className="linha-fim">
        <span className={`num ${c.estado === "paga" ? "mudo" : ""}`}>
          {receita ? "+" : ""}
          {formatar(c.valor)}
        </span>
        <span className="linha-acao">
          {c.estado === "paga" && pagamento ? (
            <button
              type="button"
              className="pilula bom pilula-botao"
              aria-label={`${receita ? "Recebida" : "Paga"}${anexos ? `, ${anexos === 1 ? "com comprovante" : `com ${anexos} comprovantes`}` : ""}. Ver o pagamento`}
              onClick={() => abrirLancamento({ modo: "editar", lancamento: pagamento })}
            >
              {anexos ? <Paperclip size={11} strokeWidth={2.25} aria-hidden="true" /> : null}
              {receita ? "Recebida" : "Paga"}
            </button>
          ) : c.estado === "paga" ? (
            <span className="pilula bom">{receita ? "Recebida" : "Paga"}</span>
          ) : (
            <button
              type="button"
              className="botao menor"
              aria-label={c.simulado ? `Confirmar o valor líquido de ${c.fixa.descricao}` : undefined}
              onClick={() => abrirLancamento({ modo: "pagar", conta: c })}
            >
              {c.simulado ? "Confirmar" : receita ? "Receber" : "Pagar"}
            </button>
          )}
        </span>
      </div>
    </li>
  );
}

/** Conta fixa que não vale para o mês: pausada, encerrada ou ainda por começar. */
export function LinhaFixaFora({ f, mes }: { f: Fixa; mes: string }) {
  const { abrirFixa } = useApp();
  const motivo = !f.ativa
    ? "Pausada"
    : f.fim && f.fim < mes
      ? `Terminou em ${nomeDoMes(f.fim)}`
      : `Começa em ${nomeDoMes(f.inicio)}`;
  return (
    <li className="linha sem-midia">
      <div className="linha-texto">
        <div className="linha-l1"><span>{f.descricao}</span></div>
        <div className="linha-l2">{motivo}</div>
      </div>
      <div className="linha-fim">
        <span className="num mudo">{f.tipo === "receita" ? "+" : ""}{formatar(f.valor)}</span>
        <span className="linha-acao">
          <button type="button" className="botao menor" aria-label={`Editar ${f.descricao}`} onClick={() => abrirFixa({ fixa: f })}>
            Editar
          </button>
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
