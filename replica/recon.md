# Recon: quadro branco colaborativo (referência: Miro)

Data: 2026-10-19 · Método: clean-room, só fontes públicas (central de ajuda, docs da API pública).
Nenhum código, ícone, logo ou texto do Miro entra no clone.

## 1. Escopo

| item | decisão |
| --- | --- |
| App de referência | Miro (miro.com) |
| Plataforma | Web (desktop primeiro; tablet funcional; celular só visualizar/comentar) |
| Recorte | Só o quadro branco: canvas infinito, objetos básicos, tempo real com vários usuários, compartilhamento por link |
| Para quem | Mentor (dono dos quadros) + clientes de mentoria (entram pelo link, sem fricção) |
| Fora | Templates, IA, apresentação, Talktrack, integrações, tabelas, diagramas avançados, apps mobile nativos |

**Uso principal:** o mentor abre um quadro do cliente, manda o link, os dois entram ao mesmo tempo
e constroem juntos (stickies, formas, setas, desenho). Depois da sessão o quadro fica salvo e
o cliente volta a ele quando quiser.

**Nota sobre termos:** como é para uso no seu negócio, não para vender como concorrente, o risco é baixo.
Mesmo assim o recon foi feito só com fontes públicas, sem usar sua conta do Miro.

## 2. Fontes

| fonte | URL | o que deu |
| --- | --- | --- |
| Ajuda: Sticky notes | https://help.miro.com/hc/en-us/articles/360017572054-Sticky-notes | criação, cores, tags (até 8), bulk mode, permissões de comentarista |
| Ajuda: Shapes | https://help.miro.com/hc/en-us/articles/360017730713-Shapes | estilos (borda, opacidade, cor), redimensionar/girar, converter, ordem z, "pontos azuis" de criação rápida |
| Ajuda: Connection lines | https://help.miro.com/hc/en-us/articles/360017730733-Connection-lines | tipos reta/ortogonal/curva, pontas de seta, encaixe no centro vs. lateral, rótulo |
| Ajuda: Atalhos | https://help.miro.com/hc/en-us/articles/360017731033-Shortcuts-and-hotkeys | lista completa de atalhos (N, S, R, O, L, P, F, Ctrl+D, Ctrl+G, Space+drag, zoom) |
| Ajuda: Compartilhar | https://help.miro.com/hc/en-us/articles/360017730813-Sharing-boards-and-inviting-collaborators | link público, convite por e-mail, papéis view/comment/edit, ~200 usuários simultâneos |
| Ajuda: Nomes de visitantes | https://help.miro.com/hc/en-us/articles/4883344893970-Visitor-names-BETA | visitante digita o nome antes de entrar; senão recebe nome aleatório |
| Ajuda: Attention management | https://help.miro.com/hc/en-us/articles/360013358479-Attention-management | seguir colaborador, "trazer para mim", "trazer todos", cor do cursor sincronizada |
| Ajuda: Nova interface | https://help.miro.com/hc/en-us/articles/20967864443410-Miro-s-new-simplified-user-interface | barra de pessoas, botão Share, liga/desliga cursores |
| Ajuda: Toolbars | https://help.miro.com/hc/en-us/articles/360017730553-Toolbars | barra do quadro (nome, menu), barra de pessoas, barra de criação à esquerda |
| Ajuda: Workshops | https://help.miro.com/hc/en-us/articles/360012753200-Miro-for-workshops-meetings | caneta, votação, timer, notas como ferramentas de facilitação |
| Ajuda: Performance | https://help.miro.com/hc/en-us/articles/360013588560-Board-performance-and-loading-issues | esconder cursores melhora desempenho com muitas pessoas |
| API pública REST | https://developers.miro.com/docs/rest-api-reference-guide | modelo de itens (sticky_note, shape, text, frame, connector) com position/geometry/style |
| Cliente Node (docs) | https://miroapp.github.io/api-clients/node/classes/index.Board.html | confirma entidades Board, Item, Frame, Connector, Tag |

## 3. Inventário de telas

