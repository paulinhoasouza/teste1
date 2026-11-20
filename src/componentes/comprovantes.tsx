"use client";

import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Paperclip, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ehImagem, MAXIMO_POR_LANCAMENTO, tamanhoLegivel } from "@/lib/comprovantes";
import type { Comprovante } from "@/lib/tipos";
import { useApp } from "./provedor";

const ACEITOS = "image/*,application/pdf";

/** Um arquivo escolhido que ainda não subiu (lançamento novo: sobe quando o lançamento for gravado). */
export interface Pendente {
  chave: string;
  arquivo: File;
  url: string;
}

export function novoPendente(arquivo: File): Pendente {
  return { chave: crypto.randomUUID(), arquivo, url: URL.createObjectURL(arquivo) };
}

/**
 * Os comprovantes de um lançamento no formulário.
 * Editando, cada arquivo sobe na hora; num lançamento novo, ficam pendentes até salvar.
 */
export function AreaDeComprovantes({
  existentes,
  pendentes,
  aoEscolher,
  aoTirarPendente,
  enviando,
}: {
  existentes: Comprovante[];
  pendentes: Pendente[];
  aoEscolher: (arquivos: File[]) => void;
  aoTirarPendente: (chave: string) => void;
  enviando: number;
}) {
  const { urlDoComprovante } = useApp();
  const [aberto, setAberto] = useState<number | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const total = existentes.length + pendentes.length + enviando;
  const cabe = total < MAXIMO_POR_LANCAMENTO;

  return (
    <div className="campo">
      <span className="rotulo-campo" id="rotulo-comprovantes">Comprovantes</span>
      <ul className="anexos" aria-labelledby="rotulo-comprovantes">
        {existentes.map((c, i) => (
          <li key={c.id}>
            <button
              type="button"
              className="anexo"
              aria-label={`Abrir ${c.nome || "comprovante"}`}
              onClick={() => setAberto(i)}
            >
              <Miniatura tipo={c.tipo} url={urlDoComprovante(c)} />
            </button>
          </li>
        ))}
        {pendentes.map((p) => (
          <li key={p.chave} className="anexo-pendente">
            <span className="anexo" title={p.arquivo.name}>
              <Miniatura tipo={p.arquivo.type} url={p.url} />
            </span>
            <button
              type="button"
              className="anexo-tirar"
              aria-label={`Tirar ${p.arquivo.name}`}
              onClick={() => aoTirarPendente(p.chave)}
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </li>
        ))}
        {Array.from({ length: enviando }, (_, i) => (
          <li key={`enviando-${i}`}>
            <span className="anexo enviando" role="status" aria-label="Enviando comprovante">
              <span className="girando" />
            </span>
          </li>
        ))}
        {cabe ? (
          <li>
            <button type="button" className="anexo anexo-novo" onClick={() => entrada.current?.click()}>
              <Paperclip size={18} strokeWidth={1.75} />
              <span>{total === 0 ? "Anexar" : "Mais"}</span>
            </button>
          </li>
        ) : null}
      </ul>
      <input
        ref={entrada}
        type="file"
        accept={ACEITOS}
        multiple
        hidden
        onChange={(e) => {
          const lista = Array.from(e.target.files ?? []).slice(0, MAXIMO_POR_LANCAMENTO - total);
          e.target.value = "";
          if (lista.length) aoEscolher(lista);
        }}
      />
      <p className="campo-dica">
        {pendentes.length > 0
          ? "Sobe junto quando você salvar o lançamento."
          : "Foto da nota, do recibo ou o PDF do boleto. As fotos são reduzidas antes de enviar."}
      </p>
      {aberto !== null && existentes.length > 0 ? (
        <Visor lista={existentes} inicial={Math.min(aberto, existentes.length - 1)} aoFechar={() => setAberto(null)} />
      ) : null}
    </div>
  );
}

function Miniatura({ tipo, url }: { tipo: string; url: string }) {
  const [falhou, setFalhou] = useState(false);
  if (ehImagem(tipo) && url && !falhou) {
    return <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFalhou(true)} />;
  }
  return (
    <span className="anexo-doc">
      <FileText size={22} strokeWidth={1.5} />
      <span>{tipo === "application/pdf" ? "PDF" : "Foto"}</span>
    </span>
  );
}

