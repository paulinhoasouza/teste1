import type { Patch } from "./acoes";
import { donoDoComprovante, tamanhoLegivel } from "./comprovantes";
import { nomeDoMes, nomeDoMesCurto } from "./datas";
import { formatar } from "./dinheiro";
import { outra } from "./dominio";
import { ehSimulada, previstoDa } from "./salario";
import type {
  Atividade, Categoria, Comprovante, CorPessoa, Dados, Dono, Fixa, Lancamento, Mudanca, PessoaId, TipoAtividade,
} from "./tipos";

/**
 * Transforma o que alguém fez num registro legível, com o texto pronto e o antes/depois de cada campo.
 * É pura: roda igual no servidor (que grava) e no aparelho (que mostra na hora, antes da resposta).
 * O texto é congelado no momento: renomear uma categoria depois não reescreve o passado.
 */

type Base = Pick<Atividade, "id" | "quando" | "quem">;
type Nomes = Record<PessoaId, string>;

export type GrupoDeAtividade = "lancamentos" | "contas" | "comprovantes" | "ajustes" | "acesso";

export function grupoDaAtividade(t: TipoAtividade): GrupoDeAtividade {
  if (t.startsWith("lancamento.") || t === "conta.pagar" || t === "salario.confirmar") return "lancamentos";
  if (t.startsWith("fixa.") || t.startsWith("assinatura.")) return "contas";
  if (t.startsWith("comprovante.")) return "comprovantes";
  if (t.startsWith("acesso.")) return "acesso";
  return "ajustes";
}

const CORES: Record<CorPessoa, string> = { azul: "Azul", laranja: "Laranja", verde: "Verde", rosa: "Rosa", oliva: "Oliva" };
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const data = (d: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "");
const nomesDe = (d: Dados): Nomes => ({ a: d.config.nomeA || "Pessoa 1", b: d.config.nomeB || "Pessoa 2" });
const nomeDaCategoria = (cats: Categoria[], id: string) => cats.find((c) => c.id === id)?.nome ?? (id ? id : "Sem categoria");
const divisao = (parteA: number, nomes: Nomes) => `${nomes.a} ${parteA}%, ${nomes.b} ${100 - parteA}%`;
const deQuemE = (dono: Dono, parteA: number, nomes: Nomes) =>
  dono === "casal" ? `Dos dois, ${divisao(parteA, nomes)}` : `Só de ${nomes[dono]}`;
const valorComSinal = (l: Pick<Lancamento, "tipo" | "valor">) => `${l.tipo === "receita" ? "+" : ""}${formatar(l.valor)}`;

function rotuloDoLancamento(l: Lancamento, d: Dados): string {
  const nomes = nomesDe(d);
  if (l.tipo === "acerto") return `o acerto de ${nomes[l.pagoPor]} para ${nomes[outra(l.pagoPor)]}`;
  return l.descricao || nomeDaCategoria(d.categorias, l.categoria);
}

/** Compara campo a campo; só entra o que mudou. */
function comparar<T>(de: T, para: T, campos: [string, (x: T) => string][]): Mudanca[] {
  const saida: Mudanca[] = [];
  for (const [campo, ler] of campos) {
    const a = ler(de);
    const b = ler(para);
    if (a !== b) saida.push({ campo, de: a, para: b });
  }
  return saida;
}

/** Só o depois (criação) ou só o antes (exclusão). */
const fotografar = <T>(x: T, campos: [string, (x: T) => string][], lado: "de" | "para"): Mudanca[] =>
  campos
    .map(([campo, ler]) => ({ campo, valor: ler(x) }))
    .filter((m) => m.valor)
    .map(({ campo, valor }) => ({ campo, de: lado === "de" ? valor : "", para: lado === "para" ? valor : "" }));

function camposDoLancamento(d: Dados): [string, (l: Lancamento) => string][] {
  const nomes = nomesDe(d);
  return [
    ["Descrição", (l) => l.descricao],
    ["Valor", (l) => formatar(l.valor)],
    ["Tipo", (l) => (l.tipo === "despesa" ? "Despesa" : l.tipo === "receita" ? "Receita" : "Acerto")],
    ["Categoria", (l) => (l.tipo === "acerto" ? "" : nomeDaCategoria(d.categorias, l.categoria))],
    ["Data", (l) => data(l.data)],
    ["Quem pagou", (l) => (l.tipo === "despesa" || l.tipo === "acerto" ? nomes[l.pagoPor] : "")],
    ["De quem é", (l) => (l.tipo === "acerto" ? "" : deQuemE(l.deQuem, l.parteA, nomes))],
  ];
}