| ID | tela | como chega | propósito | componentes principais | estados |
| --- | --- | --- | --- | --- | --- |
| S01 | Login / cadastro do mentor | `/login` | entrar na conta | Input, Button, link Google | vazio, erro de credencial, carregando |
| S02 | Painel de quadros | `/` após login | listar e abrir quadros | BoardCard, busca, botão "Novo quadro", menu ⋯ | vazio (nenhum quadro), cheio, carregando |
| S03 | Novo quadro (modal) | S02 → "Novo quadro" | nome + cliente | Modal, Input, Button | padrão, erro (nome vazio) |
| S04 | Quadro (canvas) | `/b/:boardId` | trabalhar junto | Canvas, CreationToolbar, ContextToolbar, PeopleBar, ZoomControl, Minimap, Cursor remoto | carregando, vazio (canvas limpo + dica), cheio, só leitura, reconectando, offline |
| S05 | Compartilhar (modal) | S04 → "Compartilhar" | gerar link e definir papel | Modal, Select de papel, CopyLink, lista de membros, toggle "pedir nome" | link desativado, link ativo, copiado (toast) |
| S06 | Entrada do visitante | abrir link sem login | dizer o nome antes de entrar | Input nome, preview do quadro desfocado, Button | padrão, nome vazio (gera nome aleatório) |
| S07 | Acesso negado / link inválido | link revogado ou sem permissão | explicar e oferecer contato | EmptyState, Button | revogado, expirado, quadro apagado |
| S08 | Painel de comentários | S04 → ícone comentários / Shift+C | ver e responder comentários | Drawer, CommentThread, Input, toggle resolvido | vazio, com threads, resolvidos ocultos |
| S09 | Painel de pessoas | S04 → avatares no topo | ver quem está, seguir, trazer todos | Drawer/Popover, Avatar, Menu | só você, várias pessoas, seguindo alguém |
| S10 | Configurações do quadro | S04 → menu do nome do quadro | renomear, duplicar, exportar imagem, apagar | Menu, Modal de confirmação | padrão, confirmar exclusão |

## 4. Fluxos

```
F01 Mentor cria um quadro para um cliente
    S01 login -> S02 painel -> S03 novo quadro -> S04 quadro vazio
    caminho feliz: 3 cliques + digitar nome
    edge: nome duplicado, perda de conexão ao criar

F02 Mentor convida o cliente
    S04 -> S05 compartilhar -> escolher "pode editar" -> copiar link -> enviar no WhatsApp
    caminho feliz: 3 cliques
    edge: link já existe (reaproveitar), mudar papel depois, revogar e gerar novo

F03 Cliente entra pelo link (sem conta)
    link -> S06 digita nome -> S04 quadro (com cursor e nome visíveis para o mentor)
    caminho feliz: 1 campo + 1 clique  <- número a bater
    edge: link revogado (S07), quadro cheio de gente, navegador antigo, celular

F04 Sessão ao vivo
    S04: os dois veem cursores com nome/cor; edições aparecem em < 200 ms;
    mentor usa "trazer todos para mim" (S09) para guiar a atenção
    edge: duas pessoas editando o mesmo sticky ao mesmo tempo, um cai e volta,
          desfazer (Ctrl+Z) só desfaz as MINHAS ações

F05 Criar e editar sticky
    S04: N ou clique no ícone -> clique no canvas -> digitar -> Esc
    edge: texto longo (fonte encolhe), trocar cor, várias seleções, duplicar (Ctrl+D / Alt+drag)

F06 Ligar dois objetos com seta
    S04: selecionar objeto -> arrastar ponto azul -> soltar sobre outro objeto
    edge: mover objeto (seta acompanha), soltar no vazio (seta solta), apagar objeto ligado

F07 Desenhar à mão livre
    S04: P -> desenhar -> Esc
    edge: borracha, cor/espessura, caneta em tablet

F08 Comentar
    S04: C ou ícone -> clicar no ponto/objeto -> escrever -> enviar; S08 lista; resolver
    edge: comentário em objeto que foi apagado, @menção (could)

F09 Cliente volta depois da sessão
    link salvo -> S04 com tudo como estava (persistência)
    edge: mentor mudou o papel para "só ver" -> modo leitura

F10 Mentor revoga acesso
    S04 -> S05 -> desativar link / remover pessoa -> quem estava dentro cai para S07
```

## 5. Componentes

| componente | variantes | estados | usado em |
| --- | --- | --- | --- |
| Button | primário, secundário, fantasma, ícone | normal, hover, ativo, desabilitado, carregando | todas |
| Input | texto, busca | vazio, foco, erro | S01, S03, S06, S08 |
| Modal | padrão, confirmação | aberto, fechando | S03, S05, S10 |
| Toast | sucesso, erro, info | aparecendo, sumindo | S04, S05 |
| Avatar | com foto, iniciais, visitante | online, seguindo | S04, S09 |
| BoardCard | — | hover, menu aberto | S02 |
| CreationToolbar (esquerda) | — | ferramenta ativa | S04 |
| ContextToolbar (flutua sobre seleção) | sticky, forma, texto, seta, desenho, multi | — | S04 |
| ColorPicker | paleta de stickies, paleta geral | selecionado | S04 |
| Canvas | — | pan, zoom, selecionando (laço), arrastando, editando texto | S04 |
| SelectionBox | 1 item, vários | redimensionar, girar, travado | S04 |
| Handles de conexão ("pontos azuis") | 4 lados + centro | hover, arrastando | S04 |
| RemoteCursor | — | movendo, parado (some após inatividade) | S04 |
| PeopleBar | — | só você, N pessoas, +N | S04 |
| ZoomControl + Minimap | — | — | S04 |
| CommentPin + CommentThread | aberto, resolvido | — | S04, S08 |
| ConnectionBanner | reconectando, offline | — | S04 |
| EmptyState | sem quadros, quadro vazio, acesso negado | — | S02, S04, S07 |