/** Tela cheia para ler o comprovante: setas (ou deslizar) entre os do mesmo lançamento, baixar, abrir, apagar. */
export function Visor({ lista, inicial, aoFechar }: { lista: Comprovante[]; inicial: number; aoFechar: () => void }) {
  const { urlDoComprovante, apagarComprovante, nomes } = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  const [i, setI] = useState(inicial);
  const [confirmar, setConfirmar] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const toque = useRef<{ x: number; y: number } | null>(null);
  const atual = lista[Math.min(i, lista.length - 1)];

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  useEffect(() => {
    setConfirmar(false);
    setFalhou(false);
  }, [i]);
  // A lista encolheu (apagou o último): fecha.
  useEffect(() => {
    if (lista.length === 0) aoFechar();
    else if (i > lista.length - 1) setI(lista.length - 1);
  }, [lista.length, i, aoFechar]);

  const ir = (passo: number) => setI((x) => (x + passo + lista.length) % lista.length);
  const quando = useMemo(
    () => (atual?.criadoEm ? new Date(atual.criadoEm).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }) : ""),
    [atual?.criadoEm],
  );
  if (!atual) return null;
  const url = urlDoComprovante(atual);
  const imagem = ehImagem(atual.tipo) && !falhou;
  const quem = atual.criadoPor === "a" || atual.criadoPor === "b" ? nomes[atual.criadoPor] : "";

  return (
    <dialog
      ref={ref}
      className="visor"
      aria-label={`Comprovante ${i + 1} de ${lista.length}`}
      onCancel={(e) => {
        // O visor fica dentro do formulário na árvore do React: sem isto, o Esc fecharia os dois.
        e.preventDefault();
        e.stopPropagation();
        aoFechar();
      }}
      onKeyDown={(e) => {
        if (lista.length > 1 && e.key === "ArrowRight") ir(1);
        if (lista.length > 1 && e.key === "ArrowLeft") ir(-1);
      }}
    >
      <div className="visor-topo">
        <div className="visor-titulo">
          <strong>{atual.nome || "Comprovante"}</strong>
          <span>
            {[tamanhoLegivel(atual.tamanho), quem && `anexado por ${quem}`, quando].filter(Boolean).join(" · ")}
          </span>
        </div>
        <button type="button" className="visor-botao" aria-label="Fechar" onClick={aoFechar}>
          <X size={20} strokeWidth={2} />
        </button>
      </div>

      <div
        className="visor-palco"
        onClick={(e) => {
          if (e.target === e.currentTarget) aoFechar();
        }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          toque.current = t && e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
        }}
        onTouchEnd={(e) => {
          const ini = toque.current;
          const t = e.changedTouches[0];
          toque.current = null;
          if (!ini || !t || lista.length < 2) return;
          const dx = t.clientX - ini.x;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(t.clientY - ini.y) * 1.5) ir(dx < 0 ? 1 : -1);
        }}
      >
        {imagem ? (
          <img key={atual.id} src={url} alt={atual.nome || "Comprovante"} onError={() => setFalhou(true)} />
        ) : atual.tipo === "application/pdf" ? (
          <object key={atual.id} data={url} type="application/pdf" aria-label={atual.nome || "Comprovante em PDF"}>
            <SemPrevia url={url} />
          </object>
        ) : (
          <SemPrevia url={url} />
        )}
        {lista.length > 1 ? (
          <>
            <button type="button" className="visor-seta esquerda" aria-label="Anterior" onClick={() => ir(-1)}>
              <ChevronLeft size={22} strokeWidth={2} />
            </button>
            <button type="button" className="visor-seta direita" aria-label="Próximo" onClick={() => ir(1)}>
              <ChevronRight size={22} strokeWidth={2} />
            </button>
          </>
        ) : null}
      </div>

      <div className="visor-pe">
        {lista.length > 1 ? (
          <span className="visor-contagem" aria-live="polite">{i + 1} de {lista.length}</span>
        ) : <span />}
        {confirmar ? (
          <div className="visor-acoes">
            <span className="visor-pergunta">Apagar este comprovante?</span>
            <button type="button" className="visor-botao texto" onClick={() => setConfirmar(false)}>Cancelar</button>
            <button
              type="button"
              className="visor-botao texto perigo"
              onClick={() => {
                setConfirmar(false);
                void apagarComprovante(atual);
              }}
            >
              Apagar
            </button>
          </div>
        ) : (
          <div className="visor-acoes">
            <a className="visor-botao" href={url} target="_blank" rel="noopener" aria-label="Abrir em outra aba" title="Abrir em outra aba">
              <ExternalLink size={19} strokeWidth={1.75} />
            </a>
            <a
              className="visor-botao"
              href={urlDoComprovante(atual, true)}
              download={atual.nome || "comprovante"}
              aria-label="Baixar"
              title="Baixar"
            >
              <Download size={19} strokeWidth={1.75} />
            </a>
            <button type="button" className="visor-botao" aria-label="Apagar" title="Apagar" onClick={() => setConfirmar(true)}>
              <Trash2 size={19} strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}

function SemPrevia({ url }: { url: string }) {
  return (
    <div className="visor-sem-previa">
      <FileText size={44} strokeWidth={1.25} />
      <p>Este navegador não mostra o arquivo aqui.</p>
      <a className="botao" href={url} target="_blank" rel="noopener">Abrir o arquivo</a>
    </div>
  );
}