function cobranca(f: Fixa): string {
  return f.periodicidade === "anual" ? `Uma vez por ano, em ${MESES[f.mesAnual - 1] ?? "?"}` : "Todo mês";
}

function camposDaFixa(d: Dados): [string, (f: Fixa) => string][] {
  const nomes = nomesDe(d);
  return [
    ["Descrição", (f) => f.descricao],
    ["Valor", (f) => (f.bruto ? "" : formatar(f.valor))],
    ["Salário bruto", (f) => (f.bruto ? formatar(f.bruto) : "")],
    ["Regime", (f) => (f.bruto ? (f.regime === "clt" ? "CLT" : f.regime.toUpperCase()) : "")],
    ["Dependentes", (f) => (f.bruto ? String(f.dependentes) : "")],
    ["Outros descontos", (f) => (f.bruto ? formatar(f.outrosDescontos) : "")],
    ["Dia", (f) => `Dia ${f.dia}`],
    ["Categoria", (f) => nomeDaCategoria(d.categorias, f.categoria)],
    ["Quem paga", (f) => (f.tipo === "despesa" ? nomes[f.pagoPor] : "")],
    ["De quem é", (f) => deQuemE(f.deQuem, f.parteA, nomes)],
    ["Situação", (f) => (f.ativa ? "Ativa" : "Pausada")],
    ["Começa em", (f) => (f.inicio ? nomeDoMes(f.inicio) : "Desde o começo")],
    ["Termina em", (f) => (f.fim ? nomeDoMes(f.fim) : "Sem término")],
    ["Cobrança", cobranca],
  ];
}

function nomeDaFixa(f: Fixa): { tipo: "fixa" | "assinatura"; artigo: string } {
  if (f.natureza === "assinatura") return { tipo: "assinatura", artigo: "a assinatura" };
  return { tipo: "fixa", artigo: f.tipo === "receita" ? "a receita fixa" : "a conta fixa" };
}

