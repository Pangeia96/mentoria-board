# Arquitetura: mentoria-board

Base: `replica/recon.md` (S01–S10, F01–F10) e `replica/features.csv` (22 must, 13 should, 12 could).
Schema completo: `replica/schema.sql` (vira a migration `0001_init`).

## 1. Stack

| camada | escolha | por quê |
| --- | --- | --- |
| App web | **Next.js (App Router) + TypeScript** | padrão, deploy de 1 clique, server actions para o CRUD |
| Estilo | **Tailwind** + tokens do `/replica-design` | rápido, consistente |
| Canvas | **Konva + react-konva** (MIT) | desenha milhares de objetos em `<canvas>` com zoom/pan, seleção e Transformer (redimensionar/girar) prontos; licença livre |
| Modelo do quadro | **Yjs** (MIT) | CRDT: dois editando o mesmo sticky não dá conflito; `Y.UndoManager` desfaz só as minhas ações; aguenta offline curto |
| Servidor de tempo real | **Hocuspocus 4** (MIT) em **Fly.io** | servidor WebSocket para Yjs com `onAuthenticate`, `readOnly` por conexão, presença (awareness) e persistência por hooks |
| Banco | **Postgres no Supabase** | um banco só; RLS pronta; você já tem o conector |
| ORM | **Drizzle** | SQL tipado e fino, migrations em SQL puro |
| Auth | **Supabase Auth** (e-mail mágico + Google) para o mentor | visitantes não criam conta (F03) |
| Arquivos | **Supabase Storage** (bucket `board-assets`, privado, URL assinada) | imagens no quadro e thumbnails |
| E-mail | **Resend** | login mágico personalizado e, depois, aviso de comentário |
| Jobs | **Vercel Cron** | limpeza de lixeira, snapshots, thumbnails |
| Hosting | **Vercel** (app) + **Fly.io** (Hocuspocus, região `gru`, São Paulo) | WebSocket de longa duração não roda bem em serverless; Fly fica perto dos seus clientes |
| Pagamentos | nenhum | uso interno da mentoria |

**Descartados:** o **tldraw SDK** seria o atalho mais rápido (canvas + sync prontos), mas exige
licença comercial paga em produção (relatos públicos falam em ~US$ 6 mil/ano). Se esse custo valer
o tempo economizado, troque Konva+Yjs por tldraw e o tamanho cai de M para S/M. O **Liveblocks**
(tempo real gerenciado) também cabe; ficou fora para não depender de um plano pago por quadro.

```
Navegador ──HTTPS──► Next.js (Vercel) ──► Supabase (Postgres + Auth + Storage)
    │                                          ▲
    └──WSS (Yjs + awareness)──► Hocuspocus (Fly) ──┘ lê/grava board_docs
```

## 2. Dados

**Regra principal:** os objetos do canvas vivem **dentro do documento Yjs**, não em tabelas.
O Postgres guarda o resto: quem pode entrar, links, visitantes, comentários e arquivos.

### Tabelas (10)

| tabela | dono | para quê |
| --- | --- | --- |
| profiles | o próprio usuário | mentor (1:1 com auth.users) |
| boards | owner_id | quadros; `client_name` para organizar por mentorado; lixeira com `deleted_at` |
| board_members | board → user | papéis owner/editor/commenter/viewer para quem tem conta |
| share_links | board | token do link, papel, "pedir nome", ativo; **1 ativo por quadro** (índice único parcial) |
| board_guests | board + link | cada visitante: nome, cor, `revoked_at` para "remover pessoa" |
| board_docs | board | estado Yjs binário + versão |
| board_snapshots | board | histórico / restaurar |
| comment_threads | board | pino em (x,y) ou preso a `item_id` do Yjs |
| comments | thread | autor (user ou guest) + `author_name` congelado |
| board_assets | board | imagens no Storage, limite de 10 MB, tipos permitidos |

`on delete`: tudo que pertence ao quadro é `cascade`; autoria (`created_by_*`, `author_*`) é
`set null`, para o conteúdo continuar existindo quando alguém sai.

### Formato do documento Yjs (por quadro)

```ts
ydoc.getMap('items')      // Y.Map<id, Y.Map>  — um por objeto
  // comum: id, type ('sticky'|'shape'|'text'|'frame'|'image'|'stroke'),
  //        x, y, w, h, rotation, z (string fracionária p/ ordenar sem renumerar),
  //        parentFrameId?, locked, createdBy
  // sticky/shape/text: text (Y.Text, edição colaborativa letra a letra), style {fill, stroke, opacity, fontSize, align, shapeKind}
  // stroke: points (Float32Array achatado), color, width
  // image: assetId
ydoc.getMap('connectors') // id → {from:{itemId?,snap,x?,y?}, to:{...}, path:'straight'|'elbow'|'curved', startCap, endCap, style, label}
ydoc.getMap('meta')       // schemaVersion, background, grid
```

