import "server-only";

export interface Credenciais {
  email: string;
  chave: string;
  planilhaId: string;
}

export class ErroDeConfiguracao extends Error {}

function idDaPlanilha(valor: string): string {
  const m = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/.exec(valor);
  return (m?.[1] ?? valor).trim();
}

/** Lê as credenciais do Google; null quando o app deve rodar em demonstração. */
export function credenciais(): Credenciais | null {
  const planilha = process.env.GOOGLE_SHEET_ID?.trim();
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ?? "";
  let chave = process.env.GOOGLE_PRIVATE_KEY ?? "";

  // Sem chave não há como ler a planilha: demonstração, mesmo que o endereço já esteja definido.
  if (!json && !email && !chave) return null;

  if (json) {
    try {
      const conta = JSON.parse(json) as { client_email?: string; private_key?: string };
      email = conta.client_email ?? "";
      chave = conta.private_key ?? "";
    } catch {
      throw new ErroDeConfiguracao(
        "GOOGLE_SERVICE_ACCOUNT_JSON não é um JSON válido. Cole o conteúdo inteiro do arquivo da chave.",
      );
    }
  }
  chave = chave.replace(/\\n/g, "\n").trim();

  if (!planilha) throw new ErroDeConfiguracao("Falta a variável GOOGLE_SHEET_ID com o endereço da planilha.");
  if (!email || !chave) {
    throw new ErroDeConfiguracao("Falta a chave da conta de serviço do Google (GOOGLE_SERVICE_ACCOUNT_JSON).");
  }
  return { email, chave, planilhaId: idDaPlanilha(planilha) };
}

export function senhaDoApp(): string {
  return process.env.APP_SENHA?.trim() ?? "";
}

/** Com planilha de verdade, o app só abre com senha. */
export function exigeLogin(): boolean {
  return senhaDoApp().length > 0;
}
