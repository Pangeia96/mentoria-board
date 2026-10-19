# Componentes: mentoria-board

Fonte: lista de componentes de `replica/recon.md` §5. Tokens: `tokens.json` → `web/src/styles/tokens.css`.
Classes Tailwind só com tokens (`bg-surface text-muted rounded-md shadow-md`). A paleta padrão do
Tailwind foi desligada, então hex cru não compila.
Ícones: **Lucide** (ISC). Fonte: **Inter** (OFL). Nenhum asset, texto ou cor de marca do Miro.
Base acessível: **Radix** (Dialog, Popover, DropdownMenu, Tooltip, Switch, Select, Toast).
Código: `web/src/components/ui/*` · vitrine: `/design`.

Regras gerais
- Foco: `:focus-visible` com anel de 2px na cor `focus` e offset de 2px, em tudo que é interativo.
- Alvo mínimo de toque: 32px (sm) no desktop e 40px nas barras do canvas.
- Movimento: `fast` em hover, `base` ao abrir popover/modal, `slow` no drawer; respeita `prefers-reduced-motion`.
- Todo ícone sem texto tem `aria-label` e Tooltip com o nome e o atalho.

---

```
Button
  variants  primary, secondary, ghost, danger
  sizes     sm 32px, md 40px, lg 48px
  states    default, hover, active (translateY 1px), focus-visible, disabled (50%, sem pointer), loading (spinner + label mantido)
  tokens    primary: bg accent / hover accent-hover / text on-accent · secondary: bg surface, border border, text text
            ghost: transparente, hover surface-hover · danger: bg danger, text on-danger
            radius md, font sm/600, padding-x 3/4/5
  a11y      <button> real; loading = aria-busy + disabled; ícone + texto ou aria-label
  used on   S01 S02 S03 S05 S06 S07 S10

IconButton
  variants  ghost (padrão), toggle (pressionado = bg accent-soft, ícone accent)
  sizes     sm 32px, md 40px
  states    default, hover, pressed, focus-visible, disabled
  tokens    radius md, ícone 18/20px text-muted → text no hover
  a11y      aria-label obrigatório; toggle usa aria-pressed; Tooltip "Nome (atalho)"
  used on   S04 (barras), S08, S09

Input
  variants  text, search (ícone à esquerda), textarea
  sizes     md 40px
  states    vazio (placeholder text-subtle), foco (borda focus + anel), preenchido, erro (borda danger + mensagem), disabled
  tokens    bg surface, border border-input (3,38:1), radius md, font sm
  a11y      <label> ligado ao campo; erro em aria-describedby + aria-invalid
  used on   S01 S02 S03 S06 S08

Modal (Dialog)
  variants  padrão (largura 480), confirmação (largura 400, botão danger)
  states    abrindo (fade + scale 0.98 → 1, base), aberto, fechando
  tokens    overlay overlay, painel bg surface, radius lg, shadow lg, padding 6
  a11y      Radix Dialog: prende o foco, Esc fecha, foco volta ao gatilho, título obrigatório
  used on   S03 S05 S10

Toast
  variants  info, success, error
  states    entrando, visível (4s; erro fica até fechar), saindo
  tokens    bg text (escuro) + texto surface (17,8:1), radius md, shadow lg; ícone success/danger
  a11y      role=status (info/success) ou alert (error); não rouba foco
  used on   S04 S05 ("Link copiado")

Avatar / AvatarStack
  variants  foto, iniciais (fundo presence-pN, texto on-presence), visitante (iniciais + ícone de link)
  sizes     24, 32
  states    online (anel 2px na cor da pessoa), seguindo (anel accent tracejado)
  tokens    radius full; stack com -8px de sobreposição e "+N" em surface-muted
  a11y      alt/aria-label com o nome; o stack é um botão que abre S09
  used on   S04 S09

BoardCard
  states    default, hover (shadow md, borda accent-soft), menu aberto, focus-visible
  tokens    bg surface, border border, radius lg, thumbnail 16:10 em canvas; título sm/600, cliente xs text-muted
  a11y      o card inteiro é um <a>; o menu ⋯ é um botão separado (não aninha interativo)
  used on   S02

CreationToolbar (vertical, à esquerda do canvas)
  itens     Selecionar (V), Mão (H), Sticky (N), Forma (S) ▸ submenu, Texto (T), Seta (L), Caneta (P), Frame (F), Comentário (C), Imagem
            separador · Desfazer (Ctrl+Z), Refazer (Ctrl+Shift+Z)
  states    ferramenta ativa = IconButton toggle pressionado; papel viewer/commenter esconde ferramentas de edição
  tokens    bg surface, radius lg, shadow md, padding 1, gap 1, largura toolbar-w
  a11y      role=toolbar, setas navegam entre itens, Tab sai da barra
  used on   S04

ContextToolbar (flutua acima da seleção)
  variants  sticky (cores, tamanho do texto), forma (forma, preenchimento, borda, opacidade), texto (B/I/U, alinhamento),
            seta (tipo reta/cotovelo/curva, pontas, espessura), desenho (cor, espessura), multi (alinhar, agrupar)
            sempre: travar, ordem z (menu), duplicar, apagar
  states    escondida durante drag/resize; reposiciona para não sair da tela
  tokens    bg surface, radius md, shadow lg, altura 40
  a11y      role=toolbar; abre sem roubar foco do canvas; Esc fecha e devolve foco
  used on   S04

ColorPicker
  variants  sticky (8 cores sticky.*), geral (sticky + presence + text + transparente)
  states    selecionada (anel 2px focus + check), hover
  tokens    swatch 24px, radius full
  a11y      radiogroup; cada swatch com aria-label do nome da cor
  used on   S04

Canvas
  states    pan (cursor grab/grabbing), zoom 10%–400%, laço de seleção (retângulo selection 10% de opacidade + borda),
            arrastando, editando texto, só leitura (cursor default, sem handles)
  tokens    fundo canvas, grade de pontos canvas-grid (some abaixo de 30% de zoom)
  a11y      container role=application com aria-label "Quadro"; atalhos documentados; F06 tem alternativa via teclado (Tab percorre objetos)
  used on   S04

SelectionBox
  states    1 item (8 handles + handle de giro), vários (só a caixa), travado (cadeado, sem handles), selecionado por outra pessoa (borda na cor dela + nome)
  tokens    borda 1.5px selection, handles 8px brancos com borda selection, radius sm
  used on   S04

Handles de conexão
  states    escondido, visível no hover do objeto (4 pontos + centro), arrastando (linha fantasma), alvo válido (objeto destacado)
  tokens    ponto 10px selection, alvo com shadow md
  used on   S04

RemoteCursor
  states    movendo (interpola 60 fps), parado > 5s (label some), > 60s (cursor some)
  tokens    seta com fill presence-pN e contorno branco; label pill com bg presence-pN, texto on-presence xs/600 (≥ 4,9:1)
  a11y      aria-hidden (a presença acessível é o PeopleBar)
  used on   S04

PeopleBar
  conteúdo  AvatarStack + botão Compartilhar (primary sm)
  states    só você, N pessoas, +N, seguindo alguém (faixa "Seguindo Ana · Parar")
  tokens    bg surface, radius lg, shadow md
  used on   S04 → abre S09

ZoomControl + Minimap
  conteúdo  −  100%  +  · menu do % (Ajustar à tela Alt+1, 100% Ctrl+0, Seleção Alt+2) · botão minimapa (M)
  tokens    bg surface, radius md, shadow md; minimapa 200×140 com viewport em accent 20%
  a11y      o % é um botão com aria-label "Zoom 100%, abrir opções"
  used on   S04

CommentPin + CommentThread
  pin       bolha 28px com avatar/iniciais do autor; resolvido = some (ou cinza se "mostrar resolvidos")
  thread    popover de 320px: lista de comentários (nome sm/600, hora xs text-muted, corpo sm), Input textarea, botões Resolver / Enviar
  states    novo (input focado), com respostas, resolvido, enviando, erro ao enviar (tentar de novo)
  a11y      pin é um botão "Comentário de Ana, 2 respostas"; Ctrl+Enter envia
  used on   S04 S08

ConnectionBanner
  variants  reconectando (warning-soft + warning, spinner), offline (danger-soft + danger, "suas edições ficam salvas aqui e sincronizam ao voltar"), sincronizado (success, some em 2s)
  tokens    pill no topo central, radius full, font xs/600
  a11y      role=status, aria-live=polite
  used on   S04

Drawer
  variants  direita (comentários S08, pessoas S09)
  states    abrindo (slow), aberto, fechado
  tokens    largura drawer-w, bg surface, shadow lg, borda esquerda border
  a11y      Radix Dialog não modal; Esc fecha; título visível
  used on   S08 S09

Select / Switch / DropdownMenu
  Select    papel do link: "Pode editar", "Pode comentar", "Só ver" (Radix Select, 40px, mesmo visual do Input)
  Switch    "Pedir nome ao entrar" (32×18, ligado = accent; rótulo clicável)
  Menu      ⋯ do card, ordem z, opções de zoom (Radix DropdownMenu, itens 32px, danger em vermelho, atalhos à direita em text-subtle)
  used on   S02 S04 S05 S10

EmptyState
  variants  sem quadros (S02: "Crie o primeiro quadro para um mentorado" + botão), quadro vazio (S04: dica central
            "Aperte N para um sticky ou arraste da barra"; some na 1ª ação), acesso negado (S07), link inválido (S07)
  tokens    ilustração = ícone Lucide 40px em accent-soft; título lg/600, texto sm text-muted, max 360px
  used on   S02 S04 S07

Spinner / Skeleton
  Spinner   16/20px, borda 2px accent, mb-spin 0.8s
  Skeleton  bg surface-muted com mb-pulse; usado no S02 (cards) e no S04 (carregando o quadro)
```