Presença (cursor, seleção, viewport, quem estou seguindo) vai pelo **awareness** do Yjs: efêmera,
nunca gravada.

### Acesso: duas portas, uma regra

- **Mentor/membro logado:** RLS no Supabase (`board_role()` em `schema.sql`).
- **Visitante:** nunca fala direto com o Supabase. As server actions usam a service role e checam
  o **guest token** a cada chamada.
- **Guest token:** JWT assinado pelo Next.js com `{board_id, guest_id, role, name, color}`, validade de 12 h,
  guardado em cookie httpOnly e também enviado ao Hocuspocus.
- **Hocuspocus:** `onAuthenticate` valida o JWT do Supabase (mentor) ou o guest token, consulta o banco
  (link ativo? visitante revogado? papel atual?) e põe `connection.readOnly = true` para commenter e viewer.
  `onTokenSync`/recheck a cada 60 s derruba quem foi revogado (F10).

## 3. API

### F01 · Criar quadro · F09 · Voltar ao quadro
| método rota / action | faz | quem | entrada | saída |
| --- | --- | --- | --- | --- |
| GET `/` (RSC) | lista quadros do mentor, busca e filtro por cliente | membro logado | `?q=&client=` | boards[] |
| action `createBoard` | cria board + board_docs vazio | logado | title, client_name? | board.id → redirect `/b/:id` |
| action `renameBoard` / `duplicateBoard` / `trashBoard` / `restoreBoard` | S10 | owner | board_id, … | board |
| GET `/b/:id` (RSC) | carrega metadados e papel; o canvas conecta no WS | membro ou guest válido | — | página S04 ou redirect S06/S07 |

### F02 · Compartilhar · F10 · Revogar
| método rota / action | faz | quem | entrada | saída |
| --- | --- | --- | --- | --- |
| action `getOrCreateShareLink` | reaproveita o link ativo ou cria | owner | board_id, role, ask_visitor_name | url `/j/:token` |
| action `updateShareLink` | muda papel / pedir nome | owner | link_id, campos | link |
| action `disableShareLink` | desativa; WS derruba todos os visitantes do link | owner | link_id | ok |
| action `revokeGuest` | `revoked_at = now()`; WS derruba aquele visitante | owner | guest_id | ok |
| action `setMemberRole` / `removeMember` | membros com conta | owner | board_id, user_id, role | member |

### F03 · Visitante entra
| método rota / action | faz | quem | entrada | saída |
| --- | --- | --- | --- | --- |
| GET `/j/:token` | valida o link; se `ask_visitor_name`, mostra S06; se não, cria guest com nome aleatório | público | — | S06 ou redirect `/b/:id` |
| action `joinAsGuest` | cria board_guests, gera cor, assina guest token, grava cookie | público com token válido | token, display_name | redirect `/b/:id` |
| — | link inválido, desativado ou expirado → S07 | público | — | S07 |
| rate limit | 20 joins/min por IP no `/j/*` | — | — | 429 |

### F04–F07 · Sessão ao vivo (WebSocket, não REST)
| canal | faz | quem |
| --- | --- | --- |
| WSS `wss://rt.<domínio>/` doc `board:<id>` | sync Yjs (itens, setas, traços, texto) | editor escreve; commenter/viewer só leitura |
| awareness | cursor, seleção, viewport, `following` | todos conectados |
| stateless msg `bring-to-me` | mentor puxa a visão de todos (S09) | owner/editor |
| stateless msg `comments-changed` | avisa a UI para recarregar comentários | servidor |
| Hocuspocus `onStoreDocument` (debounce 2 s, máx. 10 s) | grava `board_docs.ydoc`, `version++` | servidor |

### F06 imagens · F08 comentários
| método rota / action | faz | quem | entrada | saída |
| --- | --- | --- | --- | --- |
| action `createAssetUpload` | valida tipo/tamanho, devolve URL assinada de upload | editor | board_id, mime, size | {assetId, uploadUrl} |
| GET `/api/assets/:id` | redireciona para URL assinada (5 min) | membro ou guest | — | 302 |
| action `listThreads` | threads + comentários do quadro | qualquer papel | board_id, includeResolved | threads[] |
| action `createThread` / `addComment` | cria e avisa via WS | owner/editor/commenter | board_id, item_id?/x,y, body | thread |
| action `resolveThread` / `editComment` / `deleteComment` | — | comentarista / autor | ids | ok |

### F-export
| action `exportBoardPng` | renderiza no cliente (Konva `toDataURL`, pixelRatio 2) e baixa; PDF depois | qualquer papel | — | arquivo |

### Jobs (Vercel Cron)
| job | quando | faz |
| --- | --- | --- |
| `purge-trash` | diário 03:00 BRT | apaga de vez boards com `deleted_at` > 30 dias (cascade + arquivos do Storage) |
| `snapshot-boards` | a cada hora | snapshot de quadros com `board_docs.updated_at` na última hora; mantém 48 por quadro |
| `thumbnails` | a cada 15 min | gera thumbnail dos quadros alterados (S02) |
| `cleanup-guests` | semanal | apaga guests sem comentários e `last_seen_at` > 90 dias |

