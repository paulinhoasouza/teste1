# A dois — controle financeiro do casal

Controle financeiro pessoal para duas pessoas. Os dados ficam num banco Postgres no Supabase e o app roda na Vercel.

## O que ele faz

- **Lançar rápido**: valor primeiro, categoria num toque, quem pagou e de quem é (nosso, só de um ou só do outro). Aceita compra parcelada.
- **Sobra do mês**: renda menos o que já foi gasto e menos as contas fixas que ainda vão vencer, com quanto dá para gastar por dia. Pode ser vista para os dois ou para cada um.
- **Acerto do casal**: soma o que um pagou pelo outro e mostra quem deve a quem, com a conta aberta linha por linha. Registrar um acerto abate a dívida.
- **Contas fixas**: aluguel, internet e salários cadastrados uma vez; a cada mês viram uma lista para marcar como paga ou recebida.
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

Next.js (App Router) e TypeScript. A lógica de dinheiro é pura e testada em `src/lib` (`dominio.ts`, `acoes.ts`, `registros.ts`); o banco é acessado pela API de dados do Supabase em `src/lib/servidor/banco.ts`; as telas ficam em `src/app/(app)`.
