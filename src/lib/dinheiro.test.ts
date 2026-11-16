import { describe, expect, it } from "vitest";
import { centavosDeDigitos, formatar, partesBRL, paraPlanilha, daPlanilha } from "./dinheiro";

describe("dinheiro", () => {
  it("formata centavos em reais", () => {
    expect(formatar(123456)).toBe("R$ 1.234,56");
    expect(formatar(0)).toBe("R$ 0,00");
    expect(formatar(-990)).toBe("-R$ 9,90");
  });

  it("separa inteiro e centavos para compor o valor grande", () => {
    expect(partesBRL(123456)).toEqual({ sinal: "", inteiro: "1.234", centavos: "56" });
    expect(partesBRL(-5)).toEqual({ sinal: "-", inteiro: "0", centavos: "05" });
  });

  it("lê a digitação como em app de banco: os dígitos entram pelos centavos", () => {
    expect(centavosDeDigitos("1")).toBe(1);
    expect(centavosDeDigitos("1234")).toBe(1234);
    expect(centavosDeDigitos("R$ 12,34")).toBe(1234);
    expect(centavosDeDigitos("")).toBe(0);
  });

  it("converte entre centavos e o número guardado na planilha", () => {
    expect(paraPlanilha(123456)).toBe(1234.56);
    expect(daPlanilha(1234.56)).toBe(123456);
    expect(daPlanilha("1234,56")).toBe(123456);
    expect(daPlanilha("R$ 1.234,56")).toBe(123456);
    expect(daPlanilha("19.9")).toBe(1990);
    expect(daPlanilha("")).toBe(0);
  });
});
