"use client";

import { Minus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { comprovantesDe, donoDoComprovante } from "@/lib/comprovantes";
import type { Acao } from "@/lib/acoes";
import { dataValida, mesDe, nomeDoMes } from "@/lib/datas";
import { formatar } from "@/lib/dinheiro";
import { expandirParcelas, outra } from "@/lib/dominio";
import { ehSimulada, simulacaoDa } from "@/lib/salario";
import type { Dono, PessoaId, TipoLancamento } from "@/lib/tipos";
import { CampoValor, EscolhaDono, EscolhaPessoa } from "./campos";
import { AreaDeComprovantes, novoPendente, type Pendente } from "./comprovantes";
import { Folha } from "./folha";
import { useApp, type PedidoDeLancamento } from "./provedor";
import { QuadroSimulacao } from "./simulacao";
import { Segmentado } from "./ui";

const TIPOS: { valor: TipoLancamento; rotulo: string }[] = [
  { valor: "despesa", rotulo: "Despesa" },
  { valor: "receita", rotulo: "Receita" },
  { valor: "acerto", rotulo: "Acerto" },
];

export function FormLancamento() {
  const { pedidoLancamento, abrirLancamento } = useApp();
  return (
    <Folha aberta={!!pedidoLancamento} aoFechar={() => abrirLancamento(null)} rotuloId="titulo-lancamento">
      {pedidoLancamento ? <Corpo pedido={pedidoLancamento} fechar={() => abrirLancamento(null)} /> : null}
    </Folha>
  );
}

function Corpo({ pedido, fechar }: { pedido: PedidoDeLancamento; fechar: () => void }) {
  const { dados, hoje, mes, quem, nomes, executar, enviarComprovantes } = useApp();
  const editando = pedido.modo === "editar" ? pedido.lancamento : null;
  const conta = pedido.modo === "pagar" ? pedido.conta : null;
  const base = editando ?? conta?.fixa;

  const [tipo, setTipo] = useState<TipoLancamento>(
    editando?.tipo ?? conta?.fixa.tipo ?? (pedido.modo === "novo" ? pedido.tipo : undefined) ?? "despesa",
  );
  const [valor, setValor] = useState(
    editando?.valor ?? conta?.previsto ?? (pedido.modo === "novo" ? pedido.valor : undefined) ?? 0,
  );
  // Salário informado pelo bruto: mostra a simulação ao lado do valor real.
  const fixaLigada = conta?.fixa ?? (editando?.fixaId ? dados.fixas.find((f) => f.id === editando.fixaId) : undefined);
  const simulacao = fixaLigada && ehSimulada(fixaLigada) ? simulacaoDa(fixaLigada) : null;
  const confirmandoSalario = !!conta && !!simulacao;
  const [descricao, setDescricao] = useState(base?.descricao ?? "");
  const [categoria, setCategoria] = useState(base?.categoria ?? "");
  const [pagoPor, setPagoPor] = useState<PessoaId>(
    base?.pagoPor ?? (pedido.modo === "novo" ? pedido.pagoPor : undefined) ?? quem,
  );
  const [deQuem, setDeQuem] = useState<Dono>(base?.deQuem ?? "casal");
  const [parteA, setParteA] = useState(base?.parteA ?? dados.config.parteAPadrao);
  const [data, setData] = useState(
    editando?.data ?? (conta ? (mes === mesDe(hoje) ? hoje : conta.vencimento) : hoje),
  );
  const [parcelas, setParcelas] = useState(1);
  const [erro, setErro] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  // Comprovantes: editando, sobem na hora; num lançamento novo, esperam ele ser gravado.
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [enviando, setEnviando] = useState(0);
  const pendentesRef = useRef(pendentes);
  pendentesRef.current = pendentes;
  useEffect(() => () => pendentesRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);
  const existentes = editando ? comprovantesDe(dados.comprovantes ?? [], editando) : [];
  const escolherArquivos = (arquivos: File[]) => {
    if (!editando) {
      setPendentes((ps) => [...ps, ...arquivos.map(novoPendente)]);
      return;
    }
    setEnviando((n) => n + arquivos.length);
    void enviarComprovantes(donoDoComprovante(editando), arquivos).finally(() => setEnviando((n) => n - arquivos.length));
  };

  const categorias = dados.categorias.filter(
    (c) => c.tipo === tipo && (!c.arquivada || c.id === categoria),
  );
  const mudarTipo = (t: TipoLancamento) => {
    setTipo(t);
    setCategoria("");
    setErro("");
    if (t === "receita" && deQuem === "casal") setDeQuem(quem);
  };

  const titulo = editando
    ? "Editar lançamento"
    : confirmandoSalario
      ? "Confirmar salário"
      : conta
        ? conta.fixa.tipo === "receita" ? "Registrar recebimento" : "Pagar conta"
        : "Novo lançamento";
  const rotuloEnviar = editando
    ? "Salvar alterações"
    : confirmandoSalario
      ? "Confirmar valor recebido"
      : conta
        ? conta.fixa.tipo === "receita" ? "Marcar como recebida" : "Marcar como paga"
        : tipo === "despesa" ? "Lançar despesa" : tipo === "receita" ? "Lançar receita" : "Registrar acerto";
  const feito = editando
    ? "Alterações salvas"
    : confirmandoSalario
      ? "Salário confirmado"
      : conta
        ? conta.fixa.tipo === "receita" ? "Marcada como recebida" : "Marcada como paga"
        : tipo === "despesa" ? "Despesa lançada" : tipo === "receita" ? "Receita lançada" : "Acerto registrado";
  const diferenca = simulacao ? valor - simulacao.liquido : 0;

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (valor <= 0) return setErro("Informe o valor.");
    if (!dataValida(data)) return setErro("Informe a data.");
    if (tipo !== "acerto" && !categoria) return setErro("Escolha uma categoria.");
    const campos = {
      tipo,
      data,
      descricao: tipo === "acerto" && !descricao ? "Acerto" : descricao,
      valor,
      categoria: tipo === "acerto" ? "" : categoria,
      // Receita de uma pessoa: quem recebe é a dona.
      pagoPor: tipo === "receita" && deQuem !== "casal" ? deQuem : pagoPor,
      deQuem: tipo === "acerto" ? outra(pagoPor) : deQuem,
      parteA,
    };
    const acao: Acao = editando
      ? { acao: "lancamento.editar", id: editando.id, ...campos }
      : {
          acao: "lancamento.criar",
          ...campos,
          parcelas,
          ...(conta ? { fixaId: conta.fixa.id, mesRef: mes } : {}),
        };
    const arquivos = pendentes.map((p) => p.arquivo);
    // O primeiro id criado é o do lançamento, ou o do grupo quando é parcelado: é o dono dos comprovantes.
    void executar(acao, feito, arquivos.length && !editando ? (ids) => {
      if (ids[0]) void enviarComprovantes(ids[0], arquivos);
    } : undefined);
    fechar();
  };

  const excluir = (grupo: boolean) => {
    if (!editando) return;
    void executar({ acao: "lancamento.remover", id: editando.id, grupo }, grupo ? "Parcelas excluídas" : "Lançamento excluído");
    fechar();
  };

  const totalDoGrupo = editando?.grupo ? dados.lancamentos.filter((l) => l.grupo === editando.grupo).length : 0;
  const valorDaParcela = parcelas > 1 ? (expandirParcelas(data, valor, parcelas)[0]?.valor ?? 0) : 0;

  return (
    <form onSubmit={enviar} style={{ display: "contents" }} noValidate>
      <div className="folha-topo">
        <h2 id="titulo-lancamento">{titulo}</h2>
        <button type="button" className="fechar" aria-label="Fechar" onClick={fechar}>
          <X size={18} strokeWidth={1.75} />
        </button>
      </div>

      <div className="folha-corpo">
        {pedido.modo === "novo" ? (
          <Segmentado valor={tipo} opcoes={TIPOS} aoMudar={mudarTipo} rotulo="Tipo de lançamento" largo />
        ) : null}

        {confirmandoSalario && simulacao ? (
          <>
            <p className="campo-dica">
              Este é o valor simulado para {nomeDoMes(mes)}. Troque pelo líquido que caiu na conta e os relatórios passam a usar o valor real.
            </p>
            <QuadroSimulacao s={simulacao} />
            <span className="rotulo-campo" style={{ fontSize: 14, fontWeight: 500 }}>Valor líquido recebido</span>
          </>
        ) : null}

        <CampoValor
          valor={valor}
          aoMudar={(v) => { setValor(v); setErro(""); }}
          rotulo={confirmandoSalario ? "Valor líquido recebido" : "Valor"}
          grande
          autoFoco={pedido.modo === "novo" || confirmandoSalario}
          selecionarAoFocar={confirmandoSalario}
        />

        {simulacao && (editando || diferenca !== 0) ? (
          <p className="diferenca">
            {diferenca === 0
              ? `Igual ao simulado (${formatar(simulacao.liquido)}).`
              : `${formatar(Math.abs(diferenca))} ${diferenca > 0 ? "acima" : "abaixo"} do simulado (${formatar(simulacao.liquido)}).`}
          </p>
        ) : null}

        {tipo === "acerto" ? (
          <>
            <EscolhaPessoa valor={pagoPor} aoMudar={setPagoPor} nomes={nomes} rotulo="Quem transferiu" />
            <p className="campo-dica">
              {nomes[pagoPor]} transfere para {nomes[outra(pagoPor)]} e a dívida entre vocês diminui nesse valor.
            </p>
          </>
        ) : (
          <>
            <div className="campo">
              <label htmlFor="l-descricao">{tipo === "receita" ? "De onde veio" : "O que foi"}</label>
              <input
                id="l-descricao"
                className="entrada"
                value={descricao}
                maxLength={120}
                autoComplete="off"
                placeholder={tipo === "receita" ? "Salário, freela, reembolso" : "Feira, gasolina, jantar"}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>

            <div className="campo">
              <span className="rotulo-campo">Categoria</span>
              <div className="fichas" role="group" aria-label="Categoria">
                {categorias.map((c) => (
                  <button key={c.id} type="button" className="ficha" aria-pressed={categoria === c.id} onClick={() => { setCategoria(c.id); setErro(""); }}>
                    {c.nome}
                  </button>
                ))}
              </div>
            </div>

            {tipo === "despesa" ? (
              <EscolhaPessoa valor={pagoPor} aoMudar={setPagoPor} nomes={nomes} rotulo="Quem pagou" />
            ) : null}
            <EscolhaDono
              valor={deQuem}
              aoMudar={setDeQuem}
              parteA={parteA}
              aoMudarParte={setParteA}
              nomes={nomes}
              rotulo={tipo === "receita" ? "De quem é a receita" : "De quem é a despesa"}
            />
          </>
        )}

        <div className={tipo === "despesa" && pedido.modo === "novo" ? "dois" : undefined}>
          <div className="campo">
            <label htmlFor="l-data">Data</label>
            <input id="l-data" type="date" className="entrada" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          {tipo === "despesa" && pedido.modo === "novo" ? (
            <div className="campo">
              <span className="rotulo-campo">Parcelas</span>
              <div className="passos" role="group" aria-label="Parcelas">
                <button type="button" aria-label="Menos uma parcela" disabled={parcelas <= 1} onClick={() => setParcelas((n) => Math.max(1, n - 1))}>
                  <Minus size={16} strokeWidth={1.75} />
                </button>
                <output aria-live="polite">{parcelas}x</output>
                <button type="button" aria-label="Mais uma parcela" disabled={parcelas >= 48} onClick={() => setParcelas((n) => Math.min(48, n + 1))}>
                  <Plus size={16} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {parcelas > 1 && valor > 0 ? (
          <p className="campo-dica">
            {parcelas} parcelas de {formatar(valorDaParcela)}, uma por mês a partir de {nomeDoMes(mesDe(data))}.
          </p>
        ) : null}
        {editando?.parcela ? (
          <p className="campo-dica">Parcela {editando.parcela.replace("/", " de ")}. A alteração vale só para esta parcela.</p>
        ) : null}
        <AreaDeComprovantes
          existentes={existentes}
          pendentes={pendentes}
          enviando={enviando}
          aoEscolher={escolherArquivos}
          aoTirarPendente={(chave) =>
            setPendentes((ps) => {
              const sai = ps.find((p) => p.chave === chave);
              if (sai) URL.revokeObjectURL(sai.url);
              return ps.filter((p) => p.chave !== chave);
            })
          }
        />
        {erro ? <p className="erro-campo" role="alert">{erro}</p> : null}
      </div>

      {excluindo ? (
        <div className="folha-pe" style={{ flexWrap: "wrap" }}>
          <button type="button" className="botao" onClick={() => setExcluindo(false)}>Cancelar</button>
          <button type="button" className="botao perigo" onClick={() => excluir(false)}>
            {totalDoGrupo > 1 ? "Excluir só esta parcela" : "Excluir lançamento"}
          </button>
          {totalDoGrupo > 1 ? (
            <button type="button" className="botao perigo" onClick={() => excluir(true)}>
              Excluir as {totalDoGrupo} parcelas
            </button>
          ) : null}
        </div>
      ) : (
        <div className="folha-pe">
          {editando ? (
            <button type="button" className="botao perigo" onClick={() => setExcluindo(true)}>Excluir</button>
          ) : null}
          <button type="submit" className="botao primario alto">{rotuloEnviar}</button>
        </div>
      )}
    </form>
  );
}
