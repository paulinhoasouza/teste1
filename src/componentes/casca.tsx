"use client";

import {
  CalendarCheck, CalendarPlus, ChartColumn, Check, ChevronLeft, ChevronRight, Ellipsis, History, House, List, LogOut, Plus, Repeat,
  Search, Settings, TrendingUp, Undo2, Users, X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { mesDe, nomeDoMes, somarMeses } from "@/lib/datas";
import { fixasDoMes } from "@/lib/dominio";
import { contarNovas, marcarAtividadeVista, ultimaVistaDaAtividade } from "@/lib/vista";
import { AjusteDeVidro, ReguaDeVidro, TemaRapido, TrocaDeTema } from "./aparencia";
import { BoasVindas } from "./boas-vindas";
import { FormFixa } from "./form-fixa";
import { Folha } from "./folha";
import { FormLancamento } from "./form-lancamento";
import { useApp } from "./provedor";
import { Avatar, Marca, usePilula } from "./ui";

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
  { href: "/fluxo", rotulo: "Fluxo de caixa", Icone: TrendingUp, cor: "#007e9a" },
  { href: "/casal", rotulo: "Casal", Icone: Users, cor: "#e3175e" },
];
const ORGANIZAR: Destino[] = [
  { href: "/lancamentos", rotulo: "Lançamentos", Icone: List, cor: "#636366" },
  { href: "/fixas", rotulo: "Contas fixas", Icone: CalendarCheck, cor: "#c93400" },
  { href: "/assinaturas", rotulo: "Assinaturas", Icone: Repeat, cor: "#8944ab" },
];
const AJUSTES: Destino = { href: "/ajustes", rotulo: "Ajustes", Icone: Settings, cor: "#636366" };
const ATIVIDADE: Destino = { href: "/atividade", rotulo: "Atividade", Icone: History, cor: "#5e5ce6" };
const TODOS = [...VISAO, ...ORGANIZAR, ATIVIDADE, AJUSTES];
/** Ordem da barra de cima: o dia a dia primeiro, depois o que se organiza uma vez. */
const BARRA = [VISAO[0]!, ORGANIZAR[0]!, VISAO[1]!, { ...VISAO[2]!, rotulo: "Fluxo" }, VISAO[3]!, ORGANIZAR[1]!, ORGANIZAR[2]!];
/** No celular, o que não cabe na barra de abas vai para "Mais". */
const NO_MAIS = ["/fluxo", "/casal", "/fixas", "/assinaturas", "/atividade", "/ajustes"];

