"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import useSWR from "swr";
import { ErroDeAcao, aplicar, planejar, type Acao, type Patch } from "@/lib/acoes";
import { hoje as hojeAgora, mesDe } from "@/lib/datas";
import type { FixaDoMes } from "@/lib/dominio";
import { descrever, descreverComprovante, novoIdDeAtividade } from "@/lib/atividade";
import { TAMANHO_MAXIMO, tamanhoLegivel } from "@/lib/comprovantes";
import type {
  Atividade, Comprovante, Dados, Dono, Fixa, Lancamento, Natureza, PessoaId, TipoCategoria, TipoLancamento,
} from "@/lib/tipos";
import { prepararArquivo } from "./preparar-arquivo";

export type PedidoDeLancamento =
  | { modo: "novo"; tipo?: TipoLancamento; valor?: number; pagoPor?: PessoaId }
  | { modo: "editar"; lancamento: Lancamento }
  | { modo: "pagar"; conta: FixaDoMes };

/** Editar uma conta fixa, ou criar uma nova já com tipo e dono escolhidos. */
export type PedidoDeFixa = { fixa: Fixa | null; tipo?: TipoCategoria; deQuem?: Dono; natureza?: Natureza };

interface App {
  dados: Dados;
  hoje: string;
  mes: string;
  setMes: (m: string) => void;
  quem: PessoaId;
  setQuem: (p: PessoaId) => void;
  nomes: Record<PessoaId, string>;
  temLogin: boolean;
  /** `aoGravar` recebe os ids criados, depois que o banco confirmou. */
  executar: (acao: Acao, feito?: string, aoGravar?: (ids: string[]) => void) => Promise<boolean>;
  enviarComprovantes: (dono: string, arquivos: File[]) => Promise<void>;
  apagarComprovante: (c: Comprovante) => Promise<boolean>;
  urlDoComprovante: (c: Comprovante, baixar?: boolean) => string;
  avisar: (mensagem: string) => void;
  pedidoLancamento: PedidoDeLancamento | null;
  abrirLancamento: (p: PedidoDeLancamento | null) => void;
  pedidoFixa: PedidoDeFixa | null;
  abrirFixa: (p: PedidoDeFixa | null) => void;
}

const Contexto = createContext<App | null>(null);

export function useApp(): App {
  const app = useContext(Contexto);
  if (!app) throw new Error("useApp fora do Provedor");
  return app;
}

class ErroDeRede extends Error {}

async function buscar(url: string): Promise<Dados> {
  const r = await fetch(url, { cache: "no-store" });
  if (r.status === 401) {
    window.location.href = "/entrar";
    throw new ErroDeRede("Sessão expirada.");
  }
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { erro?: string };
    throw new ErroDeRede(j.erro ?? "Não foi possível carregar os dados.");
  }
  const d = (await r.json()) as Dados;
  return { ...d, comprovantes: d.comprovantes ?? [], atividades: d.atividades ?? [] };
}

/** Põe a atividade no topo do histórico da tela, sem repetir. */
function anotarNaTela(d: Dados, a: Atividade | null): Dados {
  if (!a) return d;
  return { ...d, atividades: [a, ...(d.atividades ?? []).filter((x) => x.id !== a.id)] };
}

/** Em demonstração, os arquivos ficam só nesta aba. */
const arquivosDaDemo = new Map<string, string>();

function gerarId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("");
}

