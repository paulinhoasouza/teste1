"use client";

import {
  CalendarCheck, ChartColumn, Check, ChevronLeft, ChevronRight, Ellipsis, House, List, LogOut, Plus, Repeat, Settings, Users, X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { mesDe, nomeDoMes, somarMeses } from "@/lib/datas";
import { BoasVindas } from "./boas-vindas";
import { FormFixa } from "./form-fixa";
import { Folha } from "./folha";
import { FormLancamento } from "./form-lancamento";
import { useApp } from "./provedor";
import { Avatar, Marca } from "./ui";

interface Destino {
  href: string;
  rotulo: string;
  Icone: LucideIcon;
  /** Cor do ícone na lista "Mais", como nos Ajustes do iOS. */
  cor: string;
}

const VISAO: Destino[] = [
  { href: "/", rotulo: "Início", Icone: House, cor: "#0071e3" },
  { href: "/relatorio", rotulo: "Relatório", Icone: ChartColumn, cor: "#248a3d" },
  { href: "/casal", rotulo: "Casal", Icone: Users, cor: "#e3175e" },
];
const ORGANIZAR: Destino[] = [
  { href: "/lancamentos", rotulo: "Lançamentos", Icone: List, cor: "#636366" },
  { href: "/fixas", rotulo: "Contas fixas", Icone: CalendarCheck, cor: "#c93400" },
  { href: "/assinaturas", rotulo: "Assinaturas", Icone: Repeat, cor: "#8944ab" },
];
const AJUSTES: Destino = { href: "/ajustes", rotulo: "Ajustes", Icone: Settings, cor: "#636366" };
const TODOS = [...VISAO, ...ORGANIZAR, AJUSTES];
/** No celular, o que não cabe na barra de abas vai para "Mais". */
const NO_MAIS = ["/casal", "/fixas", "/assinaturas", "/ajustes"];

export function Casca({ children }: { children: ReactNode }) {
  const { dados, nomes, abrirLancamento } = useApp();
  const caminho = usePathname();
  const [maisAberto, setMaisAberto] = useState(false);
  const { config } = dados;

  if (!config.nomeA || !config.nomeB) {
    return (
      <div data-cor-a={config.corA} data-cor-b={config.corB}>
        <BoasVindas />
      </div>
    );
  }

  const atual = (href: string) => (caminho === href ? "page" : undefined);

  return (
    <div className="casca" data-cor-a={config.corA} data-cor-b={config.corB}>
      <aside className="lateral">
        <Link href="/" className="marca" aria-label="A dois, início">
          <Marca tamanho={34} />
          <span>
            <span className="marca-nome" style={{ display: "block" }}>A dois</span>
            <span className="marca-escopo" style={{ display: "block" }}>{nomes.a} e {nomes.b}</span>
          </span>
        </Link>
        <nav className="nav" aria-label="Principal">
          {VISAO.map(({ href, rotulo, Icone }) => (
            <Link key={href} href={href} aria-current={atual(href)}>
              <Icone size={18} strokeWidth={1.75} />
              {rotulo}
            </Link>
          ))}
          <p className="nav-grupo">Organizar</p>
          {[...ORGANIZAR, AJUSTES].map(({ href, rotulo, Icone }) => (
            <Link key={href} href={href} aria-current={atual(href)}>
              <Icone size={18} strokeWidth={1.75} />
              {rotulo}
            </Link>
          ))}
        </nav>
        <div className="lateral-fim">
          <MenuQuem />
        </div>
      </aside>

      <header className="barra-topo">
        <Link href="/" className="marca" aria-label="A dois, início">
          <Marca tamanho={30} />
          <span className="marca-nome">A dois</span>
        </Link>
        <nav className="nav-topo" aria-label="Principal">
          {TODOS.map(({ href, rotulo }) => (
            <Link key={href} href={href} aria-current={atual(href)}>
              {rotulo}
            </Link>
          ))}
        </nav>
        <MenuQuem compacto />
      </header>

      <main className="principal">
        <div className="principal-dentro">
          {dados.demo ? (
            <p className="faixa-demo">
              <span>Estes são dados de exemplo. O que você lançar aqui some ao recarregar a página.</span>
              <Link href="/ajustes#dados">Ligar o banco de dados</Link>
            </p>
          ) : null}
          {children}
        </div>
      </main>

      <nav className="nav-baixo" aria-label="Principal, no rodapé">
        {[VISAO[0]!, ORGANIZAR[0]!].map(({ href, rotulo, Icone }) => (
          <Link key={href} href={href} aria-current={atual(href)}>
            <Icone size={24} strokeWidth={1.75} />
            {rotulo}
          </Link>
        ))}
        <button type="button" className="lancar" aria-label="Novo lançamento" onClick={() => abrirLancamento({ modo: "novo" })}>
          <Plus size={26} strokeWidth={2.25} />
        </button>
        <Link href="/relatorio" aria-current={atual("/relatorio")}>
          <ChartColumn size={24} strokeWidth={1.75} />
          Relatório
        </Link>
        <button
          type="button"
          className="aba"
          aria-haspopup="dialog"
          aria-expanded={maisAberto}
          aria-current={NO_MAIS.includes(caminho) ? "page" : undefined}
          style={NO_MAIS.includes(caminho) ? { color: "var(--accent)" } : undefined}
          onClick={() => setMaisAberto(true)}
        >
          <Ellipsis size={24} strokeWidth={1.75} />
          Mais
        </button>
      </nav>

      <Folha aberta={maisAberto} aoFechar={() => setMaisAberto(false)} rotuloId="titulo-mais">
        <div className="folha-topo">
          <h2 id="titulo-mais">Mais</h2>
          <button type="button" className="fechar" aria-label="Fechar" onClick={() => setMaisAberto(false)}>
            <X size={16} strokeWidth={2.25} />
          </button>
        </div>
        <div className="folha-corpo">
          <nav className="grupo-lista" aria-label="Mais destinos">
            {TODOS.filter((d) => NO_MAIS.includes(d.href)).map(({ href, rotulo, Icone, cor }) => (
              <Link key={href} href={href} aria-current={atual(href)} onClick={() => setMaisAberto(false)}>
                <span className="icone-quadrado" style={{ background: cor }}>
                  <Icone size={17} strokeWidth={2} />
                </span>
                {rotulo}
                <ChevronRight className="seta" size={18} strokeWidth={2} />
              </Link>
            ))}
          </nav>
        </div>
      </Folha>

      <FormLancamento />
      <FormFixa />
    </div>
  );
}

function MenuQuem({ compacto }: { compacto?: boolean }) {
  const { quem, setQuem, nomes, temLogin } = useApp();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  const sair = async () => {
    await fetch("/api/sair", { method: "POST" });
    window.location.href = "/entrar";
  };

  return (
    <div className="quem" ref={ref}>
      <button
        type="button"
        className="quem-botao"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={temLogin ? `Conta de ${nomes[quem]}` : `Usando como ${nomes[quem]}. Trocar de pessoa`}
        onClick={() => setAberto((v) => !v)}
      >
        <Avatar pessoa={quem} nome={nomes[quem]} tamanho="m" />
        {compacto ? null : (
          <span>
            <span className="quem-nome" style={{ display: "block" }}>{nomes[quem]}</span>
            <span className="mudo" style={{ display: "block" }}>{temLogin ? "Sua conta" : "Usando agora"}</span>
          </span>
        )}
      </button>
      {aberto ? (
        <div className="quem-menu" role="menu" aria-label={temLogin ? "Sua conta" : "Quem está usando"}>
          {temLogin
            ? null
            : (["a", "b"] as const).map((p) => (
                <button key={p} type="button" role="menuitemradio" aria-checked={quem === p} onClick={() => { setQuem(p); setAberto(false); }}>
                  <Avatar pessoa={p} nome={nomes[p]} tamanho="p" />
                  {nomes[p]}
                  {quem === p ? <Check className="marcado" size={16} strokeWidth={1.75} /> : null}
                </button>
              ))}
          {compacto || temLogin ? (
            <Link href={temLogin ? "/ajustes#conta" : "/ajustes"} role="menuitem" onClick={() => setAberto(false)}>
              <Settings size={18} strokeWidth={1.5} />
              {temLogin ? "Trocar senha" : "Ajustes"}
            </Link>
          ) : null}
          {temLogin ? (
            <button type="button" role="menuitem" onClick={sair}>
              <LogOut size={18} strokeWidth={1.5} />
              Sair
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function TrocaMes({ compacto }: { compacto?: boolean }) {
  const { mes, setMes, hoje } = useApp();
  const noAtual = mes === mesDe(hoje);
  if (compacto) {
    return (
      <div className="mes" role="group" aria-label="Mês">
        <button type="button" aria-label="Mês anterior" onClick={() => setMes(somarMeses(mes, -1))}>
          <ChevronLeft size={18} strokeWidth={1.75} />
        </button>
        {noAtual ? null : (
          <button type="button" style={{ width: "auto", padding: "0 8px", fontSize: 14, fontWeight: 600, color: "var(--text)" }} onClick={() => setMes(mesDe(hoje))}>
            Mês atual
          </button>
        )}
        <button type="button" aria-label="Próximo mês" onClick={() => setMes(somarMeses(mes, 1))}>
          <ChevronRight size={18} strokeWidth={1.75} />
        </button>
      </div>
    );
  }
  return (
    <div className="mes" role="group" aria-label="Mês">
      <button type="button" aria-label="Mês anterior" onClick={() => setMes(somarMeses(mes, -1))}>
        <ChevronLeft size={18} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className="mes-nome"
        style={{ width: "auto", padding: "0 4px" }}
        aria-label={noAtual ? nomeDoMes(mes) : `${nomeDoMes(mes)}. Voltar ao mês atual`}
        onClick={() => setMes(mesDe(hoje))}
      >
        <span className="mes-nome" style={{ display: "block" }}>{nomeDoMes(mes)}</span>
      </button>
      <button type="button" aria-label="Próximo mês" onClick={() => setMes(somarMeses(mes, 1))}>
        <ChevronRight size={18} strokeWidth={1.75} />
      </button>
    </div>
  );
}

export function Titulo({
  titulo,
  achado,
  semMes,
  mesNoTitulo,
  acao,
}: {
  titulo: string;
  achado?: ReactNode;
  semMes?: boolean;
  /** O título já é o mês: bastam as setas. */
  mesNoTitulo?: boolean;
  acao?: ReactNode;
}) {
  const { abrirLancamento } = useApp();
  return (
    <div className={`titulo ${mesNoTitulo || semMes ? "junto" : ""}`}>
      <div>
        <h1>{titulo}</h1>
        {achado ? <p className="titulo-achado">{achado}</p> : null}
      </div>
      <div className="titulo-acoes">
        {semMes ? null : <TrocaMes compacto={mesNoTitulo} />}
        {acao ?? (
          <button type="button" className="botao primario so-desktop" onClick={() => abrirLancamento({ modo: "novo" })}>
            <Plus size={18} strokeWidth={2} />
            Lançar
          </button>
        )}
      </div>
    </div>
  );
}
