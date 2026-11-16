import type { Categoria, Config } from "./tipos";

/** Como um banco novo começa; os nomes mudam em Ajustes. */
export const CONFIG_INICIAL: Config = {
  nomeA: "Paulo",
  nomeB: "Giovana",
  corA: "azul",
  corB: "laranja",
  parteAPadrao: 50,
};

const despesas = [
  ["mercado", "Mercado"],
  ["restaurantes", "Restaurantes e delivery"],
  ["transporte", "Transporte"],
  ["moradia", "Moradia"],
  ["contas-da-casa", "Contas da casa"],
  ["saude", "Saúde"],
  ["lazer", "Lazer"],
  ["compras", "Compras"],
  ["assinaturas", "Assinaturas"],
  ["outros", "Outros"],
] as const;

const receitas = [
  ["salario", "Salário"],
  ["outras-receitas", "Outras receitas"],
] as const;

export const CATEGORIAS_INICIAIS: Categoria[] = [
  ...despesas.map(([id, nome], i) => ({ id, nome, tipo: "despesa" as const, orcamento: 0, ordem: i + 1, arquivada: false })),
  ...receitas.map(([id, nome], i) => ({
    id, nome, tipo: "receita" as const, orcamento: 0, ordem: despesas.length + i + 1, arquivada: false,
  })),
];
