# HANDOFF: mentoria-board

Documento para um agente (ou pessoa) continuar o projeto sem o histórico da conversa.
Leia inteiro antes de mexer no código. Repositório: https://github.com/Pangeia96/mentoria-board

---

## 1. O que é

Quadro branco colaborativo em tempo real, **feito para mentores e coaches**: o mentor cria um quadro, manda o link,
o mentorado entra **sem criar conta** (só digita o nome) e os dois trabalham juntos ao vivo. Inspirado no fluxo
de quadro branco do Miro, construído do zero ("clean room": nada de código, ícones, textos ou cores do Miro).

Interface 100% em **português do Brasil**. Público e posicionamento: `replica/fixes.md` (opção A recomendada).

## 2. Estado atual (2026-10-19)

**Pronto e testado no navegador / por script:**
- login (modo dev sem senha; modo Supabase com link mágico + Google, **código pronto, não testado no Supabase real**)
- painel de quadros com busca, criar, renomear, duplicar (copia o conteúdo), lixeira
- canvas infinito (Konva): sticky, formas (retângulo/círculo/triângulo/losango), texto livre (B/I/U, tamanho, cor,
  alinhamento), setas presas a **pontos de conexão** (topo/direita/baixo/esquerda, acompanham ao mover; reta/cotovelo/
  curva; rótulo), caneta e borracha, frames (arrastar o frame leva o conteúdo), imagens (botão, colar, soltar arquivo)
- seleção por laço, Shift+clique, redimensionar/girar, copiar/colar/duplicar, ordem z, travar, desfazer/refazer **só
  das próprias ações**, atalhos de teclado
- tempo real (Yjs + Hocuspocus): edição simultânea, cursores com nome, lista de pessoas, **seguir** e **trazer todos/uma
  pessoa para a minha visão**, **lápis mágico** (traço que some sozinho em 2,5s, não é salvo)
- compartilhar: link com papel (editar / comentar / só ver), "pedir nome", lista de visitantes, **remover visitante** e
  **gerar link novo** expulsam na hora; o servidor reconfere o acesso no banco a cada 30s e via `POST /kick`
- comentários: pino preso ao objeto, respostas, resolver/reabrir, painel lateral, atualiza ao vivo via `POST /notify`
- exportar PNG (2x, sem seleção/cursores)

**Não feito / em aberto:** ver a seção 9.

## 3. Arquitetura

```
Navegador ──HTTPS──► web (Next.js 16, Vercel)  ──► Supabase (Postgres + Auth + Storage)   [ou JSON local em modo dev]
    │                    │  server actions, rotas
    │                    └─ POST /kick, /notify ─┐
    └──WSS (Yjs + awareness)──► realtime (Hocuspocus, Fly.io) ──► board_docs no Postgres  [ou .data/docs em modo dev]
```

- **Os objetos do quadro NÃO são linhas de tabela.** Ficam num documento Yjs por quadro (`board:<id>`), no `Y.Map("items")`
  (um `Y.Map` por objeto). O Postgres guarda o resto: quadros, membros, links, visitantes, comentários, arquivos.
- **Dois modos**, escolhidos sozinhos pelas variáveis de ambiente:
  - **modo dev** (sem as 3 chaves do Supabase): login só com e-mail; dados em `.data/dev-db.json`; docs em `.data/docs/*.bin`;
    a camada fake `web/src/lib/data/fake.ts` imita todas as regras do schema.
  - **modo Supabase**: `web/src/lib/data/supabase.ts` (mesma interface `DataLayer`). Mentor usa RLS; visitante (sem conta)
    nunca fala direto com o Supabase: passa por server actions com a service role + checagem explícita.
- **Visitante**: cookie assinado por quadro (`mb_g_<boardId>`) + linha em `board_guests` (revogável).
- **Token do tempo real**: o Next assina um JWT HS256 curto (`REALTIME_SECRET`) com `{sub, kind, name, color, role, board}`;
  o Hocuspocus valida e **reconfere o papel no banco** ao conectar, a cada `RECHECK_MS` e quando o app chama `/kick`.
  commenter/viewer conectam com `readOnly`.

## 4. Pastas

