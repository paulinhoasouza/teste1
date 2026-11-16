/** Datas como texto: "yyyy-mm-dd" para dias e "yyyy-mm" para meses. */

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function hoje(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function mesDe(data: string): string {
  return data.slice(0, 7);
}

export function diasNoMes(mes: string): number {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

export function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Dia dentro do mês, recuando para o último dia quando o mês é mais curto. */
export function dataNoMes(mes: string, dia: number): string {
  const d = Math.min(Math.max(1, dia), diasNoMes(mes));
  return `${mes}-${String(d).padStart(2, "0")}`;
}

export function diaDe(data: string): number {
  return Number(data.slice(8, 10));
}

export function nomeDoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  return `${MESES[m - 1]} de ${a}`;
}

export function nomeDoMesCurto(mes: string): string {
  const m = Number(mes.slice(5, 7));
  return MESES[m - 1] ?? "";
}

/** "16 nov" */
export function diaCurto(data: string): string {
  return `${diaDe(data)} ${MESES_CURTOS[Number(data.slice(5, 7)) - 1]}`;
}

/** "Hoje", "Ontem" ou "segunda, 16 de novembro". */
export function diaPorExtenso(data: string, ref: string): string {
  if (data === ref) return "Hoje";
  const d = new Date(`${data}T12:00:00Z`);
  const r = new Date(`${ref}T12:00:00Z`);
  const dif = Math.round((r.getTime() - d.getTime()) / 86400000);
  if (dif === 1) return "Ontem";
  if (dif === -1) return "Amanhã";
  return `${DIAS_SEMANA[d.getUTCDay()]}, ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

export function mesValido(mes: string | null | undefined): mes is string {
  return !!mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes);
}

export function dataValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const mes = data.slice(0, 7);
  return mesValido(mes) && diaDe(data) >= 1 && diaDe(data) <= diasNoMes(mes);
}
