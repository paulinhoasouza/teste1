"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Titulo } from "@/componentes/casca";
import { CampoValor } from "@/componentes/campos";
import { useApp } from "@/componentes/provedor";
import { formatar } from "@/lib/dinheiro";
import { partes } from "@/lib/dominio";
import type { Categoria, Config, CorPessoa, PessoaId } from "@/lib/tipos";

const CORES: { id: CorPessoa; nome: string; hex: string }[] = [
  { id: "azul", nome: "Azul", hex: "#1d5fd6" },
  { id: "laranja", nome: "Laranja", hex: "#b45309" },
  { id: "verde", nome: "Verde", hex: "#17806a" },
  { id: "rosa", nome: "Rosa", hex: "#b8326e" },
  { id: "oliva", nome: "Oliva", hex: "#6b6f1d" },
];

export default function Ajustes() {
  const { dados, nomes, executar, temLogin } = useApp();
  const { config } = dados;
  const salvar = (mudanca: Partial<Config>) =>
    void executar({ acao: "config.salvar", ...config, ...mudanca }, "Salvo");

  const despesas = dados.categorias.filter((c) => c.tipo === "despesa" && !c.arquivada);
  const receitas = dados.categorias.filter((c) => c.tipo === "receita" && !c.arquivada);
  const arquivadas = dados.categorias.filter((c) => c.arquivada);
  const planejado = despesas.reduce((s, c) => s + c.orcamento, 0);

  return (
    <>
      <Titulo titulo="Ajustes" achado="Cada mudança é salva na hora." semMes acao={<span />} />

      <section className="secao" aria-labelledby="s-voces">
        <div className="secao-rotulo">
          <h2 id="s-voces">Vocês</h2>
          <p>O nome e a cor de cada um aparecem em todos os lançamentos e no símbolo do app.</p>
        </div>
        <div className="painel">
          {(["a", "b"] as const).map((p) => (
            <Pessoa key={p} pessoa={p} config={config} salvar={salvar} />
          ))}
        </div>
      </section>

      <section className="secao" id="divisao" aria-labelledby="s-divisao">
        <div className="secao-rotulo">
          <h2 id="s-divisao">Divisão do que é nosso</h2>
          <p>
            Vale para os próximos lançamentos; os antigos mantêm a divisão com que foram lançados. Dá para mudar em cada
            despesa.
          </p>
        </div>
        <div className="painel">
          <Divisao parteA={config.parteAPadrao} nomes={nomes} salvar={(n) => salvar({ parteAPadrao: n })} />
        </div>
      </section>

      <section className="secao" id="categorias" aria-labelledby="s-categorias">
        <div className="secao-rotulo">
          <h2 id="s-categorias">Categorias e orçamentos</h2>
          <p>
            O orçamento é o teto do mês para os dois juntos. Deixe em R$ 0,00 para não acompanhar.
            {planejado > 0 ? ` Hoje vocês planejam ${formatar(planejado)} por mês.` : ""}
          </p>
        </div>
        <div className="painel">
          <div className="cat-linha cat-cabeca" aria-hidden="true">
            <span>Despesa</span>
            <span>Orçamento do mês</span>
            <span style={{ width: 84 }} />
          </div>
          {despesas.map((c) => (
            <LinhaCategoria key={c.id} c={c} />
          ))}
          <NovaCategoria tipo="despesa" />
          <div className="cat-linha cat-cabeca" aria-hidden="true" style={{ marginTop: 12 }}>
            <span>Receita</span>
            <span />
            <span style={{ width: 84 }} />
          </div>
          {receitas.map((c) => (
            <LinhaCategoria key={c.id} c={c} />
          ))}
          <NovaCategoria tipo="receita" />
          {arquivadas.length > 0 ? (
            <>
              <div className="cat-linha cat-cabeca" aria-hidden="true" style={{ marginTop: 12 }}>
                <span>Arquivadas</span>
                <span />
                <span style={{ width: 84 }} />
              </div>
              {arquivadas.map((c) => (
                <div className="cat-linha" key={c.id}>
                  <span className="mudo">{c.nome}</span>
                  <span />
                  <button type="button" className="botao menor" style={{ width: 84 }} onClick={() => void executar({ acao: "categoria.salvar", id: c.id, nome: c.nome, tipo: c.tipo, orcamento: c.orcamento, arquivada: false }, "Categoria restaurada")}>
                    Restaurar
                  </button>
                </div>
              ))}
            </>
          ) : null}
        </div>
      </section>

      <section className="secao" id="planilha" aria-labelledby="s-planilha">
        <div className="secao-rotulo">
          <h2 id="s-planilha">Planilha do Google</h2>
          <p>Todos os dados ficam numa planilha de vocês. Dá para abrir, conferir e fazer contas nela quando quiserem.</p>
        </div>
        <div className="painel">
          {dados.demo ? (
            <>
              <p><span className="pilula aviso">Demonstração</span></p>
              <p>O app ainda não está ligado a uma planilha, por isso mostra dados de exemplo. Para ligar:</p>
              <ol className="passo-a-passo">
                <li>No Google Cloud, crie uma conta de serviço com a API do Google Sheets ativada e baixe a chave em JSON.</li>
                <li>Crie uma planilha em branco e compartilhe com o e-mail da conta de serviço, como Editor.</li>
                <li>
                  <span>
                  Na Vercel, em Settings, Environment Variables, crie <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> (o conteúdo do
                  arquivo), <code>GOOGLE_SHEET_ID</code> (o endereço da planilha) e <code>APP_SENHA</code> (a senha de vocês).
                  </span>
                </li>
                <li>Faça um novo deploy. As abas da planilha são criadas sozinhas na primeira abertura.</li>
              </ol>
              <p className="pequeno mudo">O passo a passo completo está no arquivo README do repositório.</p>
            </>
          ) : (
            <>
              <p><span className="pilula bom">Conectada</span></p>
              <p>
                O app lê e grava nas abas Lancamentos, Categorias, Fixas e Config. Pode editar a planilha à mão; só não apague a
                primeira linha nem a coluna id.
              </p>
            </>
          )}
        </div>
      </section>

      {temLogin ? (
        <section className="secao" aria-labelledby="s-sessao">
          <div className="secao-rotulo">
            <h2 id="s-sessao">Sessão</h2>
            <p>Sair pede a senha de novo neste aparelho.</p>
          </div>
          <div className="painel">
            <div>
              <button
                type="button"
                className="botao"
                onClick={async () => {
                  await fetch("/api/sair", { method: "POST" });
                  window.location.href = "/entrar";
                }}
              >
                Sair deste aparelho
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}

function Pessoa({ pessoa, config, salvar }: { pessoa: PessoaId; config: Config; salvar: (m: Partial<Config>) => void }) {
  const chaveNome = pessoa === "a" ? "nomeA" : "nomeB";
  const chaveCor = pessoa === "a" ? "corA" : "corB";
  const corDoOutro = pessoa === "a" ? config.corB : config.corA;
  const [nome, setNome] = useState(config[chaveNome]);
  useEffect(() => setNome(config[chaveNome]), [config, chaveNome]);

  const confirmar = () => {
    const limpo = nome.trim();
    if (!limpo) return setNome(config[chaveNome]);
    if (limpo !== config[chaveNome]) salvar({ [chaveNome]: limpo });
  };

  return (
    <div className="dois" style={{ alignItems: "end" }}>
      <div className="campo">
        <label htmlFor={`nome-${pessoa}`}>{pessoa === "a" ? "Primeira pessoa" : "Segunda pessoa"}</label>
        <input
          id={`nome-${pessoa}`} className="entrada" value={nome} maxLength={24} autoComplete="off"
          onChange={(e) => setNome(e.target.value)}
          onBlur={confirmar}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        />
      </div>
      <div className="campo">
        <span className="rotulo-campo">Cor</span>
        <div className="cores" role="group" aria-label={`Cor de ${config[chaveNome]}`}>
          {CORES.map((c) => (
            <button
              key={c.id} type="button" className="cor" style={{ background: c.hex }}
              aria-label={c.id === corDoOutro ? `${c.nome}, em uso pela outra pessoa` : c.nome}
              aria-pressed={config[chaveCor] === c.id}
              disabled={c.id === corDoOutro}
              onClick={() => { if (config[chaveCor] !== c.id) salvar({ [chaveCor]: c.id }); }}
            >
              {config[chaveCor] === c.id ? <Check size={16} strokeWidth={2.5} /> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Divisao({ parteA, nomes, salvar }: { parteA: number; nomes: Record<PessoaId, string>; salvar: (n: number) => void }) {
  const [valor, setValor] = useState(parteA);
  useEffect(() => setValor(parteA), [parteA]);
  const confirmar = () => {
    if (valor !== parteA) salvar(valor);
  };
  const exemplo = partes({ valor: 10000, deQuem: "casal", parteA: valor });
  return (
    <>
      <div className="entre">
        <label htmlFor="divisao-faixa" className="forte">{nomes.a} {valor}%</label>
        <span className="forte">{nomes.b} {100 - valor}%</span>
      </div>
      <input
        id="divisao-faixa" type="range" min={0} max={100} step={5} value={valor}
        aria-label={`Parte de ${nomes.a}, em porcentagem`}
        onChange={(e) => setValor(Number(e.target.value))}
        onPointerUp={confirmar} onKeyUp={confirmar} onBlur={confirmar}
        style={{ width: "100%", accentColor: "var(--text)" }}
      />
      <p className="pequeno mudo">
        Numa despesa de R$ 100,00 que é dos dois, {nomes.a} fica com {formatar(exemplo.a)} e {nomes.b} com {formatar(exemplo.b)}.
      </p>
    </>
  );
}

function LinhaCategoria({ c }: { c: Categoria }) {
  const { executar } = useApp();
  const [nome, setNome] = useState(c.nome);
  const [orcamento, setOrcamento] = useState(c.orcamento);
  useEffect(() => { setNome(c.nome); setOrcamento(c.orcamento); }, [c.nome, c.orcamento]);

  const confirmar = () => {
    const limpo = nome.trim() || c.nome;
    if (limpo === c.nome && orcamento === c.orcamento) return setNome(limpo);
    void executar({ acao: "categoria.salvar", id: c.id, nome: limpo, tipo: c.tipo, orcamento }, "Salvo");
  };

  return (
    <div className="cat-linha">
      <input
        className="entrada" value={nome} maxLength={40} aria-label={`Nome da categoria ${c.nome}`}
        onChange={(e) => setNome(e.target.value)} onBlur={confirmar}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      />
      {c.tipo === "despesa" ? (
        <span onBlur={confirmar} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLElement).blur(); }}>
          <CampoValor valor={orcamento} aoMudar={setOrcamento} rotulo={`Orçamento de ${c.nome}`} />
        </span>
      ) : (
        <span />
      )}
      <button
        type="button" className="botao menor" style={{ width: 84 }}
        aria-label={`Arquivar ${c.nome}`}
        onClick={() => void executar({ acao: "categoria.salvar", id: c.id, nome: c.nome, tipo: c.tipo, orcamento: c.orcamento, arquivada: true }, "Categoria arquivada")}
      >
        Arquivar
      </button>
    </div>
  );
}

function NovaCategoria({ tipo }: { tipo: "despesa" | "receita" }) {
  const { executar } = useApp();
  const [nome, setNome] = useState("");
  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    if (await executar({ acao: "categoria.salvar", nome, tipo, orcamento: 0 }, "Categoria criada")) setNome("");
  };
  return (
    <form className="cat-linha" onSubmit={criar}>
      <input
        className="entrada" value={nome} maxLength={40}
        aria-label={tipo === "despesa" ? "Nova categoria de despesa" : "Nova categoria de receita"}
        placeholder={tipo === "despesa" ? "Nova categoria de despesa" : "Nova categoria de receita"}
        onChange={(e) => setNome(e.target.value)}
      />
      <span />
      <button type="submit" className="botao menor" style={{ width: 84 }} disabled={!nome.trim()}>Adicionar</button>
    </form>
  );
}
