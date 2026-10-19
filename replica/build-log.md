# Build log: mentoria-board

## M1 · Fatia vertical (2026-10-19)

Fluxo ponta a ponta funcionando: mentor entra → cria quadro → gera link → visitante entra com
o nome → os dois criam e movem stickies e veem os cursores um do outro → ao recarregar, tudo
continua lá.

**Como rodar** (dois terminais, na raiz `mentoria-board`):

```
npm --prefix realtime run dev     # ws://localhost:1234
npm --prefix web run dev          # http://localhost:3000
```

Visitante simulado (segundo usuário sem segundo navegador):
`npm --prefix realtime run test:guest -- <boardId> [segundos] [editor|viewer]`

| tela | status | o que falta | o que foi mais difícil que o esperado |
| --- | --- | --- | --- |
| S01 Login | partial | login real (link mágico + Google) entra com o `/replica-backend`; hoje é login de dev sem senha | nada |
| S02 Painel | done (M1) | renomear/duplicar/lixeira (menu ⋯ ainda sem ação), thumbnail, filtro por mentorado | Next 16 (`cacheComponents`) exige `<Suspense>`/`loading.tsx` em toda rota que lê cookie |
| S03 Novo quadro | done | — | — |
| S04 Quadro | partial | ver abaixo | (1) Konva não lê CSS: na 1ª carga as cores vinham vazias e os stickies ficavam invisíveis. Resolvido gerando `styles/tokens.ts` a partir do mesmo `tokens.json`. (2) O mousedown que cria o sticky roubava o foco do editor de texto. (3) Lint do React 19 proíbe setState dentro de effect; a seleção passou a ser derivada |
| S05 Compartilhar | partial | papéis, "pedir nome", desativar link (M3) | Área de transferência bloqueada no navegador embutido; o aviso de erro já cobre isso |
| S06 Entrada do visitante | done | aviso de privacidade completo (LGPD) | — |
| S07 Link inválido / sem acesso | done | — | — |
| S08, S09, S10 | not started | M3/M4 | — |

**S04 · o que existe:** canvas infinito (roda = pan, Ctrl+roda = zoom no ponteiro, Space/mão = arrastar),
sticky (N + clique, duplo clique ou Enter edita, 8 cores, Del apaga, arrastar move), desfazer/refazer
só das próprias ações, cursores e seleções das outras pessoas ao vivo, avatares de quem está no quadro,
banners de reconexão/offline/sincronizado, modo só leitura (UI + servidor), zoom 100%/ajustar.

**S04 · o que falta (M2):** laço e multi-seleção, redimensionar/girar, formas, texto livre, setas, caneta,
pinça no toque, offline com `y-indexeddb`, texto colaborativo letra a letra (`Y.Text`; hoje o último a
gravar o texto de um sticky vence).

**Verificado no navegador:** login, painel vazio, criar quadro, quadro vazio, criar/editar sticky,
persistência após recarregar, link gerado, visitante entra pela interface (erro com nome vazio),
S07, 390px de largura. **Verificado por script:** visitante simulado edita em tempo real (sticky, cursor
e seleção aparecem para o mentor); visitante "só ver" tenta escrever e o servidor descarta.
**Não verificado:** dois navegadores reais lado a lado (a aba embutida compartilha cookies), touch real,
desempenho com centenas de itens.

**Dados:** camada fake em `web/src/lib/data/fake.ts` (JSON em `.data/dev-db.json`) com a mesma interface
`DataLayer` que a versão Supabase vai implementar. Documentos Yjs em `.data/docs/*.bin`.

Matriz (`features.csv`): must-haves 8 `yes` + 8 `partial` de 22.

## M2 · Canvas completo (2026-10-19)

Pedido do usuário: "faltam setas, formas, texto". Entrou tudo o que é must-have de canvas.

