"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Titulo } from "@/componentes/casca";
import { LinhaLancamento, useNomeDaCategoria } from "@/componentes/linhas";
import { useApp } from "@/componentes/provedor";
import { Cartao, Segmentado, Trilho } from "@/componentes/ui";
import { diaPorExtenso, nomeDoMes } from "@/lib/datas";
import { formatar } from "@/lib/dinheiro";
import { lancamentosDoMes } from "@/lib/dominio";
import type { Dono, Lancamento, TipoLancamento } from "@/lib/tipos";

type FiltroTipo = "tudo" | TipoLancamento;

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function Lancamentos() {
  const { dados, mes, hoje, nomes, abrirLancamento } = useApp();
  const categoria = useNomeDaCategoria();
  const [tipo, setTipo] = useState<FiltroTipo>("tudo");
  const [dono, setDono] = useState<"todos" | Dono>("todos");
  const [cat, setCat] = useState("");
  const [busca, setBusca] = useState("");
  const campoBusca = useRef<HTMLInputElement>(null);
  // Vindo do atalho de busca do trilho: já abre com o cursor no campo.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("busca")) campoBusca.current?.focus();
  }, []);

  const doMes = useMemo(() => lancamentosDoMes(dados.lancamentos, mes), [dados.lancamentos, mes]);
  const lista = useMemo(() => {
    const termo = semAcento(busca.trim());
    return doMes.filter(
      (l) =>
        (tipo === "tudo" || l.tipo === tipo) &&
        (dono === "todos" || (l.tipo !== "acerto" && l.deQuem === dono)) &&
        (!cat || l.categoria === cat) &&
        (!termo || semAcento(`${l.descricao} ${categoria(l.categoria)}`).includes(termo)),
    );
  }, [doMes, tipo, dono, cat, busca, categoria]);

  const dias = useMemo(() => {
    const grupos = new Map<string, Lancamento[]>();
    for (const l of lista) {
      const g = grupos.get(l.data);
      if (g) g.push(l);
      else grupos.set(l.data, [l]);
    }
    return [...grupos.entries()];
  }, [lista]);

  const despesas = lista.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor, 0);
  const receitas = lista.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor, 0);
  const porCategoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lista) if (l.tipo === "despesa") m.set(l.categoria, (m.get(l.categoria) ?? 0) + l.valor);
    return [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6);
  }, [lista]);
  const maior = porCategoria[0]?.[1] ?? 1;
  const filtrando = tipo !== "tudo" || dono !== "todos" || !!cat || !!busca.trim();
  const usadas = dados.categorias.filter((c) => doMes.some((l) => l.categoria === c.id));

  return (
    <>
      <Titulo
        titulo="Lançamentos"
        achado={`${lista.length === 1 ? "1 lançamento" : `${lista.length} lançamentos`} em ${nomeDoMes(mes)}${filtrando ? ", com os filtros abaixo" : ""}.`}
      />

      <div className="grade">
        <div className="c8">
          <div className="filtros">
            <Segmentado
              valor={tipo}
              aoMudar={setTipo}
              rotulo="Tipo"
              opcoes={[
                { valor: "tudo", rotulo: "Tudo" },
                { valor: "despesa", rotulo: "Despesas" },
                { valor: "receita", rotulo: "Receitas" },
                { valor: "acerto", rotulo: "Acertos" },
              ]}
            />
            <select className="selecao" aria-label="De quem" value={dono} onChange={(e) => setDono(e.target.value as typeof dono)}>
              <option value="todos">De todos</option>
              <option value="casal">Nosso</option>
              <option value="a">Só {nomes.a}</option>
              <option value="b">Só {nomes.b}</option>
            </select>
            <select className="selecao" aria-label="Categoria" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Toda categoria</option>
              {usadas.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            <div className="busca">
              <Search size={16} strokeWidth={1.5} aria-hidden="true" />
              <input ref={campoBusca} className="entrada" type="search" aria-label="Buscar lançamento" placeholder="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>

          <section className="cartao" aria-label="Lista de lançamentos">
            {dias.length === 0 ? (
              <p className="vazio">
                {filtrando ? "Nenhum lançamento com esses filtros." : `Nada lançado em ${nomeDoMes(mes)}.`}{" "}
                {filtrando ? (
                  <button type="button" onClick={() => { setTipo("tudo"); setDono("todos"); setCat(""); setBusca(""); }}>Limpar filtros</button>
                ) : (
                  <button type="button" onClick={() => abrirLancamento({ modo: "novo" })}>Lançar o primeiro</button>
                )}
              </p>
            ) : (
              dias.map(([data, itens]) => {
                const gastosDoDia = itens.filter((l) => l.tipo === "despesa");
                const totalDoDia = gastosDoDia.length > 1 ? gastosDoDia.reduce((s, l) => s + l.valor, 0) : 0;
                return (
                  <div key={data}>
                    <h2 className="dia" style={{ fontWeight: 400 }}>
                      <span>{diaPorExtenso(data, hoje)}</span>
                      {totalDoDia > 0 ? <span className="num">{formatar(totalDoDia)}</span> : null}
                    </h2>
                    <ul className="linhas">
                      {itens.map((l) => (
                        <LinhaLancamento key={l.id} l={l} />
                      ))}
                    </ul>
                  </div>
                );
              })
            )}
          </section>
        </div>

        <div className="c4">
          <div className="lado-fixo pilha">
            <Cartao titulo={filtrando ? "No filtro" : "No mês"}>
              <dl className="conta">
                <div><dt>Despesas</dt><dd className="num">{formatar(despesas)}</dd></div>
                <div><dt>Receitas</dt><dd className="num positivo">+{formatar(receitas)}</dd></div>
                <div className="total"><dt>Diferença</dt><dd className={`num ${receitas - despesas < 0 ? "negativo" : ""}`}>{formatar(receitas - despesas)}</dd></div>
              </dl>
            </Cartao>
            <Cartao titulo="Para onde foi">
              {porCategoria.length === 0 ? (
                <p className="vazio">Sem despesas aqui.</p>
              ) : (
                <ul className="resumo-linhas">
                  {porCategoria.map(([id, valor], i) => (
                    <li className="barra-cat" key={id}>
                      <div className="entre pequeno">
                        <span>{categoria(id)}</span>
                        <span className="num">{formatar(valor)}</span>
                      </div>
                      <Trilho fino total={maior} rotulo={`${categoria(id)}: ${formatar(valor)}`} segmentos={[{ classe: i === 0 ? "seg-casal" : "seg-leve", valor }]} />
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          </div>
        </div>
      </div>
    </>
  );
}
