# Plano de testes: mentoria-board

Fluxos de `replica/recon.md` (F01–F10), mais F11 (lápis mágico) e F12 (frames, imagens, exportar).
Cada caso tem um ID: **H** = caminho feliz, **E** = caso de borda, **N** = caso negativo.
Coluna **como**: `e2e` = Playwright (`e2e/`), `script` = scripts em `realtime/scripts`, `manual` = à mão.

Ambiente dos testes automáticos: cópia isolada (web :3100, tempo real :1334, dados em `.data-test/`), modo dev
(sem Supabase). Toda spec falha se houver erro no console ou resposta 5xx, e roda o axe (WCAG A/AA) em cada tela.

## F01 · Mentor entra e cria um quadro

| ID | caso | esperado | como |
| --- | --- | --- | --- |
| F01-H1 | login de dev → painel vazio → "Criar quadro" → nome → criar | abre `/b/:id` com "Quadro em branco" | e2e |
| F01-H2 | o quadro aparece no painel com nome e mentorado | card com título e cliente | e2e |
| F01-E1 | nome do quadro vazio | erro "Dê um nome ao quadro." sem sair do modal | e2e |
| F01-E2 | nome com acento e emoji ("Sessão 🚀 Ação") | salvo e exibido igual | e2e |
| F01-E3 | nome de 121+ caracteres | campo limita a 120 | e2e |
| F01-E4 | duplo clique em "Criar quadro" | cria um quadro só | e2e |
| F01-E5 | busca no painel por título e por mentorado | só os quadros que batem | e2e |
| F01-E6 | painel em 390px de largura | sem rolagem horizontal | e2e |
| F01-N1 | e-mail inválido no login | erro "Digite um e-mail válido." | e2e |
| F01-N2 | abrir `/` sem login | vai para `/login` | e2e |
| F01-N3 | **outro mentor** não vê os quadros do primeiro | painel vazio para o 2º | e2e |
| F01-N4 | outro mentor abre `/b/:id` do primeiro | "Você não tem acesso a este quadro" | e2e |
| F01-M1 | login real por link mágico (Supabase) | e-mail chega e o link entra | manual |

## F02 · Mentor gera o link

| ID | caso | esperado | como |
| --- | --- | --- | --- |
| F02-H1 | Compartilhar → link `/j/<48 hex>` | link aparece no campo | e2e |
| F02-E1 | abrir Compartilhar de novo | mesmo link (não cria outro) | e2e |
| F02-E2 | "Gerar link novo" | link muda; o antigo vira S07 | e2e |
| F02-N1 | visitante não vê o botão Compartilhar | botão ausente | e2e |

## F03 · Aluno entra pelo link

| ID | caso | esperado | como |
| --- | --- | --- | --- |
| F03-H1 | link → nome → "Entrar no quadro" | abre o quadro, sem botão "Voltar" | e2e |
| F03-E1 | nome vazio com "pedir nome" ligado | erro "Digite como você quer aparecer" | e2e |
| F03-E2 | nome com acento/emoji | aparece igual na lista de pessoas | e2e |
| F03-E3 | abrir o link de novo depois de entrar | vai direto ao quadro (não pede nome de novo) | e2e |
| F03-N1 | link inexistente | "Este link não funciona mais" | e2e |
| F03-N2 | 21+ entradas por minuto do mesmo IP | "Muitas tentativas" | manual |

## F04 · Sessão ao vivo

| ID | caso | esperado | como |
| --- | --- | --- | --- |
| F04-H1 | mentor cria sticky → aluno vê | aparece no outro navegador | e2e |
| F04-H2 | aluno cria sticky → mentor vê | idem | e2e |
| F04-H3 | contagem de pessoas | "2 pessoas no quadro" nos dois | e2e |
| F04-E1 | cursor de um aparece para o outro com o nome | rótulo com o nome | e2e |
| F04-E2 | desfazer (Ctrl+Z) só desfaz as próprias ações | o sticky do outro continua | e2e |
| F04-E3 | servidor de tempo real cai e volta | "Reconectando…" e depois sincroniza | manual |
| F04-H4 | seguir / trazer todos | a visão acompanha | script (`viewport-peer.mjs`) |

## F05 · Sticky

| ID | caso | esperado | como |
| --- | --- | --- | --- |
| F05-H1 | `N` + clique + digitar + Esc | sticky com o texto | e2e |
| F05-E1 | texto longo (300+ caracteres) | fonte menor, sem quebrar | e2e |
| F05-E2 | Delete apaga; Ctrl+Z volta | some e volta | e2e |
| F05-E3 | Ctrl+D duplica | 2 stickies | e2e |

## F06 · Setas

| ID | caso | esperado | como |
| --- | --- | --- | --- |
| F06-H1 | `L` + arrastar de um objeto a outro | seta presa aos dois | manual (visto no M2.1) |
| F06-E1 | mover objeto | a seta acompanha | manual (visto no M2) |

## F07 · Caneta e borracha

| ID | caso | esperado | como |
| --- | --- | --- | --- |
| F07-H1 | `P` + arrastar | traço criado | e2e |
| F07-H2 | `E` + arrastar por cima | traço apagado | e2e |

## F08 · Comentários

| ID | caso | esperado | como |
| --- | --- | --- | --- |
| F08-H1 | mentor `C` + clique + texto + Ctrl+Enter | pino criado | e2e |
| F08-H2 | aluno vê o comentário sem recarregar | pino aparece | e2e |
| F08-E1 | "Resolver" | pino some; contador 0 | e2e |
| F08-N1 | aluno com link "Só ver" | sem ferramenta de comentário | e2e |

## F09 · Aluno volta depois

| ID | caso | esperado | como |
| --- | --- | --- | --- |
| F09-H1 | recarregar | conteúdo continua | e2e |

## F10 · Revogar acesso

| ID | caso | esperado | como |
| --- | --- | --- | --- |
| F10-H1 | link vira "Só ver" | aluno vê "Você está só visualizando" na hora | e2e |
| F10-H2 | "Remover" o aluno | aluno sai na hora ("Não foi possível abrir o quadro") | e2e |
| F10-E1 | quadro na lixeira | quem estava dentro sai | e2e |
| F10-N1 | escrita forçada de quem só vê | descartada pelo servidor | script (`late-writer.mjs`) |

## F11 · Lápis mágico

| ID | caso | esperado | como |
| --- | --- | --- | --- |
| F11-H1 | `K` + arrastar | rastro aparece e some em ~2,5s | e2e |
| F11-H2 | o outro vê o rastro | rastro remoto | script (`watch-laser.mjs`) |

## F12 · Frames, imagens, exportar, menu do quadro

| ID | caso | esperado | como |
| --- | --- | --- | --- |
| F12-H1 | `F` + clique → frame | "Frame 1" | e2e |
| F12-H2 | soltar uma imagem PNG | imagem no quadro, rota protegida | e2e |
| F12-N1 | imagem sem cookie | 403 | e2e |
| F12-H3 | baixar PNG | arquivo `.png` gerado | e2e |
| F12-H4 | renomear / duplicar / lixeira | nome muda; cópia abre; some do painel | e2e |