export function Casca({ children }: { children: ReactNode }) {
  const { dados, nomes, mes, hoje, quem, setMes, abrirLancamento, abrirFixa } = useApp();
  const caminho = usePathname();
  const roteador = useRouter();
  const [maisAberto, setMaisAberto] = useState(false);
  const [tituloCompacto, setTituloCompacto] = useState("");
  // Para onde o toque mandou: a pílula sai na hora, sem esperar a página carregar.
  const [indo, setIndo] = useState<string | null>(null);
  const { config } = dados;
  useEffect(() => setIndo(null), [caminho]);
  const destino = indo ?? caminho;
  // Clique com Ctrl/Cmd abre em outra aba: aí a pílula fica onde está.
  const irPara = (e: React.MouseEvent, href: string) => {
    if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) setIndo(href);
  };

  // As cores de cada pessoa também na raiz, para os halos do fundo seguirem a escolha em Ajustes.
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.dataset.corA = config.corA;
    raiz.dataset.corB = config.corB;
  }, [config.corA, config.corB]);

  // O título grande some ao rolar e reaparece pequeno na barra de cima, como no iOS.
  useEffect(() => {
    const ouvir = (e: Event) => setTituloCompacto((e as CustomEvent<string>).detail);
    window.addEventListener("titulo-compacto", ouvir);
    return () => window.removeEventListener("titulo-compacto", ouvir);
  }, []);

  // Realce de luz que acompanha o cursor sobre o vidro.
  useEffect(() => {
    if (!window.matchMedia("(hover: hover)").matches) return;
    let quadro = 0;
    const mover = (e: PointerEvent) => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const alvo = (e.target as Element | null)?.closest?.(".cartao, .palco") as HTMLElement | null;
        if (!alvo) return;
        const r = alvo.getBoundingClientRect();
        alvo.style.setProperty("--mx", `${e.clientX - r.left}px`);
        alvo.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    };
    document.addEventListener("pointermove", mover, { passive: true });
    return () => {
      document.removeEventListener("pointermove", mover);
      cancelAnimationFrame(quadro);
    };
  }, []);

  // O que a outra pessoa fez desde a última vez que esta abriu a Atividade.
  const [vista, setVista] = useState("");
  useEffect(() => {
    const ler = () => {
      if (!ultimaVistaDaAtividade(quem)) marcarAtividadeVista(quem);
      setVista(ultimaVistaDaAtividade(quem));
    };
    ler();
    window.addEventListener("atividade-vista", ler);
    window.addEventListener("storage", ler);
    return () => {
      window.removeEventListener("atividade-vista", ler);
      window.removeEventListener("storage", ler);
    };
  }, [quem]);
  const novas = caminho === "/atividade" ? 0 : contarNovas(dados.atividades ?? [], quem, vista);

  // Contas e assinaturas que ainda faltam pagar no mês aberto: viram selos na barra.
  const faltam = useMemo(() => {
    const abertas = fixasDoMes(dados.fixas, dados.lancamentos, mes, hoje).filter(
      (c) => c.fixa.tipo === "despesa" && c.estado !== "paga",
    );
    return {
      "/fixas": abertas.filter((c) => c.fixa.natureza !== "assinatura").length,
      "/assinaturas": abertas.filter((c) => c.fixa.natureza === "assinatura").length,
    } as Record<string, number>;
  }, [dados.fixas, dados.lancamentos, mes, hoje]);
  const selos: Record<string, number> = { ...faltam, "/atividade": novas };

  // Posição da pílula: a aba ativa no celular ("Mais" cobre o que não cabe na barra).
  const indiceAba = maisAberto || NO_MAIS.includes(destino)
    ? 3
    : destino === "/" ? 0 : destino === "/lancamentos" ? 1 : destino === "/relatorio" ? 2 : -1;
  const topo = usePilula<HTMLElement>(destino, '[data-alvo="true"]');
  const abas = usePilula<HTMLDivElement>(indiceAba, '[data-alvo="true"]');

  if (!config.nomeA || !config.nomeB) {
    return (
      <div data-cor-a={config.corA} data-cor-b={config.corB}>
        <BoasVindas />
      </div>
    );
  }

  const atual = (href: string) => (caminho === href ? "page" : undefined);
  const noMesAtual = mes === mesDe(hoje);

  return (
    <div className="casca" data-cor-a={config.corA} data-cor-b={config.corB}>
      <header className="topo-app">
        <Link href="/" className="marca" aria-label="A dois, início">
          <span className="marca-selo"><Marca tamanho={24} /></span>
          <span className="marca-textos">
            <span className="marca-nome">A dois</span>
            <span className="marca-escopo">{nomes.a} e {nomes.b}</span>
          </span>
        </Link>
        <span className={`titulo-compacto ${tituloCompacto ? "visivel" : ""}`} aria-hidden="true">{tituloCompacto}</span>
        <nav className="nav-topo" aria-label="Principal" ref={topo.caixa}>
          <span className="nav-pilula" ref={topo.pilula} aria-hidden="true" />
          {BARRA.map(({ href, rotulo, Icone }) => (
            <Link key={href} href={href} aria-current={atual(href)} data-alvo={destino === href} onClick={(e) => irPara(e, href)}>
              <Icone size={16} strokeWidth={1.75} />
              <span>{rotulo}</span>
              {faltam[href] ? (
                <span className="selo" aria-label={`, ${faltam[href]} a pagar`}>{faltam[href]}</span>
              ) : null}
            </Link>
          ))}
        </nav>
        <div className="topo-fim">
          <span className="so-largo"><AjusteDeVidro /></span>
          <Link
            href="/atividade"
            className="icone-botao botao-atividade"
            aria-current={atual("/atividade")}
            aria-label={novas ? `Atividade, ${novas} ${novas === 1 ? "novidade" : "novidades"} de ${nomes[quem === "a" ? "b" : "a"]}` : "Atividade"}
            title="Atividade"
          >
            <History size={18} strokeWidth={1.75} />
            {novas ? <span className="selo selo-canto" aria-hidden="true">{novas > 99 ? "99+" : novas}</span> : null}
          </Link>
          <TrocaDeTema />
          <MenuQuem />
        </div>
      </header>

      <aside className="trilho-lateral" aria-label="Atalhos">
        <BotaoTrilho rotulo="Buscar lançamentos" onClick={() => {
          const campo = document.querySelector<HTMLInputElement>(".busca input");
          if (campo) campo.focus();
          else roteador.push("/lancamentos?busca=1");
        }}>
          <Search size={18} strokeWidth={1.75} />
        </BotaoTrilho>
        <BotaoTrilho rotulo="Novo lançamento" destaque onClick={() => abrirLancamento({ modo: "novo" })}>
          <Plus size={20} strokeWidth={2} />
        </BotaoTrilho>
        <BotaoTrilho rotulo="Nova conta fixa" onClick={() => abrirFixa({ fixa: null, tipo: "despesa" })}>
          <CalendarPlus size={18} strokeWidth={1.75} />
        </BotaoTrilho>
        <BotaoTrilho rotulo="Nova assinatura" onClick={() => abrirFixa({ fixa: null, tipo: "despesa", natureza: "assinatura" })}>
          <Repeat size={18} strokeWidth={1.75} />
        </BotaoTrilho>
        <span className="trilho-divisa" aria-hidden="true" />
        <BotaoTrilho rotulo="Mês anterior" onClick={() => setMes(somarMeses(mes, -1))}>
          <ChevronLeft size={18} strokeWidth={1.75} />
        </BotaoTrilho>
        <BotaoTrilho rotulo="Voltar ao mês atual" desligado={noMesAtual} onClick={() => setMes(mesDe(hoje))}>
          <Undo2 size={17} strokeWidth={1.75} />
        </BotaoTrilho>
        <BotaoTrilho rotulo="Próximo mês" onClick={() => setMes(somarMeses(mes, 1))}>
          <ChevronRight size={18} strokeWidth={1.75} />
        </BotaoTrilho>
        <span className="trilho-divisa" aria-hidden="true" />
        <Link href="/ajustes" className="trilho-botao" aria-label="Ajustes" aria-current={atual("/ajustes")} data-dica="Ajustes">
          <Settings size={18} strokeWidth={1.75} />
        </Link>
      </aside>

      <main className="principal">
        <div className="palco">
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
        <div className="abas" ref={abas.caixa}>
          <span className="aba-lente" ref={abas.pilula} aria-hidden="true" />
          {[VISAO[0]!, ORGANIZAR[0]!, VISAO[1]!].map(({ href, rotulo, Icone }, i) => (
            <Link key={href} href={href} aria-current={atual(href)} data-alvo={indiceAba === i} onClick={(e) => irPara(e, href)}>
              <Icone size={23} strokeWidth={1.75} />
              {rotulo}
            </Link>
          ))}
          <button
            type="button"
            className="aba"
            aria-haspopup="dialog"
            aria-expanded={maisAberto}
            data-alvo={indiceAba === 3}
            onClick={() => setMaisAberto(true)}
          >
            <Ellipsis size={23} strokeWidth={1.75} />
            Mais
          </button>
        </div>
        <button type="button" className="lancar" aria-label="Novo lançamento" onClick={() => abrirLancamento({ modo: "novo" })}>
          <Plus size={28} strokeWidth={2.25} />
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
                {selos[href] ? <span className="selo">{selos[href]}</span> : null}
                <ChevronRight className="seta" size={18} strokeWidth={2} />
              </Link>
            ))}
          </nav>
          <div className="painel-mais">
            <ReguaDeVidro />
            <div className="entre">
              <span>Tema escuro</span>
              <TrocaDeTema />
            </div>
          </div>
        </div>
      </Folha>

      <FormLancamento />
      <FormFixa />
    </div>
  );
}

