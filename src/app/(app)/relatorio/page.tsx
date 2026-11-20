"use client";

import { CircleCheck, Info, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { IconeAssinatura } from "@/componentes/assinatura";
import { TrocaMes, useTituloCompacto } from "@/componentes/casca";
import { GraficoMensal } from "@/componentes/grafico-mensal";
import { useNomeDaCategoria } from "@/componentes/linhas";
import { useApp } from "@/componentes/provedor";
import { Avatar, Cartao, Segmentado, Trilho, Valor } from "@/componentes/ui";
import { diaCurto, nomeDoMes, nomeDoMesCurto } from "@/lib/datas";
import { formatar } from "@/lib/dinheiro";
import { fixaVigente, valorMensal, peso } from "@/lib/dominio";
import {
  assinaturas, categorias, composicao, destaques, divisao, maioresGastos, mesesAte, parcelasFuturas, serie, totais,
} from "@/lib/relatorio";
import type { Dono, PessoaId } from "@/lib/tipos";

type Periodo = "1" | "3" | "6" | "12";

const pct = (parte: number, todo: number) => (todo > 0 ? `${Math.round((parte / todo) * 100)}%` : "0%");

export default function Relatorio() {
  const { dados, mes, hoje, nomes } = useApp();
  const nomeDaCategoria = useNomeDaCategoria();
  const [escopo, setEscopo] = useState<Dono>("casal");
  const [periodo, setPeriodo] = useState<Periodo>("1");
  const refTitulo = useTituloCompacto("Relatório");

  const meses = useMemo(() => mesesAte(mes, Number(periodo)), [mes, periodo]);
  // O gráfico mostra pelo menos seis meses, para dar contexto ao período.
  const mesesDoGrafico = useMemo(() => mesesAte(mes, Math.max(6, Number(periodo))), [mes, periodo]);

  const r = useMemo(() => {
    const s = serie(dados, escopo, meses, hoje);
    const t = totais(s);
    const comp = composicao(dados, escopo, meses, hoje);
    const cats = categorias(dados, escopo, meses);
    const assin = assinaturas(dados, escopo, mes);
    const div = divisao(dados, meses, hoje);
    const futuras = parcelasFuturas(dados.lancamentos, escopo, mes, 6);
    const parcelasProximas = futuras.reduce((x, m) => x + m.total, 0);
    const contasMensais = dados.fixas
      .filter((f) => f.tipo === "despesa" && f.natureza === "conta" && fixaVigente(f, mes))
      .reduce((x, f) => x + peso({ ...f, valor: valorMensal(f) }, escopo), 0);
    return {
      serieGrafico: serie(dados, escopo, mesesDoGrafico, hoje),
      t,
      comp,
      cats,
      assin,
      div,
      futuras,
      parcelasProximas,
      contasMensais,
      maiores: maioresGastos(dados, escopo, meses, 5),
      frases: destaques({
        escopo,
        nomes,
        totais: t,
        composicao: comp,
        categorias: cats,
        assinaturasMensal: assin.mensal,
        divisao: div,
        parteAPadrao: dados.config.parteAPadrao,
        parcelasProximas,
        meses: meses.length,
      }),
    };
  }, [dados, escopo, meses, mesesDoGrafico, mes, hoje, nomes]);

  const rotuloPeriodo =
    meses.length === 1 ? nomeDoMes(mes) : `${nomeDoMesCurto(meses[0]!)} a ${nomeDoMes(mes)}`;
  const sujeito = escopo === "casal" ? "de vocês" : `de ${nomes[escopo]}`;
  const { t, comp } = r;
  const maiorCategoria = Math.max(1, ...r.cats.map((c) => Math.max(c.total, c.orcamento)));

  return (
    <>
      <div className="titulo junto">
        <div>
          <h1 ref={refTitulo}>Relatório</h1>
          <p className="titulo-achado">{rotuloPeriodo}, {escopo === "casal" ? "os dois juntos" : `só a parte de ${nomes[escopo]}`}.</p>
        </div>
        <div className="titulo-acoes">
          <TrocaMes compacto />
        </div>
      </div>

      <div className="filtros empilhar" style={{ marginBottom: 20 }}>
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
          valor={periodo}
          aoMudar={setPeriodo}
          rotulo="Período"
          opcoes={[
            { valor: "1", rotulo: "Mês" },
            { valor: "3", rotulo: "3 meses" },
            { valor: "6", rotulo: "6 meses" },
            { valor: "12", rotulo: "12 meses" },
          ]}
        />
      </div>

      <div className="grade topo">
        <section className="cartao c12" aria-labelledby="r-resumo">
          <h2 id="r-resumo" className="so-leitor">Resumo</h2>
          <dl className="rel-numeros">
            <div>
              <dt>Renda</dt>
              <dd><Valor centavos={t.renda} className="figura" /></dd>
              <dd className="nota">{t.rendaSimulada > 0 ? `${formatar(t.rendaSimulada)} ainda simulado` : "Toda confirmada"}</dd>
            </div>
            <div>
              <dt>Saídas</dt>
              <dd><Valor centavos={t.saidas} className="figura" /></dd>
              <dd className="nota">{pct(t.saidas, t.renda)} da renda</dd>
            </div>
            <div>
              <dt>{t.sobra < 0 ? "Faltou" : "Sobra"}</dt>
              <dd><Valor centavos={Math.abs(t.sobra)} className={`figura ${t.sobra < 0 ? "negativo" : ""}`} /></dd>
              <dd className="nota">{meses.length > 1 ? `${formatar(Math.round(t.sobra / meses.length))} por mês` : "renda menos saídas"}</dd>
            </div>
            <div>
              <dt>Guardado</dt>
              <dd className="figura num">{t.poupanca === null ? "—" : `${Math.round(t.poupanca * 100)}%`}</dd>
              <dd className="nota">da renda {sujeito}</dd>
            </div>
          </dl>
        </section>

        <Cartao className="c7" titulo="O que importa">
          {r.frases.length === 0 ? (
            <p className="vazio">Ainda não há lançamentos suficientes neste período para tirar conclusões.</p>
          ) : (
            <ul className="destaques">
              {r.frases.map((f) => (
                <li key={f.texto} className={f.tom}>
                  {f.tom === "bom" ? <CircleCheck size={20} strokeWidth={2} aria-label="Bom" />
                    : f.tom === "atencao" ? <TriangleAlert size={20} strokeWidth={2} aria-label="Atenção" />
                      : <Info size={20} strokeWidth={2} aria-hidden="true" />}
                  <span>{f.texto}</span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao className="c5" titulo="Para onde vai">
          {comp.total === 0 ? (
            <p className="vazio">Nenhuma saída em {rotuloPeriodo}.</p>
          ) : (
            <ul className="composicao">
              {[
                { nome: "Contas fixas", valor: comp.contas, nota: "aluguel, luz, internet" },
                { nome: "Assinaturas", valor: comp.assinaturas, nota: "streaming, jogos, apps" },
                { nome: "Parcelas", valor: comp.parcelas, nota: "compras parceladas" },
                { nome: "Dia a dia", valor: comp.diaADia, nota: "mercado, saídas, compras" },
              ].map((c) => (
                <li key={c.nome}>
                  <span>
                    {c.nome}
                    <span className="mudo pequeno" style={{ display: "block" }}>{c.nota}</span>
                  </span>
                  <span className="num" style={{ textAlign: "right" }}>
                    {formatar(c.valor)}
                    <span className="mudo pequeno" style={{ display: "block" }}>{pct(c.valor, comp.total)}</span>
                  </span>
                  <Trilho fino total={comp.total} rotulo={`${c.nome}: ${pct(c.valor, comp.total)} das saídas`} segmentos={[{ classe: "seg-casal", valor: c.valor }]} />
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao className="c12" titulo="Mês a mês">
          <GraficoMensal serie={r.serieGrafico} mesAtual={mes} />
          <details className="ver-tabela">
            <summary>Ver em tabela</summary>
            <table className="tabela-relatorio">
              <thead>
                <tr><th>Mês</th><th>Renda</th><th>Saídas</th><th>Sobra</th></tr>
              </thead>
              <tbody>
                {r.serieGrafico.map((m) => (
                  <tr key={m.mes}>
                    <td>{nomeDoMes(m.mes)}</td>
                    <td className="num">{formatar(m.renda)}</td>
                    <td className="num">{formatar(m.saidas)}</td>
                    <td className={`num ${m.sobra < 0 ? "negativo" : ""}`}>{formatar(m.sobra)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Cartao>

        <Cartao
          className="c7"
          titulo="Categorias"
          sub={`Gasto lançado em ${rotuloPeriodo}, comparado com os ${meses.length === 1 ? "mês anterior" : `${meses.length} meses anteriores`}.`}
        >
          {r.cats.length === 0 ? (
            <p className="vazio">Nenhuma despesa lançada.</p>
          ) : (
            <ul>
              {r.cats.slice(0, 8).map((c) => {
                const variacao = c.anterior > 0 ? (c.total - c.anterior) / c.anterior : null;
                const acima = c.orcamento > 0 && c.total > c.orcamento;
                return (
                  <li className="cat" key={c.id}>
                    <div className="entre">
                      <span>{c.nome}</span>
                      <span className="num">
                        {formatar(c.total)}
                        {c.orcamento > 0 ? <span className="mudo"> de {formatar(c.orcamento)}</span> : null}
                      </span>
                    </div>
                    <Trilho
                      fino
                      total={maiorCategoria}
                      rotulo={`${c.nome}: ${formatar(c.total)}`}
                      segmentos={[
                        { classe: "seg-casal", valor: acima ? c.orcamento : c.total },
                        { classe: "seg-acima", valor: acima ? c.total - c.orcamento : 0 },
                      ]}
                    />
                    <span className={`rel-variacao ${variacao === null ? "" : variacao > 0.05 ? "subiu" : variacao < -0.05 ? "caiu" : ""}`}>
                      {variacao === null
                        ? "Sem gasto no período anterior"
                        : Math.abs(variacao) < 0.05
                          ? `Estável (${formatar(c.anterior)} antes)`
                          : `${variacao > 0 ? "Subiu" : "Caiu"} ${Math.round(Math.abs(variacao) * 100)}% (${formatar(c.anterior)} antes)`}
                      {acima ? `, ${formatar(c.total - c.orcamento)} acima do orçamento` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>

        <div className="c5 pilha">
          {escopo === "casal" ? <Casal div={r.div} /> : <Individual pessoa={escopo} div={r.div} />}

          <Cartao titulo="Assinaturas" acao={<Link className="ligacao" href="/assinaturas">Ver todas</Link>}>
            {r.assin.itens.length === 0 ? (
              <p className="vazio">Nenhuma assinatura {escopo === "casal" ? "cadastrada" : `com parte de ${nomes[escopo]}`}.</p>
            ) : (
              <>
                <p>
                  <Valor centavos={r.assin.mensal} className="figura" />
                  <span className="mudo"> por mês, {formatar(r.assin.anual)} por ano</span>
                </p>
                <ul className="linhas" style={{ marginTop: 8 }}>
                  {r.assin.itens.slice(0, 4).map((a) => (
                    <li className="linha" key={a.fixa.id} style={{ minHeight: 52 }}>
                      <IconeAssinatura nome={a.fixa.descricao} />
                      <span className="linha-texto">
                        <span className="linha-l1"><span>{a.fixa.descricao}</span></span>
                        {a.fixa.periodicidade === "anual" ? <span className="linha-l2" style={{ display: "block" }}>anual, dividida por 12</span> : null}
                      </span>
                      <span className="num">{formatar(a.mensal)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Cartao>
        </div>

        <Cartao className="c6" titulo="Compromissos dos próximos meses">
          <dl className="conta">
            <div><dt>Contas fixas por mês</dt><dd className="num">{formatar(r.contasMensais)}</dd></div>
            <div><dt>Assinaturas por mês</dt><dd className="num">{formatar(r.assin.mensal)}</dd></div>
            <div><dt>Parcelas nos próximos 6 meses</dt><dd className="num">{formatar(r.parcelasProximas)}</dd></div>
          </dl>
          {r.parcelasProximas > 0 ? (
            <ul className="resumo-linhas" style={{ marginTop: 14 }}>
              {r.futuras.map((m) => (
                <li className="barra-cat" key={m.mes}>
                  <div className="entre pequeno">
                    <span>{nomeDoMes(m.mes)}</span>
                    <span className="num">{m.total > 0 ? formatar(m.total) : "—"}</span>
                  </div>
                  <Trilho fino total={Math.max(...r.futuras.map((x) => x.total), 1)} rotulo={`Parcelas em ${nomeDoMes(m.mes)}: ${formatar(m.total)}`} segmentos={[{ classe: "seg-leve", valor: m.total }]} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="pequeno mudo" style={{ marginTop: 12 }}>Nenhuma parcela a vencer nos próximos seis meses.</p>
          )}
        </Cartao>

        <Cartao className="c6" titulo="Maiores gastos">
          {r.maiores.length === 0 ? (
            <p className="vazio">Nenhuma despesa lançada.</p>
          ) : (
            <ul className="linhas">
              {r.maiores.map(({ lancamento: l, valor }) => (
                <li className="linha sem-midia" key={l.id}>
                  <span className="linha-texto">
                    <span className="linha-l1"><span>{l.descricao || nomeDaCategoria(l.categoria)}</span></span>
                    <span className="linha-l2" style={{ display: "block" }}>
                      {diaCurto(l.data)}, {nomeDaCategoria(l.categoria).toLowerCase()}
                      {escopo !== "casal" && l.deQuem === "casal" ? `, parte de ${nomes[escopo as PessoaId]}` : ""}
                    </span>
                  </span>
                  <span className="num">{formatar(valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </>
  );
}

function Casal({ div }: { div: ReturnType<typeof divisao> }) {
  const { nomes, dados } = useApp();
  const rendaTotal = div.renda.a + div.renda.b;
  const combinadoA = dados.config.parteAPadrao;
  return (
    <Cartao titulo="Entre vocês" acao={<Link className="ligacao" href="/casal">Ver a conta</Link>}>
      <div className="sobra-trilho">
        <p className="pequeno mudo">Renda de cada um</p>
        <Trilho
          total={rendaTotal}
          rotulo={`Renda: ${nomes.a} ${pct(div.renda.a, rendaTotal)}, ${nomes.b} ${pct(div.renda.b, rendaTotal)}`}
          segmentos={[{ classe: "seg-a", valor: div.renda.a }, { classe: "seg-b", valor: div.renda.b }]}
        />
        <ul className="legenda">
          <li><span className="amostra seg-a" /><span className="rotulo">{nomes.a}</span><span className="num">{formatar(div.renda.a)} ({pct(div.renda.a, rendaTotal)})</span></li>
          <li><span className="amostra seg-b" /><span className="rotulo">{nomes.b}</span><span className="num">{formatar(div.renda.b)} ({pct(div.renda.b, rendaTotal)})</span></li>
        </ul>
      </div>

      <div className="sobra-trilho" style={{ marginTop: 18 }}>
        <p className="pequeno mudo">Quem pagou o que é dos dois ({formatar(div.doCasal)})</p>
        <Trilho
          total={div.doCasal}
          rotulo={`${nomes.a} pagou ${pct(div.pagoPor.a, div.doCasal)}, ${nomes.b} pagou ${pct(div.pagoPor.b, div.doCasal)}`}
          segmentos={[{ classe: "seg-a", valor: div.pagoPor.a }, { classe: "seg-b", valor: div.pagoPor.b }]}
        />
        <ul className="legenda">
          <li><span className="amostra seg-a" /><span className="rotulo">{nomes.a}</span><span className="num">{pct(div.pagoPor.a, div.doCasal)}</span></li>
          <li><span className="amostra seg-b" /><span className="rotulo">{nomes.b}</span><span className="num">{pct(div.pagoPor.b, div.doCasal)}</span></li>
        </ul>
        <p className="pequeno mudo">
          A divisão combinada é {combinadoA}% e {100 - combinadoA}%.
          {rendaTotal > 0
            ? ` Pela renda, seria ${Math.round((div.renda.a / rendaTotal) * 100)}% e ${Math.round((div.renda.b / rendaTotal) * 100)}%.`
            : ""}
        </p>
      </div>

      <dl className="conta" style={{ marginTop: 14 }}>
        <div><dt>Gastos só de {nomes.a}</dt><dd className="num">{formatar(div.pessoal.a)}</dd></div>
        <div><dt>Gastos só de {nomes.b}</dt><dd className="num">{formatar(div.pessoal.b)}</dd></div>
        <div className="total">
          <dt>Acerto pendente</dt>
          <dd className="num">
            {div.acerto.devedor && div.acerto.credor
              ? `${nomes[div.acerto.devedor]} deve ${formatar(div.acerto.valor)}`
              : "Quites"}
          </dd>
        </div>
      </dl>
    </Cartao>
  );
}

function Individual({ pessoa, div }: { pessoa: PessoaId; div: ReturnType<typeof divisao> }) {
  const { nomes } = useApp();
  const outra: PessoaId = pessoa === "a" ? "b" : "a";
  const total = div.pessoal[pessoa] + div.parte[pessoa];
  const deve = div.acerto.devedor === pessoa;
  const recebe = div.acerto.credor === pessoa;
  return (
    <Cartao titulo={`Parte de ${nomes[pessoa]}`}>
      <div className="acerto">
        <Avatar pessoa={pessoa} nome={nomes[pessoa]} />
        <div>
          <p className="pequeno mudo">Gasto de {nomes[pessoa]} no período</p>
          <Valor centavos={total} className="figura" />
        </div>
      </div>
      <div className="sobra-trilho" style={{ marginTop: 16 }}>
        <Trilho
          total={total}
          rotulo={`Só de ${nomes[pessoa]} ${formatar(div.pessoal[pessoa])}, parte no que é dos dois ${formatar(div.parte[pessoa])}`}
          segmentos={[{ classe: `seg-${pessoa}`, valor: div.pessoal[pessoa] }, { classe: "seg-casal", valor: div.parte[pessoa] }]}
        />
        <ul className="legenda">
          <li><span className={`amostra seg-${pessoa}`} /><span className="rotulo">Só de {nomes[pessoa]}</span><span className="num">{formatar(div.pessoal[pessoa])}</span></li>
          <li><span className="amostra seg-casal" /><span className="rotulo">Parte no que é dos dois</span><span className="num">{formatar(div.parte[pessoa])}</span></li>
        </ul>
      </div>
      <dl className="conta" style={{ marginTop: 14 }}>
        <div><dt>Pagou do que é dos dois</dt><dd className="num">{formatar(div.pagoPor[pessoa])}</dd></div>
        <div><dt>Parte combinada disso</dt><dd className="num">{formatar(div.parte[pessoa])}</dd></div>
        <div className="total">
          <dt>Acerto</dt>
          <dd className="num">
            {deve ? `Deve ${formatar(div.acerto.valor)} a ${nomes[outra]}` : recebe ? `Recebe ${formatar(div.acerto.valor)} de ${nomes[outra]}` : "Quites"}
          </dd>
        </div>
      </dl>
    </Cartao>
  );
}
