import "server-only";
import { dataNoMes, diaDe, mesDe, somarMeses } from "../datas";
import { expandirParcelas, saldoCasal } from "../dominio";
import { CATEGORIAS_INICIAIS } from "../padroes";
import type { Dados, Dono, Fixa, Lancamento, PessoaId } from "../tipos";

/** Dados de exemplo, sempre relativos ao dia de hoje. Nada aqui é gravado. */

const ORCAMENTOS: Record<string, number> = {
  mercado: 140000,
  restaurantes: 60000,
  transporte: 45000,
  lazer: 40000,
  compras: 50000,
  saude: 30000,
};

const FIXAS: Fixa[] = [
  fixa("sal-a", "Salário do Paulo", "receita", 680000, 5, "salario", "a", "a"),
  fixa("sal-b", "Salário da Giovana", "receita", 590000, 5, "salario", "b", "b"),
  fixa("academia", "Academia", "despesa", 12990, 5, "saude", "a", "a"),
  fixa("aluguel", "Aluguel", "despesa", 240000, 10, "moradia", "a", "casal"),
  fixa("condominio", "Condomínio", "despesa", 52000, 10, "moradia", "a", "casal"),
  fixa("streaming", "Streaming", "despesa", 5590, 12, "assinaturas", "b", "casal"),
  fixa("energia", "Conta de luz", "despesa", 21480, 15, "contas-da-casa", "b", "casal"),
  fixa("pilates", "Pilates", "despesa", 28000, 18, "saude", "b", "b"),
  fixa("internet", "Internet", "despesa", 11990, 20, "contas-da-casa", "b", "casal"),
  fixa("celulares", "Plano dos celulares", "despesa", 9980, 25, "contas-da-casa", "a", "casal"),
];

function fixa(
  id: string, descricao: string, tipo: Fixa["tipo"], valor: number, dia: number,
  categoria: string, pagoPor: PessoaId, deQuem: Dono,
): Fixa {
  return { id, descricao, tipo, valor, dia, categoria, pagoPor, deQuem, parteA: 50, ativa: true, inicio: "", fim: "" };
}

/** dia, descrição, valor, categoria, quem pagou, de quem é */
type Modelo = [number, string, number, string, PessoaId, Dono];

const GASTOS: Modelo[] = [
  [1, "Feira de sábado", 8640, "mercado", "b", "casal"],
  [2, "Uber para o trabalho", 2380, "transporte", "a", "a"],
  [2, "Almoço no quilo", 3890, "restaurantes", "b", "b"],
  [3, "Supermercado do mês", 61273, "mercado", "a", "casal"],
  [4, "Farmácia", 7460, "saude", "b", "casal"],
  [5, "Gasolina", 22000, "transporte", "a", "casal"],
  [6, "Pizza de sexta", 9800, "restaurantes", "a", "casal"],
  [7, "Cinema", 7200, "lazer", "b", "casal"],
  [8, "Padaria", 2650, "mercado", "a", "casal"],
  [9, "Tênis de corrida", 39990, "compras", "a", "a"],
  [10, "Hortifruti", 11835, "mercado", "b", "casal"],
  [11, "Presente da mãe da Giovana", 18900, "compras", "b", "b"],
  [12, "Delivery japonês", 14250, "restaurantes", "b", "casal"],
  [13, "Estacionamento", 1800, "transporte", "a", "casal"],
  [14, "Açougue", 16480, "mercado", "a", "casal"],
  [15, "Bar com os amigos", 12600, "lazer", "a", "a"],
  [16, "Mercado da semana", 23417, "mercado", "b", "casal"],
  [17, "Salão", 16000, "compras", "b", "b"],
  [18, "Metrô e ônibus", 4400, "transporte", "b", "b"],
  [19, "Jantar de aniversário de namoro", 28600, "restaurantes", "a", "casal"],
  [20, "Feira de sábado", 9210, "mercado", "b", "casal"],
  [21, "Livros", 11480, "lazer", "b", "b"],
  [22, "Gasolina", 21000, "transporte", "a", "casal"],
  [23, "Hambúrguer", 7900, "restaurantes", "b", "casal"],
  [24, "Mercado da semana", 26755, "mercado", "a", "casal"],
  [26, "Show no fim de semana", 24000, "lazer", "a", "casal"],
  [27, "Padaria", 3120, "mercado", "b", "casal"],
  [28, "Consulta no dentista", 25000, "saude", "a", "a"],
];

export function dadosDeDemonstracao(hojeData: string): Dados {
  const mesAtual = mesDe(hojeData);
  const lancamentos: Lancamento[] = [];
  let n = 0;
  const novo = (l: Omit<Lancamento, "id" | "criadoEm" | "criadoPor" | "parteA">): void => {
    n += 1;
    lancamentos.push({
      ...l,
      id: `demo${n.toString(36)}`,
      parteA: 50,
      criadoEm: `${l.data}T12:00:${String(n % 60).padStart(2, "0")}.000Z`,
      criadoPor: l.pagoPor,
    });
  };
  const simples = { parcela: "", grupo: "", fixaId: "", mesRef: "" };

  // Um parcelamento em andamento, que entra também nos próximos meses.
  const inicioSofa = dataNoMes(somarMeses(mesAtual, -2), 9);
  for (const p of expandirParcelas(inicioSofa, 329900, 10)) {
    novo({
      data: p.data, tipo: "despesa", descricao: "Sofá novo", valor: p.valor, categoria: "compras",
      pagoPor: "a", deQuem: "casal", parcela: p.parcela, grupo: "demo-sofa", fixaId: "", mesRef: "",
    });
  }

  for (const recuo of [2, 1, 0]) {
    const mes = somarMeses(mesAtual, -recuo);
    const limite = recuo === 0 ? diaDe(hojeData) : 31;

    for (const f of FIXAS) {
      // No mês atual, o que vence perto de hoje ainda está por pagar.
      if (f.dia > (recuo === 0 ? limite - 2 : 31)) continue;
      novo({
        data: dataNoMes(mes, f.dia), tipo: f.tipo, descricao: f.descricao, valor: f.valor,
        categoria: f.categoria, pagoPor: f.pagoPor, deQuem: f.deQuem,
        parcela: "", grupo: "", fixaId: f.id, mesRef: mes,
      });
    }

    for (const [dia, descricao, valor, categoria, pagoPor, deQuem] of GASTOS) {
      if (dia > limite) continue;
      // Uma variação pequena e fixa por mês, para os meses não serem cópias.
      const ajuste = Math.round((valor * ((dia * 7 + recuo * 13) % 9 - 4)) / 100);
      novo({ data: dataNoMes(mes, dia), tipo: "despesa", descricao, valor: valor + ajuste * recuo, categoria, pagoPor, deQuem, ...simples });
    }

    // Os meses passados terminam com um acerto que zera a conta do casal.
    const s = recuo > 0 ? saldoCasal(lancamentos, mes) : null;
    if (s?.devedor && s.credor) {
      novo({
        data: dataNoMes(mes, 28), tipo: "acerto", descricao: "Acerto do mês", valor: s.valor,
        categoria: "", pagoPor: s.devedor, deQuem: s.credor, ...simples,
      });
    }
  }

  return {
    demo: true,
    config: { nomeA: "Paulo", nomeB: "Giovana", corA: "azul", corB: "laranja", parteAPadrao: 50 },
    categorias: CATEGORIAS_INICIAIS.map((c) => ({ ...c, orcamento: ORCAMENTOS[c.id] ?? 0 })),
    fixas: FIXAS,
    lancamentos,
  };
}