```
mentoria-board/
├─ HANDOFF.md                 este arquivo
├─ .env.example               todas as variáveis (web + realtime), explicadas
├─ package.json               scripts da raiz: db:test, db:push, db:seed, tokens, test:e2e
├─ playwright.config.ts       e2e numa cópia isolada (web :3100, realtime :1334, dados em .data-test/)
├─ e2e/                       specs Playwright por fluxo + fixtures (console/5xx/axe)
├─ scripts/set-supabase-secret.mjs   grava a secret key nos dois .env sem ecoar
├─ supabase/
│  ├─ migrations/20261019000000_init.sql      schema + RLS + store_board_doc()
│  ├─ migrations/20261019000100_storage.sql   bucket privado board-assets
│  ├─ tests/rls.test.mjs + supabase-stub.sql  28 checagens de schema/RLS em PGlite (npm run db:test)
│  └─ seed.mjs                                dados fictícios
├─ realtime/                  servidor Hocuspocus
│  ├─ src/server.mjs          auth, recheck periódico, POST /kick e /notify
│  ├─ src/storage.mjs         Postgres (board_docs) ou arquivos (modo dev)
│  └─ scripts/                fake-guest, late-writer, viewport-peer, watch-laser, peek (testes manuais)
├─ web/                       Next.js 16 (App Router, cacheComponents) + Tailwind v4 + Radix + Lucide
│  ├─ AGENTS.md               AVISO: Next 16 tem APIs novas; leia node_modules/next/dist/docs antes de mexer
│  ├─ src/proxy.ts            (Next 16: "proxy" substitui middleware) renova a sessão do Supabase
│  ├─ src/app/
│  │  ├─ actions.ts           login, criar quadro, entrar como visitante (zod em tudo)
│  │  ├─ board-actions.ts     compartilhar, papéis, remover visitante, renomear/duplicar/lixeira
│  │  ├─ comment-actions.ts   comentários e upload de imagem
│  │  ├─ page.tsx + dashboard.tsx   S02 painel
│  │  ├─ login/               S01
│  │  ├─ j/[token]/           S06 entrada do visitante
│  │  ├─ auth/callback/       volta do link mágico / Google
│  │  ├─ api/assets/[boardId]/[assetId]/route.ts   imagens com checagem de acesso
│  │  ├─ design/              vitrine do design system (/design)
│  │  └─ b/[id]/              S04 quadro
│  │     ├─ board-room.tsx    orquestra tudo (ferramentas, eventos, seleção, presença, comentários, export)
│  │     ├─ use-board-doc.ts  Yjs + HocuspocusProvider + awareness (cursor, seleção, viewport, summon, laser)
│  │     ├─ share-modal.tsx · board-menu.tsx
│  │     └─ board/            model.ts (tipos + geometria pura) · nodes.tsx (desenho Konva) ·
│  │                          context-bar.tsx (barra por tipo) · comments.tsx · laser.tsx
│  ├─ src/components/ui/      primitives.tsx (Button, Modal, Drawer, Select, Toast…) · board.tsx · canvas-chrome.tsx
│  ├─ src/lib/                auth.ts · data/{types,fake,supabase,index}.ts · supabase/server.ts · realtime.ts · colors.ts
│  └─ src/styles/             tokens.css e tokens.ts GERADOS de replica/design/tokens.json (npm run tokens)
└─ replica/                   documentação do produto
   ├─ recon.md · features.csv (matriz de funcionalidades) · architecture.md · schema.sql (cópia da migration)
   ├─ design/ (tokens.json, contrast.py, components.md, build-tokens.mjs)
   ├─ build-log.md (o que foi feito em cada marco e o que foi difícil) · backend.md (checklist)
   ├─ test-plan.md · bugs.md
   └─ reviews.csv · feedback.md · fixes.md · research/ (pesquisa de avaliações e posicionamento)
```

## 5. Como rodar

Requisitos: Node 24+, npm. (Python 3 só para `replica/design/contrast.py` e `replica/research/*.py`.)

```bash
npm install && npm --prefix web install && npm --prefix realtime install
# copie os blocos de .env.example para web/.env.local e realtime/.env (gere os segredos com o comando indicado lá)
npm --prefix realtime run dev        # ws://localhost:1234
npm --prefix web run dev             # http://localhost:3000
```

Sem as chaves do Supabase o app roda em **modo dev** (login só com e-mail). Para testar como aluno: abra o link de
Compartilhar numa janela anônima.

Checagens:

```bash
npm run db:test                      # schema + RLS (PGlite, não precisa de Supabase)
npm --prefix web run lint
cd web && npx tsc --noEmit
npm run test:e2e                     # Playwright: build de produção + servidores isolados (~10 min)
PW_NO_BUILD=1 npx playwright test -g "F05"   # reaproveita o último build para depurar um teste
```

## 6. Variáveis de ambiente

