"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { CampoValor } from "@/componentes/campos";
import { Titulo } from "@/componentes/casca";
import { GraficoFluxo } from "@/componentes/grafico-fluxo";
import { useApp } from "@/componentes/provedor";
import { Cartao, Segmentado } from "@/componentes/ui";
import { mesDe, nomeDoMes, nomeDoMesCurto, somarMeses } from "@/lib/datas";
import { formatar } from "@/lib/dinheiro";
import { fluxoDeCaixa, inicioDoFluxo, type ItemDoFluxo, type MesDoFluxo } from "@/lib/fluxo";
import type { Dono } from "@/lib/tipos";

const ROTULO_DA_ORIGEM: Record<ItemDoFluxo["origem"], string> = {
  lancamento: "",
  parcela: "Parcela",
  fixa: "Conta fixa",
  assinatura: "Assinatura",
  salario: "Fixa",
};

interface Linha {
  chave: string;
  descricao: string;
  detalhe: string;
  valor: number;
  pilula: { texto: string; tom: "" | "aviso" | "ruim" } | null;
}

/** Lançamentos avulsos viram uma linha por categoria; contas, parcelas e salários ficam um a um. */
function agrupar(itens: ItemDoFluxo[], nomeDaCategoria: (id: string) => string): Linha[] {
  const linhas: Linha[] = [];
  const porCategoria = new Map<string, { valor: number; n: number }>();
  for (const i of itens) {
    if (i.origem === "lancamento" && !i.pendente) {
      const g = porCategoria.get(i.categoria) ?? { valor: 0, n: 0 };
      porCategoria.set(i.categoria, { valor: g.valor + i.valor, n: g.n + 1 });
      continue;
    }
    const pilula: Linha["pilula"] = i.atrasada
      ? { texto: "Em atraso", tom: "ruim" }
      : i.simulado
        ? { texto: "Simulado", tom: "aviso" }
        : i.pendente && i.origem !== "parcela" && i.origem !== "lancamento"
          ? { texto: i.entrada ? "A receber" : "A pagar", tom: "" }
          : null;
    linhas.push({ chave: i.id, descricao: i.descricao, detalhe: ROTULO_DA_ORIGEM[i.origem], valor: i.valor, pilula });
  }
  for (const [cat, g] of porCategoria) {
    linhas.push({
      chave: `cat:${cat}`,
      descricao: nomeDaCategoria(cat),
      detalhe: g.n === 1 ? "1 lançamento" : `${g.n} lançamentos`,
      valor: g.valor,
      pilula: null,
    });
  }
  return linhas.sort((a, b) => b.valor - a.valor);
}

