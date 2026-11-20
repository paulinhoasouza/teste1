"use client";

import { Plus } from "lucide-react";
import { useMemo } from "react";
import { Titulo } from "@/componentes/casca";
import { LinhaConta, LinhaFixaFora } from "@/componentes/linhas";
import { useApp } from "@/componentes/provedor";
import { Cartao, Trilho, Valor } from "@/componentes/ui";
import { nomeDoMes, nomeDoMesCurto } from "@/lib/datas";
import { formatar } from "@/lib/dinheiro";
import { fixaNoMes, fixasDoMes } from "@/lib/dominio";

export default function Fixas() {
  const { dados, mes, hoje, nomes, abrirFixa } = useApp();
  const contas = useMemo(() => fixasDoMes(dados.fixas, dados.lancamentos, mes, hoje), [dados, mes, hoje]);
  const porPagar = (x: (typeof contas)[number]) => (x.estado === "paga" ? 1 : 0);
  const aPagar = contas.filter((c) => c.fixa.tipo === "despesa").sort((x, y) => porPagar(x) - porPagar(y));
  const aReceber = contas.filter((c) => c.fixa.tipo === "receita");
  const fora = dados.fixas.filter((f) => !fixaNoMes(f, mes));
  // Quem ainda não tem salário cadastrado (receita fixa só dela) neste mês.
  const semSalario = (["a", "b"] as const).filter((p) => !aReceber.some((c) => c.fixa.deQuem === p));

  const soma = (lista: typeof contas, pagas: boolean) =>
    lista.filter((c) => (c.estado === "paga") === pagas).reduce((s, c) => s + c.valor, 0);
  const pago = soma(aPagar, true);
  const falta = soma(aPagar, false);
  const recebido = soma(aReceber, true);
  const simulado = aReceber.filter((c) => c.simulado).reduce((s, c) => s + c.valor, 0);
  const porEntrar = soma(aReceber, false) - simulado;
  const pendentes = aPagar.filter((c) => c.estado !== "paga").length;
  const resumoDaRenda = [
    recebido > 0 ? `${formatar(recebido)} confirmados` : "",
    simulado > 0 ? `${formatar(simulado)} simulados` : "",
    porEntrar > 0 ? `${formatar(porEntrar)} por entrar` : "",
  ].filter(Boolean).join(", ") + ".";

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

          <Cartao
            titulo="Renda do mês"
            acao={
              <button type="button" className="ligacao" style={{ background: "none", border: 0, padding: 0 }} onClick={() => abrirFixa({ fixa: null, tipo: "receita" })}>
                Adicionar
              </button>
            }
            sub={aReceber.length > 0 ? resumoDaRenda : undefined}
          >
            {aReceber.length > 0 ? (
              <ul className="linhas">
                {aReceber.map((c) => (
                  <LinhaConta key={c.fixa.id} c={c} />
                ))}
              </ul>
            ) : null}
            {semSalario.length > 0 ? (
              <div className="vazio" style={{ marginTop: aReceber.length > 0 ? 12 : 0 }}>
                {semSalario.length === 2
                  ? "Cadastre o salário bruto de cada um: o app simula o líquido e usa na sobra do mês até vocês confirmarem o valor real. "
                  : `Falta o salário de ${nomes[semSalario[0]!]}. `}
                {semSalario.map((p, i) => (
                  <span key={p}>
                    {i > 0 ? " ou " : null}
                    <button type="button" onClick={() => abrirFixa({ fixa: null, tipo: "receita", deQuem: p })}>
                      Salário de {nomes[p]}
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </Cartao>

          {fora.length > 0 ? (
            <Cartao titulo={`Fora de ${nomeDoMesCurto(mes)}`} sub="Pausadas, encerradas ou que ainda vão começar.">
              <ul className="linhas">
                {fora.map((f) => (
                  <LinhaFixaFora key={f.id} f={f} mes={mes} />
                ))}
              </ul>
            </Cartao>
          ) : null}
        </div>
      </div>
    </>
  );
}
