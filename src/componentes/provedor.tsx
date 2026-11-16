"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import useSWR from "swr";
import { ErroDeAcao, aplicar, planejar, type Acao, type Patch } from "@/lib/acoes";
import { hoje as hojeAgora, mesDe } from "@/lib/datas";
import type { FixaDoMes } from "@/lib/dominio";
import type { Dados, Fixa, Lancamento, PessoaId, TipoLancamento } from "@/lib/tipos";

export type PedidoDeLancamento =
  | { modo: "novo"; tipo?: TipoLancamento; valor?: number; pagoPor?: PessoaId }
  | { modo: "editar"; lancamento: Lancamento }
  | { modo: "pagar"; conta: FixaDoMes };

export type PedidoDeFixa = { fixa: Fixa | null };

interface App {
  dados: Dados;
  hoje: string;
  mes: string;
  setMes: (m: string) => void;
  quem: PessoaId;
  setQuem: (p: PessoaId) => void;
  nomes: Record<PessoaId, string>;
  temLogin: boolean;
  executar: (acao: Acao, feito?: string) => Promise<boolean>;
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
  return (await r.json()) as Dados;
}

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
    async (acao: Acao, feito?: string): Promise<boolean> => {
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
      if (demo) {
        // Demonstração: nada vai ao servidor; a mudança vive só nesta aba.
        await mutate((atual) => aplicar(atual ?? dadosRef.current, patch), { revalidate: false });
        if (feito) avisar(feito);
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
            return aplicar(atual ?? dadosRef.current, patch);
          },
          {
            optimisticData: (atual) => aplicar(atual ?? dadosRef.current, patch),
            rollbackOnError: true,
            revalidate: true,
          },
        );
        if (feito) avisar(feito);
        return true;
      } catch (e) {
        avisar(e instanceof ErroDeRede ? e.message : "Sem conexão. Nada foi alterado.");
        return false;
      }
    },
    [avisar, demo, mutate, quem],
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
      avisar,
      pedidoLancamento,
      abrirLancamento,
      pedidoFixa,
      abrirFixa,
    }),
    [dados, hoje, mes, quem, setQuem, temLogin, executar, avisar, pedidoLancamento, pedidoFixa],
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
