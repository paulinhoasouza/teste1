/** Dinheiro em centavos inteiros; a planilha guarda reais com duas casas. */

export interface PartesBRL {
  sinal: string;
  inteiro: string;
  centavos: string;
}

export function partesBRL(centavos: number): PartesBRL {
  const abs = Math.abs(Math.round(centavos));
  const inteiro = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return {
    sinal: centavos < 0 ? "-" : "",
    inteiro,
    centavos: (abs % 100).toString().padStart(2, "0"),
  };
}

export function formatar(centavos: number): string {
  const p = partesBRL(centavos);
  return `${p.sinal}R$ ${p.inteiro},${p.centavos}`;
}

/** Sem centavos, para eixos e resumos curtos. */
export function formatarCurto(centavos: number): string {
  const p = partesBRL(Math.round(centavos / 100) * 100);
  return `${p.sinal}R$ ${p.inteiro}`;
}

/** Digitação de app de banco: cada dígito entra pela direita. */
export function centavosDeDigitos(texto: string): number {
  const digitos = texto.replace(/\D/g, "").slice(0, 11);
  return digitos ? parseInt(digitos, 10) : 0;
}

export function paraPlanilha(centavos: number): number {
  return Math.round(centavos) / 100;
}

export function daPlanilha(valor: unknown): number {
  if (typeof valor === "number") return Math.round(valor * 100);
  if (typeof valor !== "string") return 0;
  let s = valor.replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