function BotaoTrilho({
  rotulo,
  destaque,
  desligado,
  onClick,
  children,
}: {
  rotulo: string;
  destaque?: boolean;
  desligado?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`trilho-botao ${destaque ? "destaque" : ""}`}
      aria-label={rotulo}
      data-dica={rotulo}
      disabled={desligado}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function MenuQuem() {
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
          {temLogin ? null : <hr />}
          <TemaRapido />
          <hr />
          {(
            <Link href={temLogin ? "/ajustes#conta" : "/ajustes"} role="menuitem" onClick={() => setAberto(false)}>
              <Settings size={18} strokeWidth={1.5} />
              {temLogin ? "Trocar senha" : "Ajustes"}
            </Link>
          )}
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
  sobre,
  achado,
  semMes,
  mesNoTitulo,
  acao,
}: {
  titulo: string;
  /** Linha pequena acima do título, como uma saudação. */
  sobre?: ReactNode;
  achado?: ReactNode;
  semMes?: boolean;
  /** O título já é o mês: bastam as setas. */
  mesNoTitulo?: boolean;
  acao?: ReactNode;
}) {
  const { abrirLancamento } = useApp();
  const ref = useTituloCompacto(titulo);
  return (
    <div className={`titulo ${mesNoTitulo || semMes ? "junto" : ""}`}>
      <div>
        {sobre ? <p className="titulo-sobre">{sobre}</p> : null}
        <h1 ref={ref}>{titulo}</h1>
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

/** Liga o título grande ao título pequeno da barra de cima: quando um sai de vista, o outro aparece. */
export function useTituloCompacto(texto: string) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const avisar = (t: string) => window.dispatchEvent(new CustomEvent("titulo-compacto", { detail: t }));
    const obs = new IntersectionObserver(([e]) => avisar(e!.isIntersecting ? "" : texto), { rootMargin: "-54px 0px 0px 0px" });
    obs.observe(el);
    return () => {
      obs.disconnect();
      avisar("");
    };
  }, [texto]);
  return ref;
}
