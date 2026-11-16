# A dois — controle financeiro do casal

Controle financeiro pessoal para duas pessoas. Os dados ficam numa planilha do Google Sheets de vocês e o app roda na Vercel.

## O que ele faz

- **Lançar rápido**: valor primeiro, categoria num toque, quem pagou e de quem é (nosso, só de um ou só do outro). Aceita compra parcelada.
- **Sobra do mês**: renda menos o que já foi gasto e menos as contas fixas que ainda vão vencer, com quanto dá para gastar por dia. Pode ser vista para os dois ou para cada um.
- **Acerto do casal**: soma o que um pagou pelo outro e mostra quem deve a quem, com a conta aberta linha por linha. Registrar um acerto abate a dívida.
- **Contas fixas**: aluguel, internet e salários cadastrados uma vez; a cada mês viram uma lista para marcar como paga ou recebida.
- **Orçamento por categoria**: opcional; avisa quando uma categoria passa do planejado.

## Como os dados ficam na planilha

O app cria quatro abas na primeira abertura:

| Aba | O que guarda |
| --- | --- |
| `Lancamentos` | Uma linha por despesa, receita ou acerto. Valores em reais. |
| `Categorias` | Nome, tipo e orçamento mensal de cada categoria. |
| `Fixas` | Contas e receitas que se repetem todo mês. |
| `Config` | Nomes, cores e a divisão padrão do que é do casal. |

Dá para editar a planilha à mão. Só não apague a primeira linha (cabeçalho) nem a coluna `id`. Nas colunas `pago_por` e `de_quem`, `a` é a primeira pessoa, `b` a segunda e `casal` o que é dos dois.

## Ligar a planilha (uma vez só)

Enquanto a chave da conta de serviço não estiver configurada, o app abre em **modo de demonstração**, com dados de exemplo que não são gravados.

1. **Conta de serviço.** No [Google Cloud Console](https://console.cloud.google.com/), crie um projeto, ative a *Google Sheets API* e, em *IAM e administrador → Contas de serviço*, crie uma conta de serviço. Na aba *Chaves*, adicione uma chave do tipo JSON e baixe o arquivo.
2. **Planilha.** Crie uma planilha em branco no Google Sheets e compartilhe com o e-mail da conta de serviço (termina em `iam.gserviceaccount.com`), como **Editor**.
3. **Variáveis na Vercel.** Em *Settings → Environment Variables* do projeto:

   | Variável | Valor |
   | --- | --- |
   | `GOOGLE_SERVICE_ACCOUNT_JSON` | O conteúdo inteiro do arquivo JSON baixado |
   | `GOOGLE_SHEET_ID` | O endereço da planilha (ou só o id) |
   | `APP_SENHA` | A senha que vocês dois vão usar para entrar |

4. **Novo deploy.** Em *Deployments*, refaça o último deploy para as variáveis valerem.

Com a planilha ligada, o app só abre com a senha. Sem `APP_SENHA` ele se recusa a mostrar os dados.

## Rodar no computador

```bash
npm install
npm run dev        # http://localhost:3000, em modo de demonstração
npm test           # testes da lógica de dinheiro, divisão e planilha
```

Para usar a planilha localmente, copie `.env.example` para `.env.local` e preencha.

## Por dentro

Next.js (App Router) e TypeScript. A lógica de dinheiro é pura e testada em `src/lib` (`dominio.ts`, `acoes.ts`, `linhas.ts`); a planilha é acessada pela API REST do Google Sheets em `src/lib/servidor/planilha.ts`; as telas ficam em `src/app/(app)`.