| área | status | o que falta | o que foi mais difícil que o esperado |
| --- | --- | --- | --- |
| Formas | done | converter sticky↔forma | — |
| Texto livre | done | edição colaborativa letra a letra (`Y.Text`) | altura do texto medida com um `Konva.Text` fora da tela |
| Setas | done | encaixe em pontos laterais (hoje sempre pela borda, mirando o centro) | apagar um item preso precisa "congelar" a ponta antes, senão a seta pula para a posição antiga |
| Caneta/borracha | done | suavização melhor; pressão da caneta | — |
| Seleção | done | agrupar (Ctrl+G), Alt+arrastar para duplicar | arrastar em grupo: o Konva só move o nó arrastado, os outros são movidos pelo doc |
| Redimensionar/girar | done | — | o Transformer muda `scale`, que precisa ser convertido em largura/altura e zerado |
| Barra de opções | done | — | ficava fora da tela perto da borda: agora se ajusta (só DOM, sem estado) |
| Toque | partial | testar em aparelho real | — |

Arquivos: `b/[id]/board/model.ts` (tipos + geometria pura), `board/nodes.tsx` (desenho Konva),
`board/context-bar.tsx` (barras), `board-room.tsx` (ferramentas e eventos), `use-board-doc.ts` (ações no Yjs).

**Verificado no navegador** (inspecionando o Konva, porque o screenshot do painel tem escala diferente
das coordenadas de clique): criar forma por clique, texto livre, seta presa que acompanha ao mover a forma,
caneta, borracha, desfazer, Ctrl+A, Ctrl+D (seta duplicada presa às cópias), redimensionar pela alça,
trocar para círculo pela barra. **Por script:** um 2º participante recebe sticky, forma, texto, seta e traço.
**Não verificado:** girar pela alça, rótulo da seta, pinça em aparelho real, dois navegadores lado a lado.

Matriz: must-haves 15 `yes` + 6 `partial` + 1 `no` (revogar acesso, M3) de 22.

## M2.1 · Pontos de conexão (2026-10-19)

Pedido do usuário: todo objeto tem pontos onde a seta encaixa e fica pregada ao mover.

- 4 pontos (topo, direita, baixo, esquerda) em **todos** os tipos: sticky, forma, texto e desenho, girando junto com o objeto.
- A seta guarda `anchor` em cada ponta: pregada naquele lado. Sem `anchor` = automático (borda que mira o outro objeto), como antes.
- Os pontos aparecem no objeto sob o ponteiro ao fazer seta (`L`) e no objeto selecionado (um pouco para fora, para não
  brigar com as alças de redimensionar). Arrastar de um ponto do objeto selecionado já cria a seta.
- Encaixe num raio de 22px de tela; o ponto alvo fica cheio. Funciona também ao arrastar a ponta de uma seta existente.
- Cotovelo e curva saem perpendiculares ao lado onde estão pregados.

**Verificado:** seta criada arrastando do ponto direito da elipse até o topo de um sticky: as pontas caem nos pontos
esperados (±3px). O usuário já criou setas pregadas pelos 4 lados no quadro dele (vistas no documento).
**Não verificado:** pontos em objeto girado, cotovelo/curva com pontos pregados (visual).

## M3 · Acesso e sessão ao vivo (2026-10-19)

| tela | status | o que falta | o que foi mais difícil que o esperado |
| --- | --- | --- | --- |
| S05 Compartilhar | done | convite por e-mail (could) | — |
| S09 Pessoas | done | — | "seguir" sem effect com setState: a visão é derivada da visão publicada pela pessoa |
| S10 Menu do quadro | done | restaurar da lixeira | o menu do Radix devolvia o foco ao gatilho e roubava o foco do modal: o modal abre no tick seguinte |
| S02 Painel (menu ⋯) | done | thumbnail | — |
| Tempo real | done | — | expulsar quem já está dentro: o servidor reconfere no banco a cada 30s e o app chama `POST /kick` na hora |

**Verificado** (num quadro de teste, sem mexer no quadro do usuário):
- papel do link "Só ver" vale na hora: uma visitante que entrou como editora e escreveu depois da troca teve a escrita descartada;
- "Remover" expulsa na hora (o servidor fechou a conexão com "acesso removido") e a contagem de pessoas caiu;
- "Seguir" acompanha a visão da outra pessoa (posição e zoom); "Trazer todos" leva para a visão dela e para de seguir;
- renomear, duplicar (copia o conteúdo) e mover para a lixeira (volta ao painel, some da lista).

**Não verificado:** as mesmas ações no modo Supabase (o projeto ainda não existe); "trazer uma pessoa" (só "trazer todos");
a tela de "acesso removido" no navegador de quem foi expulso.

Matriz: must-haves 19 `yes` + 3 `partial` de 22.
