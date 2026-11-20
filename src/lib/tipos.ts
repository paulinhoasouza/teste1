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
}

export interface Config {
  nomeA: string;
  nomeB: string;
  corA: CorPessoa;
  corB: CorPessoa;
  parteAPadrao: number;
}

export interface Dados {
  demo: boolean;
  config: Config;
  categorias: Categoria[];
  fixas: Fixa[];
  lancamentos: Lancamento[];
}