/** O que aconteceu numa ação do app. null quando nada mudou de fato (salvar sem alterar). */
export function descrever(acao: unknown, antes: Dados, patch: Patch, base: Base): Atividade | null {
  const nome = typeof acao === "object" && acao !== null ? String((acao as { acao?: unknown }).acao ?? "") : "";
  const nomes = nomesDe(antes);
  const nova = (tipo: TipoAtividade, resumo: string, mudancas: Mudanca[], alvo: string): Atividade => ({
    ...base, tipo, resumo, mudancas, alvo,
  });
  const salvos = patch.lancamentos?.salvar ?? [];

  switch (nome) {
    case "lancamento.criar": {
      const l = salvos[0];
      if (!l) return null;
      const fixa = l.fixaId ? antes.fixas.find((f) => f.id === l.fixaId) : undefined;
      if (fixa) {
        const mes = nomeDoMesCurto(l.mesRef);
        if (fixa.tipo === "receita") {
          if (ehSimulada(fixa)) {
            const simulado = previstoDa(fixa);
            const mudancas = simulado === l.valor ? [] : [{ campo: "Valor", de: `${formatar(simulado)} (simulado)`, para: formatar(l.valor) }];
            return nova("salario.confirmar", `confirmou ${fixa.descricao} de ${mes}: ${valorComSinal(l)}`, mudancas, fixa.id);
          }
          return nova("conta.pagar", `registrou o recebimento de ${fixa.descricao} de ${mes}, ${valorComSinal(l)}`, [], fixa.id);
        }
        const mudancas = l.valor === previstoDa(fixa) ? [] : [{ campo: "Valor", de: `${formatar(previstoDa(fixa))} (previsto)`, para: formatar(l.valor) }];
        return nova("conta.pagar", `pagou ${fixa.descricao} de ${mes}, ${formatar(l.valor)}`, mudancas, fixa.id);
      }
      const detalhes = fotografar(l, camposDoLancamento(antes).filter(([c]) => c !== "Descrição" && c !== "Valor" && c !== "Tipo"), "para");
      const rotulo = rotuloDoLancamento(l, antes);
      if (salvos.length > 1) {
        const total = salvos.reduce((s, x) => s + x.valor, 0);
        return nova(
          "lancamento.criar",
          `lançou ${rotulo} em ${salvos.length} parcelas de ${formatar(l.valor)} (${formatar(total)} no total)`,
          detalhes,
          l.grupo || l.id,
        );
      }
      if (l.tipo === "acerto") {
        return nova("lancamento.criar", `registrou um acerto: ${nomes[l.pagoPor]} transferiu ${formatar(l.valor)} para ${nomes[outra(l.pagoPor)]}`, detalhes, l.id);
      }
      const texto = l.tipo === "receita" ? `lançou a receita ${rotulo}, ${valorComSinal(l)}` : `lançou ${rotulo}, ${formatar(l.valor)}`;
      return nova("lancamento.criar", texto, detalhes, l.id);
    }

    case "lancamento.editar": {
      const novo = salvos[0];
      const velho = novo && antes.lancamentos.find((x) => x.id === novo.id);
      if (!novo || !velho) return null;
      const mudancas = comparar(velho, novo, camposDoLancamento(antes));
      if (mudancas.length === 0) return null;
      const parcela = velho.parcela ? ` (parcela ${velho.parcela})` : "";
      return nova("lancamento.editar", `alterou ${rotuloDoLancamento(velho, antes)}${parcela}`, mudancas, velho.grupo || velho.id);
    }

    case "lancamento.remover": {
      const fora = new Set(patch.lancamentos?.remover ?? []);
      const removidos = antes.lancamentos.filter((l) => fora.has(l.id));
      const l = removidos[0];
      if (!l) return null;
      const rotulo = rotuloDoLancamento(l, antes);
      const foto = fotografar(l, camposDoLancamento(antes).filter(([c]) => c !== "Descrição" && c !== "Tipo"), "de");
      if (removidos.length > 1) {
        const total = removidos.reduce((s, x) => s + x.valor, 0);
        return nova("lancamento.remover", `excluiu as ${removidos.length} parcelas de ${rotulo}, ${formatar(total)} no total`, foto, l.grupo || l.id);
      }
      const fixa = l.fixaId ? antes.fixas.find((f) => f.id === l.fixaId) : undefined;
      if (fixa) {
        return nova("lancamento.remover", `desfez o pagamento de ${fixa.descricao} de ${nomeDoMesCurto(l.mesRef)}, ${formatar(l.valor)}`, foto, fixa.id);
      }
      const texto = l.parcela ? `excluiu a parcela ${l.parcela} de ${rotulo}, ${formatar(l.valor)}` : `excluiu ${rotulo}, ${valorComSinal(l)}`;
      return nova("lancamento.remover", texto, foto, l.grupo || l.id);
    }

    case "fixas.pagarMes": {
      if (salvos.length === 0) return null;
      const mes = nomeDoMesCurto(salvos[0]!.mesRef);
      if (salvos.length === 1) {
        const l = salvos[0]!;
        return nova("conta.pagar", `pagou ${l.descricao} de ${mes}, ${formatar(l.valor)}`, [], l.fixaId);
      }
      const total = salvos.reduce((s, x) => s + x.valor, 0);
      return nova(
        "conta.pagar",
        `marcou ${salvos.length} contas como pagas em ${mes}, ${formatar(total)} no total`,
        salvos.map((l) => ({ campo: l.descricao, de: "", para: formatar(l.valor) })),
        "",
      );
    }

    case "fixa.salvar": {
      const f = patch.fixas?.salvar?.[0];
      if (!f) return null;
      const velha = antes.fixas.find((x) => x.id === f.id);
      const { tipo, artigo } = nomeDaFixa(velha ?? f);
      if (velha) {
        const mudancas = comparar(velha, f, camposDaFixa(antes));
        if (mudancas.length === 0) return null;
        return nova(`${tipo}.editar`, `alterou ${artigo} ${velha.descricao}`, mudancas, f.id);
      }
      const detalhes = fotografar(f, camposDaFixa(antes).filter(([c]) => ["Categoria", "Quem paga", "De quem é", "Começa em", "Termina em"].includes(c)), "para")
        .filter((m) => m.para !== "Desde o começo" && m.para !== "Sem término");
      if (tipo === "assinatura") {
        const preco = f.periodicidade === "anual" ? `${formatar(f.valor)} por ano, em ${MESES[f.mesAnual - 1]}` : `${formatar(f.valor)} por mês`;
        return nova("assinatura.criar", `adicionou a assinatura ${f.descricao}, ${preco}`, detalhes, f.id);
      }
      const preco = f.bruto ? `bruto de ${formatar(f.bruto)}` : `${f.tipo === "receita" ? "+" : ""}${formatar(f.valor)} todo dia ${f.dia}`;
      return nova("fixa.criar", `criou ${artigo} ${f.descricao}, ${preco}`, detalhes, f.id);
    }

    case "fixa.remover": {
      const id = patch.fixas?.remover?.[0];
      const f = id ? antes.fixas.find((x) => x.id === id) : undefined;
      if (!f) return null;
      const { tipo, artigo } = nomeDaFixa(f);
      const foto = fotografar(f, camposDaFixa(antes).filter(([c]) => ["Valor", "Salário bruto", "Dia", "Categoria", "De quem é", "Cobrança"].includes(c)), "de");
      return nova(`${tipo}.remover`, `removeu ${artigo} ${f.descricao}`, foto, f.id);
    }

    case "categoria.salvar": {
      const c = patch.categorias?.salvar?.[0];
      if (!c) return null;
      const velha = antes.categorias.find((x) => x.id === c.id);
      const orcamento = (x: Categoria) => (x.orcamento ? formatar(x.orcamento) : "Sem orçamento");
      if (!velha) {
        return nova("categoria.criar", `criou a categoria ${c.nome}${c.orcamento ? `, orçamento de ${formatar(c.orcamento)}` : ""}`, [], c.id);
      }
      const mudancas = comparar(velha, c, [
        ["Nome", (x) => x.nome],
        ["Orçamento", orcamento],
        ["Situação", (x) => (x.arquivada ? "Arquivada" : "Em uso")],
      ]);
      if (mudancas.length === 0) return null;
      if (mudancas.length === 1 && mudancas[0]!.campo === "Situação") {
        return nova("categoria.editar", `${c.arquivada ? "arquivou" : "voltou a usar"} a categoria ${c.nome}`, [], c.id);
      }
      return nova("categoria.editar", `alterou a categoria ${velha.nome}`, mudancas, c.id);
    }

    case "config.salvar": {
      const c = patch.config;
      if (!c) return null;
      const depois: Nomes = { a: c.nomeA, b: c.nomeB };
      const v = antes.config;
      const mudancas: Mudanca[] = [];
      if (v.nomeA !== c.nomeA) mudancas.push({ campo: "Nome", de: v.nomeA, para: c.nomeA });
      if (v.nomeB !== c.nomeB) mudancas.push({ campo: "Nome", de: v.nomeB, para: c.nomeB });
      if (v.corA !== c.corA) mudancas.push({ campo: `Cor de ${nomes.a}`, de: CORES[v.corA], para: CORES[c.corA] });
      if (v.corB !== c.corB) mudancas.push({ campo: `Cor de ${nomes.b}`, de: CORES[v.corB], para: CORES[c.corB] });
      if (v.parteAPadrao !== c.parteAPadrao) {
        mudancas.push({ campo: "Divisão padrão", de: divisao(v.parteAPadrao, nomes), para: divisao(c.parteAPadrao, depois) });
      }
      if (mudancas.length === 0) return null;
      return nova("ajustes.editar", "alterou os ajustes do casal", mudancas, "");
    }
  }
  return null;
}