export function Provedor({
  inicial,
  quemInicial,
  temLogin,
  children,
}: {
  inicial: Dados;
  quemInicial: PessoaId;
  temLogin: boolean;
  children: ReactNode;
}) {
  const demo = inicial.demo;
  const { data, mutate } = useSWR<Dados>("/api/dados", buscar, {
    fallbackData: inicial,
    // Em demonstração nada é gravado: recarregar apagaria o que a pessoa acabou de fazer.
    revalidateOnMount: false,
    revalidateIfStale: !demo,
    revalidateOnFocus: !demo,
    revalidateOnReconnect: !demo,
    refreshInterval: demo ? 0 : 60_000,
    focusThrottleInterval: 10_000,
    keepPreviousData: true,
  });
  const dados = data ?? inicial;

  const [hoje, setHoje] = useState(hojeAgora);
  const [mes, setMes] = useState(() => mesDe(hojeAgora()));
  const [quem, definirQuem] = useState<PessoaId>(quemInicial);
  const [aviso, setAviso] = useState<{ texto: string; n: number } | null>(null);
  const [pedidoLancamento, abrirLancamento] = useState<PedidoDeLancamento | null>(null);
  const [pedidoFixa, abrirFixa] = useState<PedidoDeFixa | null>(null);
  const dadosRef = useRef(dados);
  dadosRef.current = dados;

  // O app pode ficar aberto de um dia para o outro.
  useEffect(() => {
    const conferir = () => setHoje((h) => (h === hojeAgora() ? h : hojeAgora()));
    document.addEventListener("visibilitychange", conferir);
    return () => document.removeEventListener("visibilitychange", conferir);
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 3200);
    return () => clearTimeout(t);
  }, [aviso]);

  const avisar = useCallback((texto: string) => setAviso({ texto, n: Date.now() }), []);

  const setQuem = useCallback((p: PessoaId) => {
    document.cookie = `quem=${p}; path=/; max-age=31536000; samesite=lax`;
    definirQuem(p);
  }, []);

  const executar = useCallback(
    async (acao: Acao, feito?: string, aoGravar?: (ids: string[]) => void): Promise<boolean> => {
      const ids: string[] = [];
      let patch: Patch;
      try {
        patch = planejar(acao, dadosRef.current, {
          quem,
          agora: new Date().toISOString(),
          novoId: () => {
            const id = gerarId();
            ids.push(id);
            return id;
          },
        });
      } catch (e) {
        avisar(e instanceof ErroDeAcao ? e.message : "Não foi possível fazer isso.");
        return false;
      }
      // O histórico mostra na hora; o servidor grava o dele e a próxima leitura substitui este.
      const atividade = descrever(acao, dadosRef.current, patch, { id: novoIdDeAtividade(), quando: new Date().toISOString(), quem });
      const depois = (d: Dados) => anotarNaTela(aplicar(d, patch), atividade);
      if (demo) {
        // Demonstração: nada vai ao servidor; a mudança vive só nesta aba.
        await mutate((atual) => depois(atual ?? dadosRef.current), { revalidate: false });
        if (feito) avisar(feito);
        aoGravar?.(ids);
        return true;
      }
      try {
        await mutate(
          async (atual) => {
            const r = await fetch("/api/acao", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ acao, ids }),
            });
            if (r.status === 401) window.location.href = "/entrar";
            if (!r.ok) {
              const j = (await r.json().catch(() => ({}))) as { erro?: string };
              throw new ErroDeRede(j.erro ?? "Não foi possível gravar. Nada foi alterado.");
            }
            return depois(atual ?? dadosRef.current);
          },
          {
            optimisticData: (atual) => depois(atual ?? dadosRef.current),
            rollbackOnError: true,
            revalidate: true,
          },
        );
        if (feito) avisar(feito);
        aoGravar?.(ids);
        return true;
      } catch (e) {
        avisar(e instanceof ErroDeRede ? e.message : "Sem conexão. Nada foi alterado.");
        return false;
      }
    },
    [avisar, demo, mutate, quem],
  );

  const enviarComprovantes = useCallback(
    async (dono: string, arquivos: File[]) => {
      let enviados = 0;
      for (const original of arquivos) {
        const arquivo = await prepararArquivo(original);
        if (arquivo.size > TAMANHO_MAXIMO) {
          avisar(`${original.name} tem ${tamanhoLegivel(arquivo.size)}; o limite é 3 MB.`);
          continue;
        }
        let comprovante: Comprovante;
        if (demo) {
          const id = crypto.randomUUID().replace(/-/g, "");
          arquivosDaDemo.set(id, URL.createObjectURL(arquivo));
          comprovante = {
            id, dono, nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size,
            criadoEm: new Date().toISOString(), criadoPor: quem,
          };
        } else {
          const corpo = new FormData();
          corpo.append("dono", dono);
          corpo.append("arquivo", arquivo, arquivo.name);
          try {
            const r = await fetch("/api/comprovantes", { method: "POST", body: corpo });
            if (r.status === 401) window.location.href = "/entrar";
            const j = (await r.json().catch(() => ({}))) as { comprovante?: Comprovante; erro?: string };
            if (!r.ok || !j.comprovante) {
              avisar(j.erro ?? "Não foi possível anexar o comprovante.");
              continue;
            }
            comprovante = j.comprovante;
          } catch {
            avisar("Sem conexão. O comprovante não foi anexado.");
            continue;
          }
        }
        await mutate((atual) => {
          const d = atual ?? dadosRef.current;
          const nota = descreverComprovante("anexar", comprovante, d, { id: novoIdDeAtividade(), quando: new Date().toISOString(), quem });
          return anotarNaTela({ ...d, comprovantes: [...(d.comprovantes ?? []), comprovante] }, nota);
        }, { revalidate: false });
        enviados++;
      }
      if (enviados > 0) avisar(enviados === 1 ? "Comprovante anexado" : `${enviados} comprovantes anexados`);
    },
    [avisar, demo, mutate, quem],
  );

  const apagarComprovante = useCallback(
    async (c: Comprovante) => {
      const tirar = (d: Dados) =>
        anotarNaTela(
          { ...d, comprovantes: (d.comprovantes ?? []).filter((x) => x.id !== c.id) },
          descreverComprovante("apagar", c, d, { id: `apagar${c.id}`.slice(0, 32), quando: new Date().toISOString(), quem }),
        );
      if (demo) {
        await mutate((atual) => tirar(atual ?? dadosRef.current), { revalidate: false });
        avisar("Comprovante apagado");
        return true;
      }
      try {
        await mutate(
          async (atual) => {
            const r = await fetch(`/api/comprovantes/${c.id}`, { method: "DELETE" });
            if (r.status === 401) window.location.href = "/entrar";
            if (!r.ok) {
              const j = (await r.json().catch(() => ({}))) as { erro?: string };
              throw new ErroDeRede(j.erro ?? "Não foi possível apagar o comprovante.");
            }
            return tirar(atual ?? dadosRef.current);
          },
          { optimisticData: (atual) => tirar(atual ?? dadosRef.current), rollbackOnError: true, revalidate: false },
        );
        avisar("Comprovante apagado");
        return true;
      } catch (e) {
        avisar(e instanceof ErroDeRede ? e.message : "Sem conexão. Nada foi apagado.");
        return false;
      }
    },
    [avisar, demo, mutate, quem],
  );

  const urlDoComprovante = useCallback(
    (c: Comprovante, baixar = false) =>
      demo ? (arquivosDaDemo.get(c.id) ?? "") : `/api/comprovantes/${c.id}${baixar ? "?baixar=1" : ""}`,
    [demo],
  );

  const app = useMemo<App>(
    () => ({
      dados,
      hoje,
      mes,
      setMes,
      quem,
      setQuem,
      nomes: { a: dados.config.nomeA || "Pessoa 1", b: dados.config.nomeB || "Pessoa 2" },
      temLogin,
      executar,
      enviarComprovantes,
      apagarComprovante,
      urlDoComprovante,
      avisar,
      pedidoLancamento,
      abrirLancamento,
      pedidoFixa,
      abrirFixa,
    }),
    [
      dados, hoje, mes, quem, setQuem, temLogin, executar, enviarComprovantes, apagarComprovante, urlDoComprovante,
      avisar, pedidoLancamento, pedidoFixa,
    ],
  );

  return (
    <Contexto.Provider value={app}>
      {children}
      <div aria-live="polite">
        {aviso ? (
          <div className="aviso-rodape" key={aviso.n} role="status">
            {aviso.texto}
          </div>
        ) : null}
      </div>
    </Contexto.Provider>
  );
}
