import { describe, expect, it } from "vitest";
import { inss, irrf, simular } from "./salario";

/** Valores em centavos. */
describe("INSS 2026", () => {
  it("cobra 7,5% até o primeiro teto de faixa", () => {
    expect(inss(162100)).toBe(12158);
  });

  it("soma as faixas progressivamente", () => {
    // 121,575 + 115,3656 + 174,1716 + (5.900 − 4.354,27) × 14% = 627,51
    expect(inss(590000)).toBe(62751);
  });

  it("para no teto de R$ 8.475,55: desconto máximo de R$ 988,09", () => {
    expect(inss(847555)).toBe(98809);
    expect(inss(2000000)).toBe(98809);
  });

  it("não cobra nada sobre zero", () => {
    expect(inss(0)).toBe(0);
  });
});

describe("IRRF 2026", () => {
  it("zera o imposto de quem ganha até R$ 5.000 por mês", () => {
    expect(irrf(500000, inss(500000), 0)).toBe(0);
    expect(irrf(300000, inss(300000), 0)).toBe(0);
  });

  it("reproduz o exemplo da Receita: bruto 5.900, INSS 635,60, IR 345,92", () => {
    // O exemplo publicado usou o INSS de 2025; aqui o INSS entra como dado.
    expect(irrf(590000, 63560, 0)).toBe(34592);
  });

  it("não dá redução acima de R$ 7.350", () => {
    // base = 10.000 − 988,09 = 9.011,91; 27,5% − 908,73 = 1.569,545 → 1.569,55
    expect(irrf(1000000, inss(1000000), 0)).toBe(156955);
  });

  it("usa o desconto simplificado quando ele é melhor que o INSS", () => {
    // Bruto 2.700: INSS 218,69 é menor que o simplificado de 607,20.
    // Base 2.092,80 fica na faixa isenta: imposto zero (antes mesmo da redução).
    expect(irrf(270000, inss(270000), 0)).toBe(0);
  });

  it("desconta R$ 189,59 por dependente", () => {
    const sem = irrf(1000000, inss(1000000), 0);
    const com = irrf(1000000, inss(1000000), 2);
    // Dois dependentes tiram 379,18 da base, a 27,5%: cerca de 104,27 a menos.
    expect(Math.abs(sem - com - 10427)).toBeLessThanOrEqual(1);
  });
});

describe("simular", () => {
  it("CLT: bruto menos INSS, IR e outros descontos, e a conta fecha", () => {
    const s = simular({ bruto: 900000, regime: "clt", dependentes: 0, outrosDescontos: 25000 });
    expect(s.inss).toBe(inss(900000));
    expect(s.irrf).toBe(irrf(900000, inss(900000), 0));
    expect(s.liquido).toBe(900000 - s.inss - s.irrf - 25000);
  });

  it("outro regime: só os outros descontos", () => {
    const s = simular({ bruto: 800000, regime: "outro", dependentes: 0, outrosDescontos: 50000 });
    expect(s).toEqual({ bruto: 800000, inss: 0, irrf: 0, outros: 50000, liquido: 750000 });
  });

  it("nunca dá líquido negativo", () => {
    const s = simular({ bruto: 100000, regime: "outro", dependentes: 0, outrosDescontos: 500000 });
    expect(s.liquido).toBe(0);
  });
});
