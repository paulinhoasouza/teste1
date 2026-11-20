import { z } from "zod";
import { dataNoMes, dataValida, mesValido } from "./datas";
import { expandirParcelas, fixaNoMes, outra } from "./dominio";
import { previstoDa, simular } from "./salario";
import type { Categoria, Config, Dados, Fixa, Lancamento, PessoaId } from "./tipos";

/** Erro que pode ser mostrado à pessoa como está. */
export class ErroDeAcao extends Error {}

const pessoa = z.enum(["a", "b"]);
const dono = z.enum(["a", "b", "casal"]);
const cor = z.enum(["azul", "laranja", "verde", "rosa", "oliva"]);
const centavos = z.number().int().min(0).max(99_999_999_99);
const parte = z.number().int().min(0).max(100);
const texto = (max: number) => z.string().trim().max(max);

const camposLancamento = {
  tipo: z.enum(["despesa", "receita", "acerto"]),
  data: z.string(),
  descricao: texto(120),
  valor: centavos,
  categoria: z.string().max(60),
  pagoPor: pessoa,
  deQuem: dono,
  parteA: parte,
};

const camposFixa = {
  descricao: texto(120).min(1),
  tipo: z.enum(["despesa", "receita"]),
  valor: centavos,
  dia: z.number().int().min(1).max(31),
  categoria: z.string().max(60),
  pagoPor: pessoa,
  deQuem: dono,
  parteA: parte,
  ativa: z.boolean(),
  inicio: z.string().optional(),
  fim: z.string().optional(),
  bruto: centavos.optional(),
  regime: z.enum(["clt", "outro"]).optional(),
  dependentes: z.number().int().min(0).max(20).optional(),
  outrosDescontos: centavos.optional(),
  natureza: z.enum(["conta", "assinatura"]).optional(),
  periodicidade: z.enum(["mensal", "anual"]).optional(),
  mesAnual: z.number().int().min(0).max(12).optional(),
};

export const esquemaAcao = z.discriminatedUnion("acao", [
  z.object({
    acao: z.literal("lancamento.criar"),
    ...camposLancamento,
    parcelas: z.number().int().min(1).max(48),
    fixaId: z.string().max(60).optional(),
    mesRef: z.string().optional(),
  }),
  z.object({
    acao: z.literal("lancamento.editar"),
    id: z.string().min(1),
    ...Object.fromEntries(Object.entries(camposLancamento).map(([k, v]) => [k, v.optional()])) as {
      [K in keyof typeof camposLancamento]: z.ZodOptional<(typeof camposLancamento)[K]>;
    },
  }),
  z.object({ acao: z.literal("lancamento.remover"), id: z.string().min(1), grupo: z.boolean() }),
  z.object({ acao: z.literal("fixa.salvar"), id: z.string().optional(), ...camposFixa }),
  z.object({ acao: z.literal("fixa.remover"), id: z.string().min(1) }),
  z.object({
    acao: z.literal("fixas.pagarMes"),
    mes: z.string(),
    ids: z.array(z.string().min(1)).min(1).max(100),
  }),
  z.object({
    acao: z.literal("categoria.salvar"),
    id: z.string().optional(),
    nome: texto(40).min(1),
    tipo: z.enum(["despesa", "receita"]),
    orcamento: centavos,
    arquivada: z.boolean().optional(),
  }),
  z.object({
    acao: z.literal("config.salvar"),
    nomeA: texto(24).min(1),
    nomeB: texto(24).min(1),
    corA: cor,
    corB: cor,
    parteAPadrao: parte,
  }),
]);

export type Acao = z.infer<typeof esquemaAcao>;

export interface Alteracao<T> {
  salvar?: T[];
  remover?: string[];
}

/** O que uma ação muda. O servidor grava; o cliente aplica na tela. */
export interface Patch {
  lancamentos?: Alteracao<Lancamento>;
  fixas?: Alteracao<Fixa>;
  categorias?: Alteracao<Categoria>;
  config?: Config;
}

export interface Contexto {
  quem: PessoaId;
  agora: string;
  novoId: () => string;
}

function validarLancamento(l: Lancamento, dados: Dados): Lancamento {
  if (l.valor <= 0) throw new ErroDeAcao("Informe um valor maior que zero.");
  if (!dataValida(l.data)) throw new ErroDeAcao("Essa data não existe.");
  if (l.tipo === "acerto") return { ...l, categoria: "", deQuem: outra(l.pagoPor), parteA: 50 };
  const cat = dados.categorias.find((c) => c.id === l.categoria);
  if (!cat) throw new ErroDeAcao("Escolha uma categoria.");
  if (cat.tipo !== l.tipo) throw new ErroDeAcao("Essa categoria é de outro tipo de lançamento.");
  return l;
}

