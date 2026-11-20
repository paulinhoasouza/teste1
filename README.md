# A dois — controle financeiro do casal

Controle financeiro pessoal para duas pessoas. Os dados ficam num banco Postgres no Supabase e o app roda na Vercel.

## O que ele faz

- **Lançar rápido**: valor primeiro, categoria num toque, quem pagou e de quem é (nosso, só de um ou só do outro). Aceita compra parcelada.
- **Sobra do mês**: renda menos o que já foi gasto e menos as contas fixas que ainda vão vencer, com quanto dá para gastar por dia. Pode ser vista para os dois ou para cada um.
- **Acerto do casal**: soma o que um pagou pelo outro e mostra quem deve a quem, com a conta aberta linha por linha. Registrar um acerto abate a dívida.
- **Contas fixas**: aluguel, internet e salários cadastrados uma vez; a cada mês viram uma lista para marcar como paga ou recebida.
- **Salário pelo bruto**: o app simula o líquido com INSS e IR de 2026 e mostra o valor como simulado até vocês confirmarem o líquido que caiu.
- **Assinaturas**: streaming, jogos e apps, mensais ou anuais (como PS Plus), com o custo por mês e por ano e um botão para marcar todas as cobranças do mês.
- Comprovantes: foto tirada na hora pela câmera, ou foto e PDF já salvos, anexados a cada lançamento (a compra parcelada guarda um só para todas as parcelas), com visualizador em tela cheia. As fotos são reduzidas no aparelho antes de subir.
- Atividade: histórico só de leitura de tudo o que cada um fez (lançar, alterar com o antes e o depois, excluir, pagar contas, assinaturas, categorias, ajustes, comprovantes, entradas e troca de senha), com filtro por pessoa e por tipo, busca e selo de novidades da outra pessoa.
- **Relatório**: do casal ou de cada um, por mês ou por 3, 6 e 12 meses. Mostra renda, saídas, sobra e quanto foi guardado; para onde vai o dinheiro (contas fixas, assinaturas, parcelas e dia a dia); mês a mês; categorias comparadas com o período anterior; a divisão entre vocês; compromissos futuros e os maiores gastos.
- **Orçamento por categoria**: opcional; avisa quando uma categoria passa do planejado.

## Onde os dados ficam

Num projeto do Supabase, em quatro tabelas criadas por `supabase/esquema.sql`:

| Tabela | O que guarda |
| --- | --- |
| `lancamentos` | Uma linha por despesa, receita ou acerto. Valores em reais. |
| `categorias` | Nome, tipo e orçamento mensal de cada categoria. |
| `fixas` | Contas e receitas que se repetem todo mês. |
| `config` | Uma linha só: nomes, cores e a divisão padrão do que é do casal. |

Nas colunas `pago_por` e `de_quem`, `a` é a primeira pessoa, `b` a segunda e `casal` o que é dos dois. Dá para consultar e corrigir os dados pelo Table Editor do Supabase.

## Como o app chega ao banco

O servidor do app (nunca o navegador) fala com a API de dados do Supabase usando três variáveis de ambiente na Vercel:

| Variável | Valor |
| --- | --- |
| `SUPABASE_URL` | Endereço do projeto, como `https://xxxx.supabase.co` |
| `SUPABASE_KEY` | Chave publicável do projeto (`sb_publishable_...`) |
| `BANCO_SEGREDO` | Segredo próprio do app, enviado no cabeçalho `x-app-chave` |

A chave publicável sozinha não abre nada: todas as tabelas têm RLS, e a única política exige que o pedido traga o segredo do app. O banco guarda apenas o SHA-256 desse segredo, na função `privado.pedido_autorizado()`.

Para trocar o segredo: gere um novo (`openssl rand -hex 32`), grave o SHA-256 dele na função e atualize `BANCO_SEGREDO` na Vercel.

Sem essas variáveis o app abre em **modo de demonstração**, com dados de exemplo que não são gravados. Em Ajustes há um botão **Testar gravação**, que grava, altera e apaga uma linha de teste.

## Quem consegue abrir

Com o banco ligado, o app pede e-mail e senha. Cada pessoa tem o seu login, na tabela `usuarios`:

| Coluna | O que é |
| --- | --- |
| `email` | O e-mail de entrada, em minúsculas |
| `pessoa` | `a` ou `b`: quem essa pessoa é dentro do app |
| `senha_hash` | A senha embaralhada com scrypt; a senha em si não fica guardada |
| `falhas`, `bloqueado_ate` | Cinco erros seguidos bloqueiam o e-mail por 15 minutos |

Cada um troca a própria senha em Ajustes → Sua conta. Em modo de demonstração não há login.

## Rodar no computador

```bash
npm install
npm run dev        # http://localhost:3000, em modo de demonstração
npm test           # testes da lógica de dinheiro, divisão e banco
```

Para usar o banco localmente, copie `.env.example` para `.env.local` e preencha.

## Por dentro

Next.js (App Router) e TypeScript, com visual de vidro sobre luz quente: painel e barras translúcidas (o quanto o vidro é fosco se ajusta em "Ajustar vidro"), tema claro, escuro ou automático, fonte Outfit, uma pílula que estica até a aba escolhida e folhas que sobem de baixo e podem ser arrastadas para fechar (molas da biblioteca Motion). A lógica de dinheiro é pura e testada em `src/lib` (`dominio.ts`, `acoes.ts`, `registros.ts`, `salario.ts`, `relatorio.ts`); o banco é acessado pela API de dados do Supabase em `src/lib/servidor/banco.ts`; as telas ficam em `src/app/(app)`.
