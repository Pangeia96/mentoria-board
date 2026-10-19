# Backend: mentoria-board

Stack: Supabase (Postgres + Auth) · Next.js server actions · Hocuspocus (Yjs) gravando em `board_docs`.
Sem as chaves no `.env.local`, tudo cai no modo dev (JSON + arquivos em `.data/`) e continua funcionando.

## Como ligar (o que só você pode fazer)

1. Crie um projeto em supabase.com: região **South America (São Paulo)**, plano Free serve para começar.
2. **Authentication → URL Configuration:** Site URL `http://localhost:3000`; em Redirect URLs, adicione
   `http://localhost:3000/auth/callback` (e o domínio de produção depois).
3. **Authentication → SMTP:** o SMTP padrão do Supabase manda pouquíssimos e-mails por hora e é só para teste.
   Antes de chamar mentorados, ligue um SMTP próprio (Resend com o seu domínio).
4. **Google (opcional):** crie um OAuth Client no Google Cloud (tipo Web), cole o Client ID/Secret em
   Authentication → Providers → Google. Escopos só `openid email profile`. Para esses escopos básicos não
   há a verificação demorada do Google; ela só existiria se pedíssemos Calendar/Drive.
5. Copie para `web/.env.local` e `realtime/.env` os valores de Project Settings → API
   (nomes em `web/.env.example` e `realtime/.env.example`). A chave **secreta** nunca vai num `NEXT_PUBLIC_*`.
6. Aplicar o schema: `npm run db:push` (Supabase CLI; pede o login e a senha do banco) ou eu aplico
   pelo conector do Supabase depois que você me disser qual projeto usar.
7. `npm run db:seed` cria dados fictícios (2 mentores de teste, 3 quadros, 1 link).

## Auth

- [x] Link mágico por e-mail (cria a conta no 1º acesso; sem senha para esquecer, então não há reset de senha)
- [x] Google OAuth com o app do próprio usuário (opcional)
- [x] Sessão em cookies http-only (`@supabase/ssr`), renovada no `proxy.ts`; `getUser()` valida no servidor
- [x] Sair (`signOut`) · [ ] "sair de todos os dispositivos" (`scope: "global"`)
- [x] Papéis por quadro: owner / editor / commenter / viewer (`board_members`, `share_links.role`)
- [x] Visitante sem conta: cookie assinado por quadro + `board_guests` (pode ser revogado)
- [ ] Excluir conta de verdade (apaga auth.users → cascade em profiles/boards/tudo)

## Banco

- [x] Migration versionada: `supabase/migrations/20261019000000_init.sql` (cópia em `replica/schema.sql`)
- [x] RLS em todas as 10 tabelas; `board_docs` sem policy = só o servidor (service role) lê e grava
- [x] `store_board_doc()` atômica, executável só pela service role
- [x] Testes de schema + RLS com 2º usuário: `npm run db:test` (28 checagens, PGlite)
- [ ] Rodar os mesmos testes contra o projeto real depois do push (advisors de segurança/performance)
- [x] Seed fictício: `npm run db:seed`
- [ ] Backups: o plano Free tem backup diário por 7 dias? **confira em Database → Backups**; PITR só no Pro

## Pagamentos

Não se aplica (uso interno da mentoria). Se um dia virar produto: Stripe Checkout + Customer Portal.

## E-mail e jobs

- [ ] SMTP próprio (Resend) para o link mágico, antes de uso real
- [ ] Jobs do architecture.md (purge-trash, snapshots, thumbnails, cleanup-guests): M4

## Integrações

Nenhuma no recorte. Google é só login (escopos básicos).

## Segurança

- [x] Segredos só em env vars; `.env*` no `.gitignore`; nada secreto no bundle (`server-only` nos clientes)
- [x] Entrada validada no servidor com zod em todas as server actions; ids conferidos por regex/uuid
- [x] Autorização em toda leitura/escrita: RLS (mentor) ou checagem explícita (visitante) + papel reconferido
      no banco ao conectar, a cada 30s e na hora via `POST /kick` (protegido pelo REALTIME_SECRET)
- [x] Rate limit: o Supabase Auth limita o envio de links; entrar pelo link `/j/*` tem limite de 20/min por IP (em memória, por instância)
- [n/a] Webhooks (nenhum ainda)
- [~] Uploads: limites no schema (10 MB, tipos de imagem); bucket privado entra no M4
- [x] Sem dados pessoais em URL (o token do link é aleatório) nem em log (logs só com código de erro)
- [x] `npm audit` de produção: 0 vulnerabilidades (web e realtime)
- [ ] Política de privacidade listando Supabase, Vercel, Fly e Resend (antes do lançamento)