Ver `.env.example` (comentado). Resumo: `APP_URL`, `SESSION_SECRET`, `REALTIME_SECRET` (igual no web e no realtime),
`NEXT_PUBLIC_REALTIME_URL`, `REALTIME_HTTP_URL` (opcional), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SECRET_KEY` (só servidor), e no realtime `PORT`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `RECHECK_MS`.
**Nunca** coloque a secret key em `NEXT_PUBLIC_*` nem no git (`.env*` está no `.gitignore`, exceto `.env.example`).

## 7. Convenções (siga)

- **Tokens só**: nada de hex cru em componente. Cores/tipos/espaços vêm de `replica/design/tokens.json` → `npm run tokens`
  gera `web/src/styles/tokens.css` (+ mapeamento Tailwind; a paleta padrão do Tailwind está desligada) e `tokens.ts`
  (usado pelo Konva, que não lê CSS). Contraste: `py -3 replica/design/contrast.py replica/design/tokens.json` (AA, 0 falhas).
- Textos da interface em pt-BR, escritos do zero. Ícones Lucide. Fonte Inter. Base acessível Radix.
- Validação no servidor com zod; autorização em toda ação (papel conferido no servidor); erros genéricos para o usuário,
  detalhe só com código no log (sem dados pessoais).
- React 19 + lint estrito: **não** chame setState síncrono dentro de effect, **não** leia ref durante o render
  (o lint barra). Estado derivado em vez de sincronizar.
- Mudança em objetos do quadro: sempre via `actions` do `use-board-doc.ts` (transações com origem `LOCAL`, para o
  desfazer por usuário funcionar).
- Commits pequenos com mensagem `build: …` / `fix: …`. Atualize `replica/features.csv` (coluna `clone`) e `replica/build-log.md`.

## 8. Armadilhas conhecidas

- **Next 16**: `middleware` virou `proxy.ts`; `cacheComponents: true` exige `loading.tsx`/`<Suspense>` em rota que lê
  cookie; `PageProps<"/rota">` e `LayoutProps` globais; leia `web/node_modules/next/dist/docs` antes de mudar APIs.
- **Konva**: não repassa `role`/`aria-*` do `<Stage>` ao DOM (ponha no contêiner). Não entende `var(--x)`; use `tokens.ts`.
- **Radix**: abrir modal de dentro de um DropdownMenu → abra no tick seguinte (`afterMenu`), senão o foco volta ao gatilho.
  Botão que recebe o foco ao abrir um modal não pode ter tooltip (o Esc fecha o tooltip primeiro).
- **Server actions** limitadas a 1 MB por padrão; subido para 11 MB em `next.config.ts` (imagens de até 10 MB).
- Texto de sticky/forma é string (último a gravar vence). Edição colaborativa letra a letra pediria `Y.Text`.
- Playwright recarrega o config em cada worker: limpeza de dados fica em `e2e/global-setup.ts`.
- No Windows o `py -3` é o Python; o `python` do PATH pode ser o atalho da Microsoft Store.

## 9. Próximos passos (em ordem sugerida)

1. **Fechar a suíte e2e**: rodar `npm run test:e2e`, confirmar BUG-01..03 corrigidos e investigar BUG-04/05 (`replica/bugs.md`).
   BUG-04 provável: o visitante só vira "só leitura" na interface ao recarregar → avisar via `/notify` (ex.: `what=role`)
   e o cliente trocar o token/recarregar a página.
2. **Ligar o Supabase real**: projeto `fbmzkbftdrursffhftfg` criado, migrations ainda NÃO aplicadas lá (tabela `boards`
   não existia na última checagem) e secret key ainda vazia nos `.env`. Aplicar as 2 migrations, `npm run db:seed`,
   rodar os advisors do Supabase, testar login por link mágico, RLS com 2 usuários, `board_docs` e Storage.
3. **SaaS**: `/replica-brand` (nome e identidade próprios, sem "Miro"), Stripe em modo de teste (Checkout + Customer Portal +
   webhooks idempotentes; tabelas `plans`/`subscriptions`; limites conferidos no servidor; **aluno nunca paga**;
   cancelar com 1 clique), página de vendas e preços, termos e privacidade (LGPD). No Brasil: Stripe exige CNPJ; NFS-e por
   serviço à parte (NFE.io/eNotas).
4. **Deploy**: Vercel Pro (Hobby proíbe uso comercial), realtime no Fly.io região `gru`, Supabase Pro (backups), Resend
   como SMTP do link mágico (o SMTP padrão do Supabase é só para teste), domínio, Sentry.
5. Plano de correções do posicionamento (`replica/fixes.md` §4): tablet/caneta no navegador, offline com y-indexeddb +
   histórico de versões, desempenho com 1.000 objetos e 15 pessoas, "modo sessão" enxuto com modelos de mentoria.

## 10. Prompt pronto para outro agente

```
Você vai continuar o projeto mentoria-board (https://github.com/Pangeia96/mentoria-board).
Antes de qualquer coisa, leia HANDOFF.md inteiro, depois web/AGENTS.md, replica/build-log.md e replica/bugs.md.
Regras: siga as convenções da seção 7 do HANDOFF (tokens só, pt-BR, zod + autorização no servidor, lint do React 19),
não use nada do Miro (código, ícones, textos, cores, nome), não coloque segredos no git.
Primeira tarefa: [descreva aqui, ex.: "rodar npm run test:e2e, corrigir os bugs abertos com teste antes da correção,
atualizar replica/bugs.md e commitar"]. Ao final de cada tarefa: npm run db:test, lint, tsc e os testes e2e afetados
precisam passar; atualize replica/features.csv e replica/build-log.md.
```
