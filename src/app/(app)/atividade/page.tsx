"use client";

import {
  ArrowRight, CalendarCheck, Check, KeyRound, LogIn, LogOut, Paperclip, Pencil, Plus, Search, Settings, Trash2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Titulo } from "@/componentes/casca";
import { useApp } from "@/componentes/provedor";
import { Avatar, Cartao, Segmentado, Trilho } from "@/componentes/ui";
import { grupoDaAtividade, type GrupoDeAtividade } from "@/lib/atividade";
import { donoDoComprovante } from "@/lib/comprovantes";
import { diaPorExtenso } from "@/lib/datas";
import type { Atividade, PessoaId } from "@/lib/tipos";
import { marcarAtividadeVista, ultimaVistaDaAtividade } from "@/lib/vista";

const FUSO = "America/Sao_Paulo";
const diaLocal = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date(iso));
const horaLocal = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const GRUPOS: { valor: GrupoDeAtividade | "tudo"; rotulo: string }[] = [
  { valor: "tudo", rotulo: "Tudo" },
  { valor: "lancamentos", rotulo: "Lançamentos" },
  { valor: "contas", rotulo: "Contas e assinaturas" },
  { valor: "comprovantes", rotulo: "Comprovantes" },
  { valor: "ajustes", rotulo: "Categorias e ajustes" },
  { valor: "acesso", rotulo: "Entradas" },
];