## 6. Modelo de dados inferido

```
User         id, name, email, avatar_url, created_at
             evidência: S01, avatares na PeopleBar · confiança: alta

Board        id, owner_id -> User, title, client_name?, created_at, updated_at,
             thumbnail_url?, deleted_at?
             evidência: S02 cards, S10 renomear/apagar, API "Board" · confiança: alta
             (client_name é específico do seu caso, não vem do Miro)

BoardMember  board_id, user_id, role (owner | editor | commenter | viewer)
             evidência: artigo "Board access rights" · confiança: alta

ShareLink    id, board_id, token, role (editor | commenter | viewer),
             ask_visitor_name (bool), enabled (bool), created_at
             evidência: S05, artigo "Visitor names" · confiança: alta

Item         id, board_id, type (sticky | shape | text | frame | image | stroke),
             x, y, width, height, rotation, z_index,
             parent_frame_id?, locked (bool),
             style (json: fill, stroke, opacity, font_size, align, shape_kind),
             content (texto rico / pontos do traço), tags[]?,
             created_by, updated_at
             evidência: API REST (position, geometry, style, data), artigos Shapes e Sticky notes
             confiança: alta para os campos, média para o formato exato

Connector    id, board_id, start_item_id?, start_snap (top|right|bottom|left|center|ponto livre),
             end_item_id?, end_snap, path (straight | elbow | curved),
             start_cap, end_cap (none | arrow | ...), style (json), label?
             evidência: artigo Connection lines, API "Connector" · confiança: alta

CommentThread id, board_id, item_id? ou (x, y), resolved, created_by, created_at
Comment       id, thread_id, author (user_id ou nome do visitante), body, created_at
             evidência: S08, atalho Shift+C · confiança: média

Presence     (efêmero, não vai para o banco) session_id, name, color, cursor (x, y),
             viewport, selection[], following_id?
             evidência: cursores com nome, "follow", "bring to me" · confiança: alta

BoardDoc     board_id, snapshot (binário do documento CRDT), version, updated_at
             PALPITE de implementação: guardar o estado do quadro como documento CRDT
             (ex.: Yjs) em vez de uma linha por item; o architect decide.
```

## 7. Matriz de funcionalidades

Ver `features.csv` (mesma pasta).

## 8. O que não dá (ou não vale) clonar

- **Biblioteca de templates do Miro:** é conteúdo deles. Você cria os seus templates de mentoria.
- **Ícones, pacotes de formas (AWS, BPMN etc.), fontes licenciadas:** usar conjuntos abertos (ex.: Lucide).
- **Escala de 200+ pessoas simultâneas:** desnecessária. Meta: 2–15 pessoas por quadro.
- **Integrações (Jira, Slack, Teams), IA, Talktrack:** fora do recorte.
- **A marca, o nome, as cores e os textos do Miro:** o clone tem identidade própria (`/replica-brand`).

## 9. Tamanho

| medida | valor |
| --- | --- |
| Telas | 10 (S01–S10), sendo S04 de longe a maior |
| Fluxos | 10 (F01–F10) |
| Entidades | 8 persistentes + Presence efêmera |
| Partes difíceis | (1) sincronização em tempo real sem conflito (CRDT, reconexão, desfazer por usuário); (2) canvas infinito rápido (zoom/pan suave, seleção, redimensionar, girar, centenas de objetos); (3) setas presas aos objetos que acompanham ao mover; depois, permissões aplicadas também no servidor de tempo real |
| Tamanho | **M** (algumas semanas) usando uma biblioteca de canvas + uma de CRDT prontas · **L** (um trimestre) se o canvas for escrito do zero |

Não há promessa de cópia perfeita: a meta é o fluxo de uma sessão de mentoria funcionar
tão bem quanto no Miro, com menos atrito para o cliente entrar (F03).
