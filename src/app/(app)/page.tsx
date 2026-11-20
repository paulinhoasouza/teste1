"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Titulo } from "@/componentes/casca";
import { LinhaConta, LinhaLancamento, LinhaParcelamento } from "@/componentes/linhas";
import { useApp } from "@/componentes/provedor";
import { Avatar, Cartao, Segmentado, Trilho, Valor, type Segmento } from "@/componentes/ui";
import { diasNoMes, mesDe, nomeDoMes, nomeDoMesCurto } from "@/lib/datas";
import { formatar } from "@/lib/dinheiro";
import {
  extratoCasal, faixasDoMes, fixasDoMes, lancamentosDoMes, parcelamentos, resumoMes, saldoCasal,
  type FixaDoMes, type Resumo,
} from "@/lib/dominio";
import type { Dono } from "@/lib/tipos";

function achado(r: Resumo, contas: FixaDoMes[], mes: string, mesAtual: string): string {
  const estouro = r.categorias
    .filter((c) => c.orcamento > 0 && c.gasto > c.orcamento)
    .sort((x, y) => y.gasto - y.orcamento - (x.gasto - x.orcamento))[0];
  if (estouro) {
    return `${estouro.categoria.nome} passou ${formatar(estouro.gasto - estouro.orcamento)} do planejado.`;
  }
  const atrasadas = contas.filter((c) => c.estado === "atrasada" && c.fixa.tipo === "despesa");
  if (atrasadas.length === 1) return `${atrasadas[0]!.fixa.descricao} venceu e ainda não foi paga.`;
  if (atrasadas.length > 1) return `${atrasadas.length} contas venceram e ainda não foram pagas.`;
  const salarioPendente = contas.find((c) => c.simulado && (c.estado === "atrasada" || c.estado === "hoje"));
  if (salarioPendente) {
    return `${salarioPendente.fixa.descricao} ${salarioPendente.estado === "hoje" ? "cai hoje" : "já devia ter caído"}: confirme o valor líquido.`;
  }
  if (r.sobra < 0) return `O mês fecha ${formatar(-r.sobra)} no vermelho se nada mudar.`;
  const aPagar = contas.filter((c) => c.estado !== "paga" && c.fixa.tipo === "despesa");
  if (aPagar.length > 0) {
    return `${aPagar.length === 1 ? "Falta 1 conta" : `Faltam ${aPagar.length} contas`} para pagar, ${formatar(r.aPagar)} no total.`;
  }
  if (mes < mesAtual) return "Mês fechado.";
  return contas.length > 0 ? "Todas as contas do mês estão pagas." : "Nenhuma conta fixa cadastrada ainda.";
}