Webhooks: nenhum na v1. Não usa nenhuma API do Miro.

**Contagem:** 10 tabelas · ~24 rotas/actions · 1 canal WS · 4 jobs.

## 4. Pontos que mordem

- **Tempo real / conflitos:** Yjs resolve o merge. O risco está no desfazer: usar `Y.UndoManager`
  com `trackedOrigins` só da conexão local, senão o Ctrl+Z de um apaga o trabalho do outro.
- **Permissão no servidor:** `readOnly` no Hocuspocus é a única defesa real. Esconder botão no
  front não basta. Testar um viewer mandando update à mão (tem que ser descartado).
- **Revogação:** o JWT vale 12 h, então a revogação precisa da checagem periódica no servidor WS.
  Sem isso, quem foi removido continua dentro.
- **Desempenho do canvas:** desenhar só o que está na viewport (culling), separar em camadas Konva
  (estática, seleção, cursores), cursores remotos via awareness com throttle de ~30 ms. Meta: 60 fps com 1.000 objetos.
- **Setas presas:** o ponto final é *derivado* do item na hora de desenhar, não gravado. Assim a
  seta acompanha quando outra pessoa move o objeto. Item apagado → a ponta vira ponto livre.
- **Tamanho do documento:** Yjs guarda histórico. Compactar no `onStoreDocument`
  (`encodeStateAsUpdate` de um doc recarregado) quando `size_bytes` passar de 5 MB; traços de caneta
  são o maior vilão (simplificar pontos com Ramer–Douglas–Peucker ao soltar).
- **Reconexão/offline:** `y-indexeddb` no cliente mantém o quadro durante a queda; a barra
  "reconectando…" aparece em 2 s; ao voltar, o Yjs faz o merge sozinho.
- **Idempotência:** `joinAsGuest` reaproveita o guest do cookie se ele ainda for válido (sem duplicar
  a pessoa a cada F5).
- **Fuso horário:** só aparece em datas de comentário. Gravar UTC, mostrar em `America/Sao_Paulo`
  ou no fuso do navegador.
- **Limite de arquivo:** 10 MB, só imagens. SVG enviado é sanitizado ou convertido em PNG (XSS).
- **Escala:** uma instância do Hocuspocus aguenta folgado 2–15 pessoas por quadro e dezenas de quadros.
  Redis/escala horizontal só se passar disso.
- **LGPD:** visitante guarda só o nome. Ao apagar um quadro, tudo some em cascade, Storage incluso.
  Ter aviso de privacidade no S06.

## 5. Ordem de construção

### M1 · Fatia vertical (prova a stack): ~1 semana
Mentor faz login → cria quadro → manda link → visitante entra com nome → os dois põem
stickies e veem os cursores um do outro → recarrega e está tudo lá.
- Telas: S01, S02 (simples), S04 (só sticky + pan/zoom), S06
- Tabelas: profiles, boards, board_members, share_links, board_guests, board_docs
- Rotas: `createBoard`, `getOrCreateShareLink`, `/j/:token`, `joinAsGuest`, WS + `onAuthenticate` + `onStoreDocument`
- Deploy desde já: Vercel + Fly + Supabase

### M2 · Must-haves do canvas: ~1,5 semana
Selecionar/laço, mover/redimensionar/girar, desfazer/refazer por usuário, copiar/colar/duplicar,
formas básicas, texto, setas presas, caneta + borracha, salvamento contínuo, reconexão.
- Telas: S04 completo (CreationToolbar, ContextToolbar, ConnectionBanner)

### M3 · Must-haves de acesso e sessão: ~1 semana
Papéis no link, readOnly no WS, revogar link/pessoa com expulsão ao vivo, lista de pessoas,
painel de quadros com busca, criar/renomear/duplicar/apagar.
- Telas: S03, S05, S07, S09, S10 · Tabelas: + uso completo de share_links/board_guests

### M4 · Should-haves: ~1,5 semana
Zoom para caber/seleção, agrupar e ordem z, travar, conector reta/cotovelo/curva + rótulo,
frames, imagens, **seguir / trazer todos para mim**, comentários (S08), exportar PNG,
filtro por cliente, leitura no celular, atalhos.
- Tabelas: + comment_threads, comments, board_assets · Jobs: purge-trash, thumbnails

### M5 · Could-haves
Minimapa, grade, tags, bulk mode, pontos azuis de criação rápida, converter objeto,
esconder cursores, menções + e-mail, votação, timer, histórico de versões (board_snapshots).

### M6 · Correções do `/replica-entrepreneur`
O que os usuários reclamam do Miro e que importa para sessões de mentoria (ex.: travar a
estrutura do exercício, entrada do cliente sem fricção, quadro leve no notebook do cliente).

**Total estimado (M1–M4): ~5 semanas** para uma pessoa experiente. Isso confirma o tamanho **M** do recon.