function slug(nome: string): string {
  return (
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "categoria"
  );
}

function idLivre(baseId: string, usados: Set<string>): string {
  if (!usados.has(baseId)) return baseId;
  let i = 2;
  while (usados.has(`${baseId}-${i}`)) i++;
  return `${baseId}-${i}`;
}

export function planejar(entrada: unknown, dados: Dados, ctx: Contexto): Patch {
  const lido = esquemaAcao.safeParse(entrada);
  if (!lido.success) throw new ErroDeAcao("Não deu para entender esse pedido. Revise os campos.");
  const acao = lido.data;

  switch (acao.acao) {
    case "lancamento.criar": {
      const { acao: _a, parcelas, fixaId = "", mesRef = "", ...campos } = acao;
      if (fixaId) {
        if (!mesValido(mesRef)) throw new ErroDeAcao("Mês da conta fixa inválido.");
        if (!dados.fixas.some((f) => f.id === fixaId)) throw new ErroDeAcao("Essa conta fixa não existe mais.");
        if (dados.lancamentos.some((l) => l.fixaId === fixaId && l.mesRef === mesRef)) {
          throw new ErroDeAcao("Essa conta já foi lançada neste mês.");
        }
      }
      if (!dataValida(campos.data)) throw new ErroDeAcao("Essa data não existe.");
      const n = campos.tipo === "despesa" && !fixaId ? parcelas : 1;
      const grupo = n > 1 ? ctx.novoId() : "";
      const salvar = expandirParcelas(campos.data, campos.valor, n).map((p) =>
        validarLancamento(
          {
            ...campos,
            id: ctx.novoId(),
            data: p.data,
            valor: p.valor,
            parcela: p.parcela,
            grupo,
            fixaId,
            mesRef: fixaId ? mesRef : "",
            criadoEm: ctx.agora,
            criadoPor: ctx.quem,
          },
          dados,
        ),
      );
      return { lancamentos: { salvar } };
    }

    case "lancamento.editar": {
      const { acao: _a, id, ...campos } = acao;
      const atual = dados.lancamentos.find((l) => l.id === id);
      if (!atual) throw new ErroDeAcao("Esse lançamento não existe mais.");
      const mudancas = Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== undefined));
      return { lancamentos: { salvar: [validarLancamento({ ...atual, ...mudancas }, dados)] } };
    }

    case "lancamento.remover": {
      const atual = dados.lancamentos.find((l) => l.id === acao.id);
      if (!atual) throw new ErroDeAcao("Esse lançamento não existe mais.");
      const remover =
        acao.grupo && atual.grupo
          ? dados.lancamentos.filter((l) => l.grupo === atual.grupo).map((l) => l.id)
          : [atual.id];
      return { lancamentos: { remover } };
    }

    case "fixa.salvar": {
      const {
        acao: _a, id, inicio = "", fim = "",
        bruto: brutoInformado = 0, regime = "clt", dependentes = 0, outrosDescontos = 0,
        natureza = "conta", periodicidade = "mensal", mesAnual = 0,
        ...campos
      } = acao;
      if (natureza === "assinatura" && campos.tipo !== "despesa") throw new ErroDeAcao("Assinatura é sempre uma despesa.");
      if (periodicidade === "anual" && (mesAnual < 1 || mesAnual > 12)) throw new ErroDeAcao("Escolha o mês da cobrança anual.");
      const ciclo = { natureza, periodicidade, mesAnual: periodicidade === "anual" ? mesAnual : 0 };
      if (inicio && !mesValido(inicio)) throw new ErroDeAcao("Mês de início inválido.");
      if (fim && !mesValido(fim)) throw new ErroDeAcao("Mês de término inválido.");
      if (inicio && fim && fim < inicio) throw new ErroDeAcao("O término não pode vir antes do começo.");
      // Só receita tem salário bruto; numa despesa os campos de simulação são ignorados.
      const bruto = campos.tipo === "receita" ? brutoInformado : 0;
      const simulacao = { bruto, regime, dependentes: bruto ? dependentes : 0, outrosDescontos: bruto ? outrosDescontos : 0 };
      const valor = bruto ? simular(simulacao).liquido : campos.valor;
      if (bruto && valor <= 0) throw new ErroDeAcao("Os descontos não podem ser maiores que o salário bruto.");
      if (valor <= 0) throw new ErroDeAcao("Informe um valor maior que zero.");
      const cat = dados.categorias.find((c) => c.id === campos.categoria);
      if (!cat || cat.tipo !== campos.tipo) throw new ErroDeAcao("Escolha uma categoria.");
      if (id && !dados.fixas.some((f) => f.id === id)) throw new ErroDeAcao("Essa conta fixa não existe mais.");
      return { fixas: { salvar: [{ ...campos, ...simulacao, ...ciclo, valor, id: id || ctx.novoId(), inicio, fim }] } };
    }

    case "fixas.pagarMes": {
      if (!mesValido(acao.mes)) throw new ErroDeAcao("Mês inválido.");
      const pagas = new Set(dados.lancamentos.filter((l) => l.fixaId && l.mesRef === acao.mes).map((l) => l.fixaId));
      const salvar: Lancamento[] = [];
      for (const id of new Set(acao.ids)) {
        const f = dados.fixas.find((x) => x.id === id);
        // Só despesas: salário e outras receitas pedem o valor real, uma a uma.
        if (!f || f.tipo !== "despesa" || pagas.has(id) || !fixaNoMes(f, acao.mes)) continue;
        salvar.push(
          validarLancamento(
            {
              id: ctx.novoId(),
              data: dataNoMes(acao.mes, f.dia),
              tipo: "despesa",
              descricao: f.descricao,
              valor: previstoDa(f),
              categoria: f.categoria,
              pagoPor: f.pagoPor,
              deQuem: f.deQuem,
              parteA: f.parteA,
              parcela: "",
              grupo: "",
              fixaId: f.id,
              mesRef: acao.mes,
              criadoEm: ctx.agora,
              criadoPor: ctx.quem,
            },
            dados,
          ),
        );
      }
      if (salvar.length === 0) throw new ErroDeAcao("Nada para marcar: essas contas já estão pagas neste mês.");
      return { lancamentos: { salvar } };
    }

    case "fixa.remover": {
      if (!dados.fixas.some((f) => f.id === acao.id)) throw new ErroDeAcao("Essa conta fixa não existe mais.");
      return { fixas: { remover: [acao.id] } };
    }

    case "categoria.salvar": {
      if (acao.id) {
        const atual = dados.categorias.find((c) => c.id === acao.id);
        if (!atual) throw new ErroDeAcao("Essa categoria não existe mais.");
        return {
          categorias: {
            salvar: [
              {
                ...atual,
                nome: acao.nome,
                orcamento: acao.orcamento,
                arquivada: acao.arquivada ?? atual.arquivada,
              },
            ],
          },
        };
      }
      const usados = new Set(dados.categorias.map((c) => c.id));
      const ordem = Math.max(0, ...dados.categorias.map((c) => c.ordem)) + 1;
      return {
        categorias: {
          salvar: [
            {
              id: idLivre(slug(acao.nome), usados),
              nome: acao.nome,
              tipo: acao.tipo,
              orcamento: acao.orcamento,
              ordem,
              arquivada: false,
            },
          ],
        },
      };
    }

    case "config.salvar": {
      const { acao: _a, ...config } = acao;
      if (config.corA === config.corB) throw new ErroDeAcao("Escolham uma cor diferente para cada um.");
      return { config };
    }
  }
}

function alterar<T extends { id: string }>(lista: T[], alt?: Alteracao<T>): T[] {
  if (!alt) return lista;
  const fora = new Set(alt.remover ?? []);
  const novos = new Map((alt.salvar ?? []).map((x) => [x.id, x]));
  const saida = lista.filter((x) => !fora.has(x.id)).map((x) => novos.get(x.id) ?? x);
  const existentes = new Set(lista.map((x) => x.id));
  for (const x of novos.values()) if (!existentes.has(x.id)) saida.push(x);
  return saida;
}

/** Aplica um patch aos dados em memória (tela do cliente e modo demonstração). */
export function aplicar(dados: Dados, patch: Patch): Dados {
  return {
    ...dados,
    config: patch.config ?? dados.config,
    lancamentos: alterar(dados.lancamentos, patch.lancamentos),
    fixas: alterar(dados.fixas, patch.fixas),
    categorias: alterar(dados.categorias, patch.categorias),
  };
}