export default function Inicio() {
  const { dados, mes, hoje, nomes, abrirLancamento } = useApp();
  const [escopo, setEscopo] = useState<Dono>("casal");
  const mesAtual = mesDe(hoje);

  const casal = useMemo(() => resumoMes(dados, mes, "casal", hoje), [dados, mes, hoje]);
  const r = useMemo(
    () => (escopo === "casal" ? casal : resumoMes(dados, mes, escopo, hoje)),
    [casal, dados, mes, escopo, hoje],
  );
  const fx = useMemo(() => faixasDoMes(dados.lancamentos, mes), [dados.lancamentos, mes]);
  const todasDoMes = useMemo(() => fixasDoMes(dados.fixas, dados.lancamentos, mes, hoje), [dados, mes, hoje]);
  // Assinaturas cobram sozinhas e têm tela própria; aqui entram só como um resumo.
  const contas = todasDoMes.filter((c) => c.fixa.natureza !== "assinatura");
  const assinaturasDoMes = todasDoMes.filter((c) => c.fixa.natureza === "assinatura");
  const assinaturasPendentes = assinaturasDoMes.filter((c) => c.estado !== "paga");
  const saldo = useMemo(() => saldoCasal(dados.lancamentos, mes), [dados.lancamentos, mes]);
  const extrato = useMemo(() => extratoCasal(dados.lancamentos, mes), [dados.lancamentos, mes]);
  const ultimos = useMemo(() => lancamentosDoMes(dados.lancamentos, mes).slice(0, 5), [dados.lancamentos, mes]);
  const parcelas = useMemo(() => parcelamentos(dados.lancamentos, mes).slice(0, 5), [dados.lancamentos, mes]);

  const segmentos: (Segmento & { rotulo: string })[] =
    escopo === "casal"
      ? [
          { classe: "seg-a", valor: fx.a, rotulo: `Só ${nomes.a}` },
          { classe: "seg-casal", valor: fx.casal, rotulo: "Nosso" },
          { classe: "seg-b", valor: fx.b, rotulo: `Só ${nomes.b}` },
          { classe: "seg-pendente", valor: r.aPagar, rotulo: "Contas a pagar" },
        ]
      : [
          { classe: `seg-${escopo}`, valor: fx[escopo], rotulo: `Só ${nomes[escopo]}` },
          { classe: "seg-casal", valor: r.gasto - fx[escopo], rotulo: "Parte no que é nosso" },
          { classe: "seg-pendente", valor: r.aPagar, rotulo: "Contas a pagar" },
        ];

  const fimDoMes = `${diasNoMes(mes)} de ${nomeDoMesCurto(mes)}`;
  const sobraNota =
    r.renda === 0 && r.gasto === 0
      ? "Nada lançado neste mês."
      : r.sobra < 0
        ? `Faltam ${formatar(-r.sobra)} para fechar o mês.`
        : mes < mesAtual
          ? "Foi o que sobrou no mês."
          : mes > mesAtual
            ? "Previsão com as contas fixas e as parcelas."
            : `${formatar(r.porDia)} por dia até ${fimDoMes}.`;

  const pendentes = contas.filter((c) => c.estado !== "paga");
  const contasNaTela = [...pendentes, ...contas.filter((c) => c.estado === "paga")].slice(0, 5);
  const pagas = contas.length - pendentes.length;

  return (
    <>
      <Titulo titulo={nomeDoMes(mes)} achado={achado(casal, contas, mes, mesAtual)} mesNoTitulo />

      <div className="grade">
        <Cartao
          className="c7"
          titulo="Sobra do mês"
          acao={
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
          }
        >
          <div className="sobra-corpo">
            <div>
              <Valor centavos={r.sobra} className={`resposta ${r.sobra < 0 ? "negativo" : ""}`} />
              <p className="mudo">{sobraNota}</p>
              {r.aReceberSimulado > 0 ? (
                <p className="pequeno" style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="pilula aviso">Simulado</span>
                  <span className="mudo">
                    Inclui {formatar(r.aReceberSimulado)} de salário ainda não confirmado.{" "}
                    <Link className="ligacao" href="/fixas">Confirmar</Link>
                  </span>
                </p>
              ) : null}
            </div>
            <div className="sobra-trilho">
              <div className="pontas">
                <span>Gasto <strong className="num">{formatar(r.gasto)}</strong></span>
                <span>{r.aReceber > 0 ? "Renda prevista" : "Renda"} <strong className="num">{formatar(r.renda)}</strong></span>
              </div>
              <Trilho
                segmentos={segmentos}
                total={r.renda}
                rotulo={`Gasto ${formatar(r.gasto)} e contas a pagar ${formatar(r.aPagar)}, de uma renda de ${formatar(r.renda)}`}
              />
              <ul className="legenda">
                {segmentos.map((s) => (
                  <li key={s.rotulo}>
                    <span className={`amostra ${s.classe}`} />
                    <span className="rotulo">{s.rotulo}</span>
                    <span className="num">{formatar(s.valor)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Cartao>

        <Cartao className="c5" titulo="Acerto do casal" acao={<Link className="ligacao" href="/casal">Ver a conta</Link>}>
          {saldo.devedor && saldo.credor ? (
            <>
              <div className="acerto-bloco">
                <div className="acerto">
                  <Avatar pessoa={saldo.devedor} nome={nomes[saldo.devedor]} />
                  <div>
                    <p className="mudo pequeno">{nomes[saldo.devedor]} deve a {nomes[saldo.credor]}</p>
                    <Valor centavos={saldo.valor} className="figura" />
                  </div>
                </div>
              </div>
              <dl className="conta pequeno" style={{ marginTop: 16 }}>
                <div><dt>{nomes.a} pagou por {nomes.b} em {nomeDoMesCurto(mes)}</dt><dd className="num">{formatar(extrato.aPagouPorB)}</dd></div>
                <div><dt>{nomes.b} pagou por {nomes.a} em {nomeDoMesCurto(mes)}</dt><dd className="num">{formatar(extrato.bPagouPorA)}</dd></div>
              </dl>
              <div className="cartao-pe">
                <button
                  type="button"
                  className="botao largo"
                  onClick={() => abrirLancamento({ modo: "novo", tipo: "acerto", valor: saldo.valor, pagoPor: saldo.devedor ?? undefined })}
                >
                  Registrar acerto
                </button>
              </div>
            </>
          ) : (
            <div className="acerto-bloco">
              <p className="figura">Vocês estão quites</p>
              <p className="mudo pequeno">Ninguém deve nada até o fim de {nomeDoMesCurto(mes)}.</p>
            </div>
          )}
        </Cartao>

        <div className="c7 pilha solta">
          <Cartao className="ordem-2" titulo="Gasto por categoria" acao={<Link className="ligacao" href="/ajustes#categorias">Orçamentos</Link>}>
            {casal.categorias.length === 0 ? (
              <p className="vazio">Nenhuma despesa lançada em {nomeDoMes(mes)}.</p>
            ) : (
              <ul>
                {casal.categorias.slice(0, 6).map((c) => {
                  const acima = c.orcamento > 0 && c.gasto > c.orcamento;
                  return (
                    <li className="cat" key={c.categoria.id}>
                      <div className="entre">
                        <span>{c.categoria.nome}</span>
                        <span className="num">
                          {formatar(c.gasto)}
                          <span className="mudo">{c.orcamento > 0 ? ` de ${formatar(c.orcamento)}` : " sem orçamento"}</span>
                        </span>
                      </div>
                      {c.orcamento > 0 ? (
                        <Trilho
                          fino
                          total={Math.max(c.orcamento, c.gasto)}
                          rotulo={`${formatar(c.gasto)} de ${formatar(c.orcamento)} planejados`}
                          segmentos={[
                            { classe: "seg-casal", valor: Math.min(c.gasto, c.orcamento) },
                            { classe: "seg-acima", valor: Math.max(0, c.gasto - c.orcamento) },
                          ]}
                        />
                      ) : null}
                      {acima ? (
                        <p className="pequeno negativo">{formatar(c.gasto - c.orcamento)} acima do planejado</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Cartao>

          <Cartao className="ordem-3" titulo="Últimos lançamentos" acao={<Link className="ligacao" href="/lancamentos">Ver todos</Link>}>
            {ultimos.length === 0 ? (
              <p className="vazio">
                Nada lançado em {nomeDoMes(mes)}.{" "}
                <button type="button" onClick={() => abrirLancamento({ modo: "novo" })}>Lançar o primeiro</button>
              </p>
            ) : (
              <ul className="linhas">
                {ultimos.map((l) => (
                  <LinhaLancamento key={l.id} l={l} comData />
                ))}
              </ul>
            )}
          </Cartao>
        </div>

        <div className="c5 pilha solta">
          <Cartao
            className="ordem-1"
            titulo="Contas do mês"
            acao={<Link className="ligacao" href="/fixas">Ver todas</Link>}
            sub={contas.length > 0 ? `${pagas} de ${contas.length} resolvidas` : undefined}
          >
            {contas.length === 0 ? (
              <p className="vazio">
                Cadastre aluguel, internet e salários uma vez só. <Link href="/fixas">Criar conta fixa</Link>
              </p>
            ) : (
              <ul className="linhas">
                {contasNaTela.map((c) => (
                  <LinhaConta key={c.fixa.id} c={c} />
                ))}
              </ul>
            )}
            {assinaturasDoMes.length > 0 ? (
              <Link href="/assinaturas" className="linha sem-midia" style={{ borderTop: "0.5px solid var(--separator)", minHeight: 52 }}>
                <span className="linha-texto">
                  <span className="linha-l1"><span>Assinaturas</span></span>
                  <span className="linha-l2" style={{ display: "block" }}>
                    {assinaturasPendentes.length === 0
                      ? `${assinaturasDoMes.length} cobradas em ${nomeDoMesCurto(mes)}`
                      : `${assinaturasPendentes.length} de ${assinaturasDoMes.length} ainda por cobrar`}
                  </span>
                </span>
                <span className="num">{formatar(assinaturasDoMes.reduce((s, c) => s + c.valor, 0))}</span>
              </Link>
            ) : null}
          </Cartao>

          <Cartao className="ordem-4" titulo="Compras parceladas">
            {parcelas.length === 0 ? (
              <p className="vazio">Nenhuma parcela a vencer de {nomeDoMesCurto(mes)} em diante.</p>
            ) : (
              <ul className="linhas">
                {parcelas.map((p) => (
                  <LinhaParcelamento key={p.grupo} p={p} />
                ))}
              </ul>
            )}
          </Cartao>
        </div>
      </div>
    </>
  );
}
