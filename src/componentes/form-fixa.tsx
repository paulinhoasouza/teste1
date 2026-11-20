"use client";

import { Minus, Plus, X } from "lucide-react";
import { useState } from "react";
import { mesDe } from "@/lib/datas";
import { formatar } from "@/lib/dinheiro";
import { simular } from "@/lib/salario";
import type { Dono, Fixa, Natureza, Periodicidade, PessoaId, Regime, TipoCategoria } from "@/lib/tipos";
import { CampoMes, CampoValor, EscolhaDono, EscolhaPessoa } from "./campos";
import { Folha } from "./folha";
import { useApp, type PedidoDeFixa } from "./provedor";
import { QuadroSimulacao } from "./simulacao";
import { Segmentado } from "./ui";

export function FormFixa() {
  const { pedidoFixa, abrirFixa } = useApp();
  return (
    <Folha aberta={!!pedidoFixa} aoFechar={() => abrirFixa(null)} rotuloId="titulo-fixa">
      {pedidoFixa ? <Corpo pedido={pedidoFixa} fechar={() => abrirFixa(null)} /> : null}
    </Folha>
  );
}

type Informar = "bruto" | "liquido";

/** Nomes comuns, para não precisar digitar. O preço muda: cada um informa o seu. */
const SUGESTOES = [
  "Netflix", "Spotify", "Disney+", "Max", "Prime Video", "Globoplay", "YouTube Premium",
  "Apple One", "iCloud+", "PS Plus", "Xbox Game Pass", "Nintendo Switch Online",
  "Claude", "ChatGPT", "Google One", "Microsoft 365",
];

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function Corpo({ pedido, fechar }: { pedido: PedidoDeFixa; fechar: () => void }) {
  const { dados, quem, nomes, hoje, executar } = useApp();
  const fixa: Fixa | null = pedido.fixa;
  const natureza: Natureza = fixa?.natureza ?? pedido.natureza ?? "conta";
  const assinatura = natureza === "assinatura";
  const [tipo, setTipo] = useState<TipoCategoria>(fixa?.tipo ?? (assinatura ? "despesa" : pedido.tipo) ?? "despesa");
  const [descricao, setDescricao] = useState(fixa?.descricao ?? "");
  const [valor, setValor] = useState(fixa?.valor ?? 0);
  const [dia, setDia] = useState(String(fixa?.dia ?? (pedido.tipo === "receita" ? 5 : 10)));
  const categoriaPadrao = (id: string) => dados.categorias.find((c) => c.id === id && !c.arquivada)?.id ?? "";
  const [categoria, setCategoria] = useState(
    fixa?.categoria ?? (assinatura ? categoriaPadrao("assinaturas") : pedido.tipo === "receita" ? categoriaPadrao("salario") : ""),
  );
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>(fixa?.periodicidade ?? "mensal");
  const [mesAnual, setMesAnual] = useState(fixa?.mesAnual || Number(hoje.slice(5, 7)));
  const [pagoPor, setPagoPor] = useState<PessoaId>(fixa?.pagoPor ?? quem);
  const [deQuem, setDeQuem] = useState<Dono>(fixa?.deQuem ?? pedido.deQuem ?? (pedido.tipo === "receita" ? quem : "casal"));
  const [parteA, setParteA] = useState(fixa?.parteA ?? dados.config.parteAPadrao);
  const [ativa, setAtiva] = useState(fixa?.ativa ?? true);
  // Conta nova começa no mês de hoje, para não aparecer como atrasada nos meses anteriores.
  const [inicio, setInicio] = useState(fixa ? fixa.inicio : mesDe(hoje));
  const [fim, setFim] = useState(fixa?.fim ?? "");
  const [informar, setInformar] = useState<Informar>(fixa && fixa.bruto === 0 ? "liquido" : "bruto");
  const [bruto, setBruto] = useState(fixa?.bruto ?? 0);
  const [regime, setRegime] = useState<Regime>(fixa?.regime ?? "clt");
  const [dependentes, setDependentes] = useState(fixa?.dependentes ?? 0);
  const [outros, setOutros] = useState(fixa?.outrosDescontos ?? 0);
  const [erro, setErro] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  const receita = tipo === "receita";
  const peloBruto = receita && informar === "bruto";
  const simulacao = simular({ bruto, regime, dependentes: regime === "clt" ? dependentes : 0, outrosDescontos: outros });
  const categorias = dados.categorias.filter((c) => c.tipo === tipo && (!c.arquivada || c.id === categoria));
  const limpar = () => setErro("");

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const d = Number(dia);
    if (!descricao.trim()) return setErro(assinatura ? "Dê um nome à assinatura." : "Dê um nome à conta.");
    if (peloBruto && bruto <= 0) return setErro("Informe o salário bruto.");
    if (peloBruto && simulacao.liquido <= 0) return setErro("Os descontos não podem ser maiores que o salário bruto.");
    if (!peloBruto && valor <= 0) return setErro("Informe o valor.");
    if (!Number.isInteger(d) || d < 1 || d > 31) return setErro("O dia vai de 1 a 31.");
    if (!categoria) return setErro("Escolha uma categoria.");
    if (inicio && fim && fim < inicio) return setErro("O término não pode vir antes do começo.");
    void executar(
      {
        acao: "fixa.salvar",
        ...(fixa ? { id: fixa.id } : {}),
        descricao,
        tipo,
        valor: peloBruto ? simulacao.liquido : valor,
        dia: d,
        categoria,
        pagoPor: receita && deQuem !== "casal" ? deQuem : pagoPor,
        deQuem,
        parteA,
        ativa,
        inicio,
        fim,
        bruto: peloBruto ? bruto : 0,
        regime,
        dependentes: peloBruto && regime === "clt" ? dependentes : 0,
        outrosDescontos: peloBruto ? outros : 0,
        natureza,
        periodicidade: receita ? "mensal" : periodicidade,
        mesAnual: !receita && periodicidade === "anual" ? mesAnual : 0,
      },
      fixa ? "Alterações salvas" : assinatura ? "Assinatura adicionada" : receita ? "Receita fixa criada" : "Conta fixa criada",
    );
    fechar();
  };

  const titulo = assinatura
    ? fixa ? "Editar assinatura" : "Nova assinatura"
    : fixa
      ? receita ? "Editar receita fixa" : "Editar conta fixa"
      : receita ? "Nova receita fixa" : "Nova conta fixa";

  return (
    <form onSubmit={enviar} style={{ display: "contents" }} noValidate>
      <div className="folha-topo">
        <h2 id="titulo-fixa">{titulo}</h2>
        <button type="button" className="fechar" aria-label="Fechar" onClick={fechar}>
          <X size={18} strokeWidth={1.75} />
        </button>
      </div>

      <div className="folha-corpo">
        {!fixa && !assinatura ? (
          <Segmentado
            valor={tipo}
            opcoes={[{ valor: "despesa", rotulo: "A pagar" }, { valor: "receita", rotulo: "A receber" }]}
            aoMudar={(t) => {
              setTipo(t);
              setCategoria(t === "receita" ? (dados.categorias.find((c) => c.id === "salario")?.id ?? "") : "");
              if (t === "receita" && deQuem === "casal") setDeQuem(quem);
              limpar();
            }}
            rotulo="Tipo de conta"
            largo
          />
        ) : null}

        <div className="campo">
          <label htmlFor="f-descricao">Nome</label>
          <input
            id="f-descricao" className="entrada" value={descricao} maxLength={120} autoComplete="off"
            placeholder={assinatura ? "Netflix, PS Plus, Claude" : receita ? `Salário de ${nomes[quem]}` : "Aluguel, internet, academia"}
            onChange={(e) => { setDescricao(e.target.value); limpar(); }}
          />
          {assinatura && !fixa ? (
            <div className="sugestoes" role="group" aria-label="Sugestões de nome">
              {SUGESTOES.map((n) => (
                <button key={n} type="button" className="ficha" aria-pressed={descricao === n} onClick={() => { setDescricao(n); limpar(); }}>
                  {n}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {receita ? (
          <div className="campo">
            <span className="rotulo-campo">Como informar o valor</span>
            <Segmentado
              valor={informar}
              aoMudar={(v) => { setInformar(v); limpar(); }}
              rotulo="Como informar o valor"
              largo
              opcoes={[
                { valor: "bruto", rotulo: "Salário bruto" },
                { valor: "liquido", rotulo: "Valor líquido" },
              ]}
            />
            <p className="campo-dica">
              {peloBruto
                ? "O app simula o líquido. Quando o salário cair, você confirma o valor real."
                : "Para receitas que não têm desconto em folha, como um aluguel recebido."}
            </p>
          </div>
        ) : null}

        <div className="dois">
          <div className="campo">
            <label htmlFor="f-valor">{peloBruto ? "Salário bruto" : !receita && periodicidade === "anual" ? "Valor por ano" : "Valor por mês"}</label>
            {peloBruto ? (
              <CampoValor id="f-valor" valor={bruto} aoMudar={(v) => { setBruto(v); limpar(); }} rotulo="Salário bruto" />
            ) : (
              <CampoValor id="f-valor" valor={valor} aoMudar={(v) => { setValor(v); limpar(); }} rotulo="Valor por mês" />
            )}
          </div>
          <div className="campo">
            <label htmlFor="f-dia">{receita ? "Dia em que entra" : assinatura ? "Dia da cobrança" : "Dia do vencimento"}</label>
            <input id="f-dia" className="entrada num" inputMode="numeric" value={dia} onChange={(e) => { setDia(e.target.value.replace(/\D/g, "").slice(0, 2)); limpar(); }} />
          </div>
        </div>

        {!receita ? (
          <div className="campo">
            <span className="rotulo-campo">Cobrança</span>
            <Segmentado
              valor={periodicidade}
              aoMudar={(v) => { setPeriodicidade(v); limpar(); }}
              rotulo="Cobrança"
              largo
              opcoes={[
                { valor: "mensal", rotulo: "Todo mês" },
                { valor: "anual", rotulo: "Uma vez por ano" },
              ]}
            />
            {periodicidade === "anual" ? (
              <>
                <label className="so-leitor" htmlFor="f-mes-anual">Mês da cobrança</label>
                <select id="f-mes-anual" className="selecao" value={mesAnual} onChange={(e) => setMesAnual(Number(e.target.value))}>
                  {MESES.map((m, i) => (
                    <option key={m} value={i + 1}>Cobra em {m}</option>
                  ))}
                </select>
                <p className="campo-dica">
                  Aparece para pagar só em {MESES[mesAnual - 1]}. No relatório, conta como {valor > 0 ? `${formatar(Math.round(valor / 12))} por mês` : "um doze avos por mês"}.
                </p>
              </>
            ) : null}
          </div>
        ) : null}

        {peloBruto ? (
          <>
            <div className="campo">
              <span className="rotulo-campo">Descontos em folha</span>
              <Segmentado
                valor={regime}
                aoMudar={setRegime}
                rotulo="Descontos em folha"
                largo
                opcoes={[
                  { valor: "clt", rotulo: "CLT: INSS e IR" },
                  { valor: "outro", rotulo: "Sem INSS e IR" },
                ]}
              />
            </div>
            <div className={regime === "clt" ? "dois" : undefined}>
              {regime === "clt" ? (
                <div className="campo">
                  <span className="rotulo-campo">Dependentes no IR</span>
                  <div className="passos" role="group" aria-label="Dependentes no imposto de renda">
                    <button type="button" aria-label="Menos um dependente" disabled={dependentes <= 0} onClick={() => setDependentes((n) => Math.max(0, n - 1))}>
                      <Minus size={16} strokeWidth={1.75} />
                    </button>
                    <output aria-live="polite">{dependentes}</output>
                    <button type="button" aria-label="Mais um dependente" disabled={dependentes >= 20} onClick={() => setDependentes((n) => Math.min(20, n + 1))}>
                      <Plus size={16} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="campo">
                <label htmlFor="f-outros">Outros descontos</label>
                <CampoValor id="f-outros" valor={outros} aoMudar={(v) => { setOutros(v); limpar(); }} rotulo="Outros descontos por mês" />
              </div>
            </div>
            <p className="campo-dica">Outros descontos por mês: plano de saúde, vale-transporte, previdência privada.</p>
            {bruto > 0 ? <QuadroSimulacao s={simulacao} /> : null}
            {regime === "clt" ? (
              <p className="campo-dica">Tabelas de INSS e imposto de renda de 2026, com a isenção para quem ganha até R$ 5.000.</p>
            ) : null}
          </>
        ) : null}

        <div className="campo">
          <label htmlFor="f-categoria">Categoria</label>
          <select id="f-categoria" className="selecao" value={categoria} onChange={(e) => { setCategoria(e.target.value); limpar(); }}>
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

        <CampoMes valor={inicio} aoMudar={(m) => { setInicio(m); limpar(); }} rotulo="Começa em" semData="Desde sempre" referencia={mesDe(hoje)} />
        <CampoMes valor={fim} aoMudar={(m) => { setFim(m); limpar(); }} rotulo="Termina em" semData="Sem término" referencia={mesDe(hoje)} />
        <p className="campo-dica">
          {fim
            ? "No mês de término a conta ainda aparece; a partir do mês seguinte, some das contas do mês."
            : "Para financiamentos, cursos e contratos com fim, escolha o último mês."}
        </p>

        {fixa ? (
          <label className="entre" style={{ cursor: "pointer" }}>
            <span>
              <span style={{ display: "block", fontSize: 16, fontWeight: 500 }}>{assinatura ? "Assinatura ativa" : "Conta ativa"}</span>
              <span className="campo-dica">Desligue para pausar sem perder o histórico.</span>
            </span>
            <input type="checkbox" role="switch" className="interruptor" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
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
          <button type="submit" className="botao primario alto">
            {fixa ? "Salvar alterações" : assinatura ? "Adicionar assinatura" : receita ? "Criar receita fixa" : "Criar conta fixa"}
          </button>
        </div>
      )}
    </form>
  );
}
