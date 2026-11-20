"use client";

import { Plus } from "lucide-react";
import { useMemo } from "react";
import { Titulo } from "@/componentes/casca";
import { IconeAssinatura } from "@/componentes/assinatura";
import { useApp } from "@/componentes/provedor";
import { Cartao, Trilho, Valor } from "@/componentes/ui";
import { mesDe, nomeDoMes, nomeDoMesCurto, somarMeses } from "@/lib/datas";
import { formatar } from "@/lib/dinheiro";
import { fixasDoMes, fixaVigente, peso, resumoMes, valorMensal } from "@/lib/dominio";
import { previstoDa } from "@/lib/salario";
import type { Fixa } from "@/lib/tipos";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Próximo mês "yyyy-mm" em que uma assinatura anual cobra, a partir de um mês. */
function proximaCobranca(f: Fixa, aPartirDe: string): string {
  for (let i = 0; i < 12; i++) {
    const m = somarMeses(aPartirDe, i);
    if (Number(m.slice(5, 7)) === f.mesAnual) return m;
  }
  return aPartirDe;
}

export default function Assinaturas() {
  const { dados, mes, hoje, nomes, abrirFixa, executar } = useApp();

  const ativas = useMemo(
    () =>
      dados.fixas
        .filter((f) => f.natureza === "assinatura" && fixaVigente(f, mes))
        .sort((x, y) => valorMensal(y) - valorMensal(x)),
    [dados.fixas, mes],
  );
  const encerradas = dados.fixas.filter((f) => f.natureza === "assinatura" && !fixaVigente(f, mes));
  const doMes = useMemo(
    () => fixasDoMes(dados.fixas, dados.lancamentos, mes, hoje).filter((c) => c.fixa.natureza === "assinatura"),
    [dados, mes, hoje],
  );
  const pendentes = doMes.filter((c) => c.estado !== "paga");
  const anuais = ativas.filter((f) => f.periodicidade === "anual");

  const mensal = ativas.reduce((s, f) => s + valorMensal(f), 0);
  const porPessoa = {
    a: ativas.reduce((s, f) => s + peso({ ...f, valor: valorMensal(f) }, "a"), 0),
    b: ativas.reduce((s, f) => s + peso({ ...f, valor: valorMensal(f) }, "b"), 0),
  };
  const renda = resumoMes(dados, mes, "casal", hoje).renda;
  const fatiaDaRenda = renda > 0 ? Math.round((mensal / renda) * 100) : null;

  const marcarTodas = () =>
    executar(
      { acao: "fixas.pagarMes", mes, ids: pendentes.map((c) => c.fixa.id) },
      pendentes.length === 1 ? "Assinatura marcada como paga" : `${pendentes.length} assinaturas marcadas como pagas`,
    );
  const nova = () => abrirFixa({ fixa: null, tipo: "despesa", natureza: "assinatura" });

  const achado =
    ativas.length === 0
      ? "Streaming, jogos, apps e serviços que cobram sozinhos todo mês ou todo ano."
      : `${formatar(mensal)} por mês, ${formatar(mensal * 12)} por ano, em ${ativas.length === 1 ? "1 assinatura" : `${ativas.length} assinaturas`}.`;

  return (
    <>
      <Titulo
        titulo="Assinaturas"
        achado={achado}
        acao={
          <button type="button" className="botao primario" onClick={nova}>
            <Plus size={18} strokeWidth={2.25} />
            Nova assinatura
          </button>
        }
      />

      <div className="grade topo">
        <Cartao className="c7" titulo="Suas assinaturas" sub={anuais.length > 0 ? "As anuais aparecem também pelo custo de cada mês." : undefined}>
          {ativas.length === 0 ? (
            <p className="vazio">
              Cadastre uma vez e o app lembra de cada cobrança, soma o custo por mês e mostra quanto da renda vai para elas.{" "}
              <button type="button" onClick={nova}>Adicionar a primeira</button>
            </p>
          ) : (
            <ul className="linhas">
              {ativas.map((f) => {
                const anual = f.periodicidade === "anual";
                const quem = f.deQuem === "casal" ? `dos dois, ${nomes[f.pagoPor]} paga` : `de ${nomes[f.deQuem]}`;
                const quando = anual ? `Anual, cobra em ${MESES[f.mesAnual - 1]}` : `Todo mês, dia ${f.dia}`;
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      className="linha"
                      aria-label={`${f.descricao}, ${formatar(previstoDa(f))} ${anual ? "por ano" : "por mês"}. Editar`}
                      onClick={() => abrirFixa({ fixa: f })}
                    >
                      <IconeAssinatura nome={f.descricao} />
                      <span className="linha-texto">
                        <span className="linha-l1"><span>{f.descricao}</span></span>
                        <span className="linha-l2" style={{ display: "block" }}>{quando}, {quem}</span>
                      </span>
                      <span style={{ textAlign: "right" }}>
                        <span className="num" style={{ display: "block" }}>{formatar(previstoDa(f))}</span>
                        <span className="linha-l2 num" style={{ display: "block" }}>
                          {anual ? `${formatar(valorMensal(f))} por mês` : "por mês"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>

        <div className="c5 pilha">
          <Cartao titulo="Quanto custam">
            <Valor centavos={mensal} className="resposta" />
            <p className="mudo">por mês, {formatar(mensal * 12)} por ano</p>
            {mensal > 0 ? (
              <div className="sobra-trilho" style={{ marginTop: 18 }}>
                <Trilho
                  total={mensal}
                  rotulo={`Parte de ${nomes.a} ${formatar(porPessoa.a)}, parte de ${nomes.b} ${formatar(porPessoa.b)}`}
                  segmentos={[
                    { classe: "seg-a", valor: porPessoa.a },
                    { classe: "seg-b", valor: porPessoa.b },
                  ]}
                />
                <ul className="legenda">
                  <li><span className="amostra seg-a" /><span className="rotulo">Parte de {nomes.a}</span><span className="num">{formatar(porPessoa.a)}</span></li>
                  <li><span className="amostra seg-b" /><span className="rotulo">Parte de {nomes.b}</span><span className="num">{formatar(porPessoa.b)}</span></li>
                </ul>
                {fatiaDaRenda !== null ? (
                  <p className="pequeno mudo">É {fatiaDaRenda}% da renda de vocês em {nomeDoMesCurto(mes)}.</p>
                ) : null}
              </div>
            ) : null}
          </Cartao>

          <Cartao
            titulo={`Cobranças de ${nomeDoMesCurto(mes)}`}
            sub={doMes.length > 0 ? `${doMes.length - pendentes.length} de ${doMes.length} pagas` : undefined}
          >
            {doMes.length === 0 ? (
              <p className="vazio">Nenhuma assinatura cobra em {nomeDoMes(mes)}.</p>
            ) : (
              <>
                <ul className="linhas">
                  {doMes.map((c) => (
                    <li className="linha" key={c.fixa.id}>
                      <IconeAssinatura nome={c.fixa.descricao} />
                      <div className="linha-texto">
                        <div className="linha-l1"><span>{c.fixa.descricao}</span></div>
                        <div className={`linha-l2 ${c.estado === "atrasada" ? "atencao" : ""}`}>
                          {c.estado === "paga" ? "Paga" : c.estado === "atrasada" ? `Cobrou dia ${c.fixa.dia}` : `Cobra dia ${c.fixa.dia}`}
                        </div>
                      </div>
                      <span className={`num ${c.estado === "paga" ? "mudo" : ""}`}>{formatar(c.valor)}</span>
                    </li>
                  ))}
                </ul>
                {pendentes.length > 0 ? (
                  <div className="cartao-pe">
                    <button type="button" className="botao largo" onClick={() => void marcarTodas()}>
                      {pendentes.length === 1 ? "Marcar como paga" : `Marcar as ${pendentes.length} como pagas`}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </Cartao>

          {anuais.length > 0 ? (
            <Cartao titulo="Próximas anuais">
              <ul className="linhas">
                {anuais
                  .map((f) => ({ f, quando: proximaCobranca(f, mesDe(hoje)) }))
                  .sort((x, y) => x.quando.localeCompare(y.quando))
                  .map(({ f, quando }) => (
                    <li className="linha sem-midia" key={f.id}>
                      <div className="linha-texto">
                        <div className="linha-l1"><span>{f.descricao}</span></div>
                        <div className="linha-l2">Em {nomeDoMes(quando)}</div>
                      </div>
                      <span className="num">{formatar(previstoDa(f))}</span>
                    </li>
                  ))}
              </ul>
            </Cartao>
          ) : null}

          {encerradas.length > 0 ? (
            <Cartao titulo="Canceladas ou pausadas">
              <ul className="linhas">
                {encerradas.map((f) => (
                  <li key={f.id}>
                    <button type="button" className="linha" onClick={() => abrirFixa({ fixa: f })}>
                      <IconeAssinatura nome={f.descricao} />
                      <span className="linha-texto">
                        <span className="linha-l1"><span>{f.descricao}</span></span>
                        <span className="linha-l2" style={{ display: "block" }}>
                          {!f.ativa ? "Pausada" : f.fim ? `Terminou em ${nomeDoMes(f.fim)}` : `Começa em ${nomeDoMes(f.inicio)}`}
                        </span>
                      </span>
                      <span className="num mudo">{formatar(previstoDa(f))}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Cartao>
          ) : null}
        </div>
      </div>
    </>
  );
}
