"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Titulo } from "@/componentes/casca";
import { LinhaLancamento } from "@/componentes/linhas";
import { useApp } from "@/componentes/provedor";
import { Avatar, Cartao, Trilho, Valor } from "@/componentes/ui";
import { mesDe, nomeDoMes, nomeDoMesCurto, somarMeses } from "@/lib/datas";
import { formatar } from "@/lib/dinheiro";
import { extratoCasal, faixasDoMes, lancamentosDoMes, saldoCasal } from "@/lib/dominio";

export default function Casal() {
  const { dados, mes, nomes, abrirLancamento } = useApp();
  const saldo = useMemo(() => saldoCasal(dados.lancamentos, mes), [dados.lancamentos, mes]);
  const e = useMemo(() => extratoCasal(dados.lancamentos, mes), [dados.lancamentos, mes]);
  const fx = useMemo(() => faixasDoMes(dados.lancamentos, mes), [dados.lancamentos, mes]);
  const doMes = useMemo(() => lancamentosDoMes(dados.lancamentos, mes), [dados.lancamentos, mes]);

  const cruzadas = doMes.filter((l) => l.tipo === "despesa" && l.deQuem !== l.pagoPor);
  const acertos = dados.lancamentos
    .filter((l) => l.tipo === "acerto" && mesDe(l.data) <= mes)
    .sort((x, y) => y.data.localeCompare(x.data))
    .slice(0, 4);

  // Tudo em "a favor de A": positivo quer dizer que B deve.
  const quemDeve = (v: number) => (v > 0 ? `${nomes.b} deve` : v < 0 ? `${nomes.a} deve` : "Quites");
  const anterior = nomeDoMesCurto(somarMeses(mes, -1));
  const frase = saldo.devedor && saldo.credor
    ? `${nomes[saldo.devedor]} deve ${formatar(saldo.valor)} a ${nomes[saldo.credor]} até o fim de ${nomeDoMesCurto(mes)}.`
    : `Vocês estão quites até o fim de ${nomeDoMesCurto(mes)}.`;

  return (
    <>
      <Titulo titulo="Casal" achado={frase} />

      <div className="grade">
        <div className="c5 pilha">
          <Cartao titulo="Quem deve a quem">
            {saldo.devedor && saldo.credor ? (
              <div className="acerto">
                <Avatar pessoa={saldo.devedor} nome={nomes[saldo.devedor]} />
                <div>
                  <p className="mudo pequeno">{nomes[saldo.devedor]} deve a {nomes[saldo.credor]}</p>
                  <Valor centavos={saldo.valor} className="resposta" />
                </div>
              </div>
            ) : (
              <p className="resposta">Quites</p>
            )}

            <dl className="conta" style={{ marginTop: 20 }}>
              <div>
                <dt>Vinha de {anterior}</dt>
                <dd className="num">{e.anterior === 0 ? "Quites" : `${quemDeve(e.anterior)} ${formatar(Math.abs(e.anterior))}`}</dd>
              </div>
              <div>
                <dt>{nomes.a} pagou por {nomes.b}</dt>
                <dd className="num">{formatar(e.aPagouPorB)}</dd>
              </div>
              <div>
                <dt>{nomes.b} pagou por {nomes.a}</dt>
                <dd className="num">{formatar(e.bPagouPorA)}</dd>
              </div>
              {e.acertosDeA + e.acertosDeB > 0 ? (
                <div>
                  <dt>Acertos no mês</dt>
                  <dd className="num">
                    {[e.acertosDeA > 0 ? `${nomes.a} ${formatar(e.acertosDeA)}` : "", e.acertosDeB > 0 ? `${nomes.b} ${formatar(e.acertosDeB)}` : ""].filter(Boolean).join(", ")}
                  </dd>
                </div>
              ) : null}
              <div className="total">
                <dt>No fim de {nomeDoMesCurto(mes)}</dt>
                <dd className="num">{e.atual === 0 ? "Quites" : `${quemDeve(e.atual)} ${formatar(Math.abs(e.atual))}`}</dd>
              </div>
            </dl>

            {saldo.devedor ? (
              <div className="cartao-pe">
                <button
                  type="button"
                  className="botao primario largo"
                  onClick={() => abrirLancamento({ modo: "novo", tipo: "acerto", valor: saldo.valor, pagoPor: saldo.devedor ?? undefined })}
                >
                  Registrar acerto
                </button>
              </div>
            ) : null}
          </Cartao>

          <Cartao titulo="Acertos feitos">
            {acertos.length === 0 ? (
              <p className="vazio">Nenhum acerto registrado até {nomeDoMes(mes)}.</p>
            ) : (
              <ul className="linhas">
                {acertos.map((l) => (
                  <LinhaLancamento key={l.id} l={l} comData />
                ))}
              </ul>
            )}
          </Cartao>
        </div>

        <div className="c7 pilha">
          <Cartao titulo={`De quem foi o gasto de ${nomeDoMesCurto(mes)}`}>
            {fx.total === 0 ? (
              <p className="vazio">Nenhuma despesa lançada em {nomeDoMes(mes)}.</p>
            ) : (
              <div className="sobra-trilho">
                <Trilho
                  total={fx.total}
                  rotulo={`Só ${nomes.a} ${formatar(fx.a)}, nosso ${formatar(fx.casal)}, só ${nomes.b} ${formatar(fx.b)}`}
                  segmentos={[
                    { classe: "seg-a", valor: fx.a },
                    { classe: "seg-casal", valor: fx.casal },
                    { classe: "seg-b", valor: fx.b },
                  ]}
                />
                <div className="faixas">
                  <div className="faixa fa">
                    <p className="faixa-nome">Só {nomes.a}</p>
                    <p className="faixa-valor num">{formatar(fx.a)}</p>
                    <p className="faixa-nota">{Math.round((fx.a / fx.total) * 100)}% do gasto</p>
                  </div>
                  <div className="faixa">
                    <p className="faixa-nome">Nosso</p>
                    <p className="faixa-valor num">{formatar(fx.casal)}</p>
                    <p className="faixa-nota">{Math.round((fx.casal / fx.total) * 100)}% do gasto</p>
                  </div>
                  <div className="faixa fb">
                    <p className="faixa-nome">Só {nomes.b}</p>
                    <p className="faixa-valor num">{formatar(fx.b)}</p>
                    <p className="faixa-nota">{Math.round((fx.b / fx.total) * 100)}% do gasto</p>
                  </div>
                </div>
                <p className="mudo pequeno">
                  Do que é nosso, {nomes.a} pagou {formatar(fx.casalPagoA)} e {nomes.b} pagou {formatar(fx.casalPagoB)}.
                  A divisão padrão é {dados.config.parteAPadrao}% e {100 - dados.config.parteAPadrao}%.{" "}
                  <Link className="ligacao" href="/ajustes#divisao">Mudar</Link>
                </p>
              </div>
            )}
          </Cartao>

          <Cartao
            titulo="O que entrou na conta"
            acao={cruzadas.length > 5 ? <Link className="ligacao" href="/lancamentos">Ver as {cruzadas.length}</Link> : undefined}
            sub={`Despesas de ${nomeDoMesCurto(mes)} que um pagou e são do outro ou dos dois.`}
          >
            {cruzadas.length === 0 ? (
              <p className="vazio">Em {nomeDoMes(mes)}, ninguém pagou nada pelo outro.</p>
            ) : (
              <ul className="linhas">
                {cruzadas.slice(0, 5).map((l) => (
                  <LinhaLancamento key={l.id} l={l} comData />
                ))}
              </ul>
            )}
          </Cartao>
        </div>
      </div>
    </>
  );
}