export function descreverComprovante(tipo: "anexar" | "apagar", c: Comprovante, d: Dados, base: Base): Atividade {
  const l = d.lancamentos.find((x) => donoDoComprovante(x) === c.dono);
  const onde = l ? rotuloDoLancamento(l, d) : "";
  return {
    ...base,
    tipo: tipo === "anexar" ? "comprovante.anexar" : "comprovante.apagar",
    resumo: tipo === "anexar" ? `anexou um comprovante${onde ? ` em ${onde}` : ""}` : `apagou um comprovante${onde ? ` de ${onde}` : ""}`,
    mudancas: [{ campo: "Arquivo", de: tipo === "apagar" ? arquivo(c) : "", para: tipo === "anexar" ? arquivo(c) : "" }],
    alvo: c.dono,
  };
}

const arquivo = (c: Comprovante) => [c.nome, tamanhoLegivel(c.tamanho)].filter(Boolean).join(", ");

export function descreverAcesso(tipo: "acesso.entrar" | "acesso.sair" | "acesso.senha", base: Base): Atividade {
  const resumo = tipo === "acesso.entrar" ? "entrou no app" : tipo === "acesso.sair" ? "saiu do app" : "trocou a senha";
  return { ...base, tipo, resumo, mudancas: [], alvo: "" };
}

export function novoIdDeAtividade(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