export default function PaginaFluxo() {
  const { dados, nomes, hoje, executar } = useApp();
  const [escopo, setEscopo] = useState<Dono>("casal");
  const [horizonte, setHorizonte] = useState<"6" | "12">("6");
  const [aberto, setAberto] = useState<string | null>(null);

  const mesAtual = mesDe(hoje);
  const proximo = somarMeses(mesAtual, 1);
  const fluxo = useMemo(() => fluxoDeCaixa(dados, escopo, hoje, Number(horizonte)), [dados, escopo, hoje, horizonte]);
  const atual = fluxo.meses.find((m) => m.mes === mesAtual);
  const seguinte = fluxo.meses.find((m) => m.mes === proximo);
  const ultimo = fluxo.meses[fluxo.meses.length - 1]!;
  const nomeDaCategoria = (id: string) => dados.categorias.find((c) => c.id === id)?.nome ?? "Sem categoria";
  const quem = escopo === "casal" ? "vocês" : nomes[escopo];

  const achado = !atual
    ? "Para onde o dinheiro vai nos próximos meses."
    : atual.saldoFinal >= 0
      ? `${formatar(atual.saldoFinal)} devem sobrar em ${nomeDoMesCurto(mesAtual)} e passar para ${nomeDoMesCurto(proximo)}. ${
          fluxo.primeiroNegativo ? `Atenção: em ${nomeDoMes(fluxo.primeiroNegativo)} o saldo fica negativo.` : `No fim de ${nomeDoMes(ultimo.mes)}, ${quem} devem ter ${formatar(ultimo.saldoFinal)}.`
        }`
      : `${nomeDoMes(mesAtual).replace(/^./, (c) => c.toUpperCase())} deve fechar faltando ${formatar(-atual.saldoFinal)}.`;

  return (
    <>
      <Titulo titulo="Fluxo de caixa" achado={achado} semMes acao={<span />} />

      <div className="filtros empilhar">
        <Segmentado
          valor={escopo}
          aoMudar={setEscopo}
          rotulo="De quem"
          opcoes={[
            { valor: "casal", rotulo: "Nós" },
            { valor: "a", rotulo: nomes.a },
            { valor: "b", rotulo: nomes.b },
          ]}
        />
        <Segmentado
          valor={horizonte}
          aoMudar={setHorizonte}
          rotulo="Quantos meses à frente"
          opcoes={[
            { valor: "6", rotulo: "Próximos 6 meses" },
            { valor: "12", rotulo: "12 meses" },
          ]}
        />
      </div>

      <div className="grade topo">
        <section className="cartao c12" aria-label="Resumo do fluxo">
          <dl className="rel-numeros">
            <div>
              <dt>Passa para {nomeDoMesCurto(proximo)}</dt>
              <dd className={`figura num ${atual && atual.saldoFinal < 0 ? "negativo" : ""}`}>{formatar(atual?.saldoFinal ?? 0)}</dd>
              <dd className="nota">
                {atual && atual.previsto.saidas > 0 ? `já descontando ${formatar(atual.previsto.saidas)} a pagar` : `o que sobra de ${nomeDoMesCurto(mesAtual)}`}
              </dd>
            </div>
            <div>
              <dt>Sobra de {nomeDoMesCurto(proximo)}</dt>
              <dd className={`figura num ${seguinte && seguinte.sobra < 0 ? "negativo" : ""}`}>{formatar(seguinte?.sobra ?? 0)}</dd>
              <dd className="nota">entra {formatar(seguinte?.entradas ?? 0)}, sai {formatar(seguinte?.saidas ?? 0)}</dd>
            </div>
            <div>
              <dt>Disponível em {nomeDoMesCurto(proximo)}</dt>
              <dd className={`figura num ${seguinte && seguinte.saldoFinal < 0 ? "negativo" : ""}`}>{formatar(seguinte?.saldoFinal ?? 0)}</dd>
              <dd className="nota">o que passa somado à sobra</dd>
            </div>
            <div>
              <dt>Mês mais apertado</dt>
              <dd className={`figura num ${fluxo.menor && fluxo.menor.saldo < 0 ? "negativo" : ""}`}>{formatar(fluxo.menor?.saldo ?? 0)}</dd>
              <dd className="nota">{fluxo.menor ? `no fim de ${nomeDoMes(fluxo.menor.mes)}` : "—"}</dd>
            </div>
          </dl>
        </section>

        <Cartao
          className="c8"
          titulo="Saldo no fim de cada mês"
          sub={seguinte && seguinte.simulado > 0 ? "Os meses à frente usam o salário simulado pelo bruto até ser confirmado." : undefined}
        >
          <GraficoFluxo meses={fluxo.meses} mesAtual={mesAtual} />
        </Cartao>

        <PontoDePartida
          inicio={fluxo.inicio}
          inicioAutomatico={inicioDoFluxo({ ...dados, config: { ...dados.config, fluxoInicio: "" } }, hoje)}
          salvar={(inicio, saldoA, saldoB) => executar({ acao: "fluxo.ajustar", inicio, saldoA, saldoB }, "Ponto de partida salvo")}
        />

        <Cartao className="c12" titulo="Mês a mês" sub="Toque num mês para ver o que entra e o que sai.">
          <div className="fluxo-tabela" role="table" aria-label="Fluxo de caixa mês a mês">
            <div className="fluxo-cabeca" role="row">
              <span role="columnheader">Mês</span>
              <span role="columnheader">Começa com</span>
              <span role="columnheader">Entra</span>
              <span role="columnheader">Sai</span>
              <span role="columnheader">Termina com</span>
            </div>
            {fluxo.meses.map((m) => (
              <LinhaDoMes
                key={m.mes}
                m={m}
                aberto={aberto === m.mes}
                alternar={() => setAberto((x) => (x === m.mes ? null : m.mes))}
                nomeDaCategoria={nomeDaCategoria}
              />
            ))}
          </div>
        </Cartao>
      </div>
    </>
  );
}