/** Ícone e cor de cada tipo de coisa que aconteceu. */
function aparencia(a: Atividade): { Icone: LucideIcon; tom: string } {
  if (a.tipo.endsWith(".criar")) return { Icone: Plus, tom: "criou" };
  if (a.tipo.endsWith(".editar")) return { Icone: Pencil, tom: "alterou" };
  if (a.tipo.endsWith(".remover") || a.tipo === "comprovante.apagar") return { Icone: Trash2, tom: "apagou" };
  if (a.tipo === "conta.pagar" || a.tipo === "salario.confirmar") return { Icone: a.tipo === "conta.pagar" ? CalendarCheck : Check, tom: "pagou" };
  if (a.tipo === "comprovante.anexar") return { Icone: Paperclip, tom: "criou" };
  if (a.tipo === "acesso.entrar") return { Icone: LogIn, tom: "acesso" };
  if (a.tipo === "acesso.sair") return { Icone: LogOut, tom: "acesso" };
  if (a.tipo === "acesso.senha") return { Icone: KeyRound, tom: "acesso" };
  return { Icone: Settings, tom: "alterou" };
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function PaginaAtividade() {
  const { dados, nomes, hoje, quem, abrirLancamento, abrirFixa } = useApp();
  const [pessoa, setPessoa] = useState<PessoaId | "todos">("todos");
  const [grupo, setGrupo] = useState<GrupoDeAtividade | "tudo">("tudo");
  const [busca, setBusca] = useState("");
  const [antigas, setAntigas] = useState<Atividade[]>([]);
  const [acabou, setAcabou] = useState(false);
  const [carregando, setCarregando] = useState(false);
  // O que chegou desde a última visita ganha um ponto; a visita de agora vira a nova referência.
  const [vistaAntes] = useState(() => ultimaVistaDaAtividade(quem));
  useEffect(() => marcarAtividadeVista(quem), [quem, dados.atividades]);

  const todas = useMemo(() => {
    const vistos = new Set<string>();
    return [...(dados.atividades ?? []), ...antigas].filter((a) => (vistos.has(a.id) ? false : (vistos.add(a.id), true)));
  }, [dados.atividades, antigas]);

  const termo = semAcento(busca.trim());
  const lista = todas.filter(
    (a) =>
      (pessoa === "todos" || a.quem === pessoa) &&
      (grupo === "tudo" || grupoDaAtividade(a.tipo) === grupo) &&
      (!termo || semAcento([a.resumo, ...a.mudancas.flatMap((m) => [m.campo, m.de, m.para])].join(" ")).includes(termo)),
  );

  const porDia = useMemo(() => {
    const mapa = new Map<string, Atividade[]>();
    for (const a of lista) {
      const d = diaLocal(a.quando);
      mapa.set(d, [...(mapa.get(d) ?? []), a]);
    }
    return [...mapa.entries()];
  }, [lista]);

  // Resumo dos últimos 30 dias, para ver quem anda mexendo em quê.
  const limite = new Date(Date.now() - 30 * 86400000).toISOString();
  const recentes = todas.filter((a) => a.quando >= limite);
  const contagem = { a: recentes.filter((a) => a.quem === "a").length, b: recentes.filter((a) => a.quem === "b").length };
  const porGrupo = GRUPOS.slice(1).map((g) => ({ ...g, n: recentes.filter((a) => grupoDaAtividade(a.tipo) === g.valor).length }));

  const podeMais = !dados.demo && !acabou && todas.length >= 200;
  const carregarMais = async () => {
    const ultima = todas[todas.length - 1];
    if (!ultima) return;
    setCarregando(true);
    try {
      const r = await fetch(`/api/atividades?antes=${encodeURIComponent(ultima.quando)}`);
      const j = (await r.json()) as { atividades?: Atividade[] };
      const novas = j.atividades ?? [];
      setAntigas((xs) => [...xs, ...novas]);
      if (novas.length < 100) setAcabou(true);
    } finally {
      setCarregando(false);
    }
  };

  /** O lançamento ou a conta a que a atividade se refere, se ainda existir. */
  const abrir = (a: Atividade): (() => void) | null => {
    if (!a.alvo) return null;
    const g = grupoDaAtividade(a.tipo);
    if (g === "lancamentos" || g === "comprovantes") {
      const l = dados.lancamentos.find((x) => x.id === a.alvo || donoDoComprovante(x) === a.alvo);
      if (l) return () => abrirLancamento({ modo: "editar", lancamento: l });
    }
    const f = dados.fixas.find((x) => x.id === a.alvo);
    if (f && (g === "contas" || a.tipo === "conta.pagar" || a.tipo === "salario.confirmar")) return () => abrirFixa({ fixa: f });
    return null;
  };

  const achado =
    recentes.length === 0
      ? "Cada lançamento, alteração, exclusão e ajuste que vocês fizerem aparece aqui, com o antes e o depois."
      : `${recentes.length} ${recentes.length === 1 ? "ação" : "ações"} nos últimos 30 dias: ${contagem.a} de ${nomes.a}, ${contagem.b} de ${nomes.b}.`;

  return (
    <>
      <Titulo titulo="Atividade" achado={achado} semMes acao={<span />} />

      <div className="grade topo">
        <div className="c8 pilha">
          <div className="filtros empilhar">
            <Segmentado
              valor={pessoa}
              aoMudar={setPessoa}
              rotulo="De quem"
              opcoes={[
                { valor: "todos", rotulo: "Vocês dois" },
                { valor: "a", rotulo: nomes.a },
                { valor: "b", rotulo: nomes.b },
              ]}
            />
            <div className="busca">
              <Search size={16} strokeWidth={1.5} aria-hidden="true" />
              <input className="entrada" type="search" aria-label="Buscar no histórico" placeholder="Buscar: mercado, valor, categoria" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          <div className="fichas rolavel" role="group" aria-label="Tipo de ação">
            {GRUPOS.map((g) => (
              <button key={g.valor} type="button" className="ficha" aria-pressed={grupo === g.valor} onClick={() => setGrupo(g.valor)}>
                {g.rotulo}
              </button>
            ))}
          </div>

          <Cartao titulo="Histórico" sub={lista.length !== todas.length ? `${lista.length} de ${todas.length} com esses filtros` : undefined}>
            {lista.length === 0 ? (
              <p className="vazio">
                {todas.length === 0
                  ? "Ainda não há nada aqui. A partir de agora, tudo o que vocês fizerem no app fica registrado."
                  : "Nada com esses filtros."}
              </p>
            ) : (
              <div className="linha-do-tempo">
                {porDia.map(([dia, itens]) => (
                  <section key={dia} aria-label={diaPorExtenso(dia, hoje)}>
                    <h3 className="dia">
                      <span>{diaPorExtenso(dia, hoje)}</span>
                      <span>{itens.length === 1 ? "1 ação" : `${itens.length} ações`}</span>
                    </h3>
                    <ol className="ativs">
                      {itens.map((a) => (
                        <ItemDeAtividade
                          key={a.id}
                          a={a}
                          nome={nomes[a.quem]}
                          nova={!!vistaAntes && a.quem !== quem && a.quando > vistaAntes}
                          abrir={abrir(a)}
                        />
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            )}
            {podeMais ? (
              <div className="cartao-pe">
                <button type="button" className="botao largo" disabled={carregando} onClick={() => void carregarMais()}>
                  {carregando ? "Carregando…" : "Ver mais antigas"}
                </button>
              </div>
            ) : null}
          </Cartao>
        </div>

        <div className="c4 pilha lado-fixo">
          <Cartao titulo="Últimos 30 dias">
            {recentes.length === 0 ? (
              <p className="mudo pequeno">Sem ações nos últimos 30 dias.</p>
            ) : (
              <div className="sobra-trilho">
                <Trilho
                  total={recentes.length}
                  rotulo={`${nomes.a}: ${contagem.a} ações; ${nomes.b}: ${contagem.b} ações`}
                  segmentos={[
                    { classe: "seg-a", valor: contagem.a },
                    { classe: "seg-b", valor: contagem.b },
                  ]}
                />
                <ul className="legenda">
                  <li><span className="amostra seg-a" /><span className="rotulo">{nomes.a}</span><span className="num">{contagem.a}</span></li>
                  <li><span className="amostra seg-b" /><span className="rotulo">{nomes.b}</span><span className="num">{contagem.b}</span></li>
                </ul>
                <dl className="conta" style={{ marginTop: 6 }}>
                  {porGrupo.filter((g) => g.n > 0).map((g) => (
                    <div key={g.valor}>
                      <dt>{g.rotulo}</dt>
                      <dd className="num">{g.n}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </Cartao>
          <p className="pequeno mudo nota-historico">
            O histórico é só de leitura: ninguém consegue editar nem apagar o que ficou registrado.
          </p>
        </div>
      </div>
    </>
  );
}

function ItemDeAtividade({ a, nome, nova, abrir }: { a: Atividade; nome: string; nova: boolean; abrir: (() => void) | null }) {
  const { Icone, tom } = aparencia(a);
  const edicao = a.mudancas.some((m) => m.de && m.para);
  const soDepois = !edicao && a.mudancas.every((m) => !m.de);
  return (
    <li className={`ativ ${nova ? "nova" : ""}`}>
      <span className={`ativ-icone tom-${tom}`} aria-hidden="true">
        <Icone size={15} strokeWidth={2} />
      </span>
      <div className="ativ-corpo">
        <p className="ativ-texto">
          <Avatar pessoa={a.quem} nome={nome} tamanho="p" />
          <span>
            <strong>{nome}</strong> {a.resumo}
            {nova ? <span className="ativ-novo">Novo</span> : null}
          </span>
        </p>
        {a.mudancas.length > 0 ? (
          edicao ? (
            <dl className="mudancas">
              {a.mudancas.map((m, i) => (
                <div key={i}>
                  <dt>{m.campo}</dt>
                  <dd>
                    {m.de ? <del>{m.de}</del> : null}
                    {m.de && m.para ? <ArrowRight size={13} strokeWidth={2} aria-label="para" /> : null}
                    {m.para ? <ins>{m.para}</ins> : null}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className={`ativ-detalhe ${soDepois ? "" : "apagado"}`}>
              {a.mudancas.map((m) => `${m.campo === "Arquivo" ? "" : `${m.campo}: `}${m.para || m.de}`).join(" · ")}
            </p>
          )
        ) : null}
      </div>
      <div className="ativ-fim">
        <time dateTime={a.quando}>{horaLocal(a.quando)}</time>
        {abrir ? (
          <button type="button" className="ligacao pequeno" onClick={abrir}>Abrir</button>
        ) : null}
      </div>
    </li>
  );
}
