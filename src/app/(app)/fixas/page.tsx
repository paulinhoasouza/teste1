"use client";

import { Plus } from "lucide-react";
import { useMemo } from "react";
import { Titulo } from "@/componentes/casca";
import { LinhaConta } from "@/componentes/linhas";
import { useApp } from "@/componentes/provedor";
import { Cartao, Trilho, Valor } from "@/componentes/ui";
import { nomeDoMes, nomeDoMesCurto } from "@/lib/datas";
import { formatar } from "@/lib/dinheiro";
import { fixasDoMes } from "@/lib/dominio";

export default function Fixas() {
  const { dados, mes, hoje, abrirFixa } = useApp();
  const contas = useMemo(() => fixasDoMes(dados.fixas, dados.lancamentos, mes, hoje), [dados, mes, hoje]);
  const porPagar = (x: (typeof contas)[number]) => (x.estado === "paga" ? 1 : 0);
  const aPagar = contas.filter((c) => c.fixa.tipo === "despesa").sort((x, y) => porPagar(x) - porPagar(y));
  const aReceber = contas.filter((c) => c.fixa.tipo === "receita");
  const pausadas = dados.fixas.filter((f) => !f.ativa);

  const soma = (lista: typeof contas, pagas: boolean) =>
    lista.filter((c) => (c.estado === "paga") === pagas).reduce((s, c) => s + c.valor, 0);
  const pago = soma(aPagar, true);
  const falta = soma(aPagar, false);
  const recebido = soma(aReceber, true);
  const entra = soma(aReceber, false);
  const pendentes = aPagar.filter((c) => c.estado !== "paga").length;

  const frase =
    contas.length === 0
      ? "Cadastre uma vez o que se repete todo mês."
      : pendentes === 0
        ? `Todas as contas de ${nomeDoMesCurto(mes)} estão pagas.`
        : `${pendentes === 1 ? "Falta 1 conta" : `Faltam ${pendentes} contas`} em ${nomeDoMesCurto(mes)}, ${formatar(falta)} no total.`;

  return (
    <>
      <Titulo
        titulo="Contas fixas"
        achado={frase}
        acao={
          <button type="button" className="botao primario" onClick={() => abrirFixa({ fixa: null })}>
            <Plus size={18} strokeWidth={2} />
            Nova conta fixa
          </button>
        }
      />

      <div className="grade">
        <Cartao className="c7" titulo="A pagar" sub={aPagar.length > 0 ? `${aPagar.length - pendentes} de ${aPagar.length} pagas em ${nomeDoMes(mes)}` : undefined}>
          {aPagar.length === 0 ? (
            <p className="vazio">
              Aluguel, internet, academia: o que vence todo mês.{" "}
              <button type="button" onClick={() => abrirFixa({ fixa: null })}>Criar a primeira</button>
            </p>
          ) : (
            <ul className="linhas">
              {aPagar.map((c) => (
                <LinhaConta key={c.fixa.id} c={c} />
              ))}
            </ul>
          )}
        </Cartao>

        <div className="c5 pilha">
          <Cartao titulo="Quanto falta">
            <Valor centavos={falta} className="resposta" />
            <p className="mudo" style={{ marginBottom: 16 }}>ainda por pagar em {nomeDoMesCurto(mes)}</p>
            <div className="sobra-trilho">
              <Trilho
                total={pago + falta}
                rotulo={`${formatar(pago)} pagos de ${formatar(pago + falta)}`}
                segmentos={[{ classe: "seg-casal", valor: pago }]}
              />
              <div className="pontas">
                <span>Pago <strong className="num">{formatar(pago)}</strong></span>
                <span>Total do mês <strong className="num">{formatar(pago + falta)}</strong></span>
              </div>
            </div>
          </Cartao>

          <Cartao titulo="A receber" sub={aReceber.length > 0 ? `${formatar(recebido)} já entraram, ${formatar(entra)} por entrar` : undefined}>
            {aReceber.length === 0 ? (
              <p className="vazio">Cadastre os salários aqui para a sobra do mês contar com eles.</p>
            ) : (
              <ul className="linhas">
                {aReceber.map((c) => (
                  <LinhaConta key={c.fixa.id} c={c} />
                ))}
              </ul>
            )}
          </Cartao>

          {pausadas.length > 0 ? (
            <Cartao titulo="Pausadas">
              <ul className="linhas">
                {pausadas.map((f) => (
                  <li className="linha sem-midia" key={f.id}>
                    <div className="linha-texto">
                      <div className="linha-l1"><span>{f.descricao}</span></div>
                      <div className="linha-l2">Dia {f.dia}</div>
                    </div>
                    <div className="linha-fim">
                      <span className="num mudo">{formatar(f.valor)}</span>
                      <span className="linha-acao">
                        <button type="button" className="botao menor" onClick={() => abrirFixa({ fixa: f })}>Editar</button>
                      </span>
                    </div>
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