function LinhaDoMes({
  m, aberto, alternar, nomeDaCategoria,
}: { m: MesDoFluxo; aberto: boolean; alternar: () => void; nomeDaCategoria: (id: string) => string }) {
  const entradas = agrupar(m.itens.filter((i) => i.entrada), nomeDaCategoria);
  const saidas = agrupar(m.itens.filter((i) => !i.entrada), nomeDaCategoria);
  const nome = nomeDoMes(m.mes).replace(/^./, (c) => c.toUpperCase());
  return (
    <div className={`fluxo-mes ${aberto ? "aberto" : ""} ${m.situacao}`} role="rowgroup">
      <button type="button" className="fluxo-linha" role="row" aria-expanded={aberto} onClick={alternar}>
        <span role="cell" className="fluxo-nome">
          <ChevronDown size={16} strokeWidth={2} className="fluxo-seta" aria-hidden="true" />
          <span>{nome}</span>
          {m.situacao === "atual" ? <span className="pilula">Agora</span> : m.situacao === "futuro" ? <span className="pilula previsto-pilula">Previsto</span> : null}
        </span>
        <span role="cell" className="num mudo" data-rotulo="Começa com">{formatar(m.saldoInicial)}</span>
        <span role="cell" className="num" data-rotulo="Entra">+{formatar(m.entradas)}</span>
        <span role="cell" className="num" data-rotulo="Sai">−{formatar(m.saidas)}</span>
        <span role="cell" className={`num forte ${m.saldoFinal < 0 ? "negativo" : ""}`} data-rotulo="Termina com">{formatar(m.saldoFinal)}</span>
      </button>
      {aberto ? (
        <div className="fluxo-detalhe">
          <ListaDoMes titulo="Entra" linhas={entradas} total={m.entradas} vazio="Nada previsto para entrar." />
          <ListaDoMes titulo="Sai" linhas={saidas} total={m.saidas} vazio="Nada previsto para sair." />
        </div>
      ) : null}
    </div>
  );
}

function ListaDoMes({ titulo, linhas, total, vazio }: { titulo: string; linhas: Linha[]; total: number; vazio: string }) {
  return (
    <div>
      <h3 className="fluxo-detalhe-titulo">
        <span>{titulo}</span>
        <span className="num">{formatar(total)}</span>
      </h3>
      {linhas.length === 0 ? (
        <p className="mudo pequeno">{vazio}</p>
      ) : (
        <ul className="fluxo-itens">
          {linhas.map((l) => (
            <li key={l.chave}>
              <span className="fluxo-item-nome">
                <span>{l.descricao}</span>
                {l.detalhe ? <span className="mudo pequeno">{l.detalhe}</span> : null}
                {l.pilula ? <span className={`pilula ${l.pilula.tom}`}>{l.pilula.texto}</span> : null}
              </span>
              <span className="num">{formatar(l.valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** De quando o fluxo começa e quanto cada um já tinha antes disso. */
function PontoDePartida({
  inicio, inicioAutomatico, salvar,
}: {
  inicio: string;
  inicioAutomatico: string;
  salvar: (inicio: string, saldoA: number, saldoB: number) => Promise<boolean>;
}) {
  const { dados, nomes, hoje } = useApp();
  const c = dados.config;
  const [mes, setMes] = useState(c.fluxoInicio);
  const [saldoA, setSaldoA] = useState(Math.max(0, c.saldoInicialA));
  const [saldoB, setSaldoB] = useState(Math.max(0, c.saldoInicialB));
  const [salvando, setSalvando] = useState(false);
  const mudou = mes !== c.fluxoInicio || saldoA !== Math.max(0, c.saldoInicialA) || saldoB !== Math.max(0, c.saldoInicialB);
  const atual = mesDe(hoje);
  const opcoes = Array.from({ length: 13 }, (_, i) => somarMeses(atual, -12 + i)).reverse();
  const comecoVisivel = mes || inicioAutomatico;

  return (
    <Cartao className="c4" titulo="Ponto de partida" sub={`O fluxo começa em ${nomeDoMes(inicio)}.`}>
      <form
        className="ponto-partida"
        onSubmit={async (e) => {
          e.preventDefault();
          setSalvando(true);
          await salvar(mes, saldoA, saldoB);
          setSalvando(false);
        }}
      >
        <div className="campo">
          <label htmlFor="fluxo-inicio">Começa em</label>
          <select id="fluxo-inicio" className="selecao" value={mes} onChange={(e) => setMes(e.target.value)}>
            <option value="">Automático: {nomeDoMes(inicioAutomatico)}</option>
            {opcoes.map((m) => (
              <option key={m} value={m}>{nomeDoMes(m)}</option>
            ))}
          </select>
          <span className="campo-dica">Automático é o mês em que vocês começaram a usar o app.</span>
        </div>
        {([["a", saldoA, setSaldoA], ["b", saldoB, setSaldoB]] as const).map(([p, v, set]) => (
          <div className="campo" key={p}>
            <label htmlFor={`saldo-${p}`}>{nomes[p]} já tinha, antes de {nomeDoMesCurto(comecoVisivel)}</label>
            <CampoValor id={`saldo-${p}`} valor={v} aoMudar={set} rotulo={`Saldo de ${nomes[p]}`} selecionarAoFocar />
          </div>
        ))}
        <p className="campo-dica">Dinheiro guardado em conta ou investido que vocês queiram contar no fluxo. Pode deixar zero.</p>
        <button type="submit" className="botao primario largo" disabled={!mudou || salvando}>
          {salvando ? "Salvando…" : "Salvar ponto de partida"}
        </button>
      </form>
    </Cartao>
  );
}
