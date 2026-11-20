/** Valores em dinheiro são sempre centavos inteiros dentro do app. */
export type PessoaId = "a" | "b";
export type Dono = PessoaId | "casal";
export type TipoLancamento = "despesa" | "receita" | "acerto";
export type TipoCategoria = "despesa" | "receita";
export type CorPessoa = "azul" | "laranja" | "verde" | "rosa" | "oliva";

export interface Lancamento {
  id: string;
  /** yyyy-mm-dd */
  data: string;
  tipo: TipoLancamento;
  descricao: string;
  valor: number;
  categoria: string;
  /** Despesa: quem pagou. Receita: quem recebeu. Acerto: quem transferiu. */
  pagoPor: PessoaId;
  /** De quem é a despesa ou a receita. */
  deQuem: Dono;
  /** Parte da pessoa A, de 0 a 100, quando é do casal. */
  parteA: number;
  /** "2/10" quando parcelado; vazio caso contrário. */
  parcela: string;
  grupo: string;
  /** Conta fixa que este lançamento quita, e em que mês (yyyy-mm). */
  fixaId: string;
  mesRef: string;
  criadoEm: string;
  criadoPor: string;
}

export interface Categoria {
  id: string;
  nome: string;
  tipo: TipoCategoria;
  /** Orçamento mensal em centavos; 0 = sem orçamento. */
  orcamento: number;
  ordem: number;
  arquivada: boolean;
}

export type Regime = "clt" | "outro";
export type Natureza = "conta" | "assinatura";
export type Periodicidade = "mensal" | "anual";

export interface Fixa {
  id: string;
  descricao: string;
  tipo: TipoCategoria;
  /** Valor previsto por mês. Numa receita com bruto, é o líquido simulado. */
  valor: number;
  dia: number;
  categoria: string;
  pagoPor: PessoaId;
  deQuem: Dono;
  parteA: number;
  ativa: boolean;
  /** yyyy-mm; vazio = sempre. */
  inicio: string;
  fim: string;
  /** Receita informada pelo bruto: o líquido é simulado até ser confirmado. 0 = sem simulação. */
  bruto: number;
  regime: Regime;
  dependentes: number;
  outrosDescontos: number;
  /** Conta da casa ou assinatura (streaming, jogos, apps). */
  natureza: Natureza;
  periodicidade: Periodicidade;
  /** Mês da cobrança (1 a 12) quando é anual; 0 quando é mensal. */
  mesAnual: number;
}

export interface Config {
  nomeA: string;
  nomeB: string;
  corA: CorPessoa;
  corB: CorPessoa;
  parteAPadrao: number;
}

/** Foto ou PDF anexado a um lançamento. O arquivo em si é buscado só quando alguém abre. */
export interface Comprovante {
  id: string;
  /** Id do lançamento, ou o grupo quando é uma compra parcelada: vale para todas as parcelas. */
  dono: string;
  nome: string;
  tipo: string;
  tamanho: number;
  criadoEm: string;
  criadoPor: string;
}

export type TipoAtividade =
  | "lancamento.criar" | "lancamento.editar" | "lancamento.remover"
  | "conta.pagar" | "salario.confirmar"
  | "fixa.criar" | "fixa.editar" | "fixa.remover"
  | "assinatura.criar" | "assinatura.editar" | "assinatura.remover"
  | "categoria.criar" | "categoria.editar"
  | "ajustes.editar"
  | "comprovante.anexar" | "comprovante.apagar"
  | "acesso.entrar" | "acesso.sair" | "acesso.senha";

/** Um campo que mudou. Em criações e exclusões, `de` ou `para` fica vazio. */
export interface Mudanca {
  campo: string;
  de: string;
  para: string;
}

/** Uma ação de alguém no app, guardada para sempre, com o texto pronto no momento em que aconteceu. */
export interface Atividade {
  id: string;
  quando: string;
  quem: PessoaId;
  tipo: TipoAtividade;
  /** Começa pelo verbo, sem a pessoa: "lançou Feira, R$ 92,10". */
  resumo: string;
  mudancas: Mudanca[];
  /** Lançamento (ou grupo de parcelas), conta fixa ou categoria a que se refere. */
  alvo: string;
}

export interface Dados {
  demo: boolean;
  config: Config;
  categorias: Categoria[];
  fixas: Fixa[];
  lancamentos: Lancamento[];
  comprovantes: Comprovante[];
  /** As mais recentes primeiro; as mais antigas vêm sob demanda. */
  atividades: Atividade[];
}
