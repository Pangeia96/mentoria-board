# Bugs: mentoria-board

Formato: ID · severidade (S1 dado perdido/segurança/fluxo central travado · S2 recurso quebrado sem alternativa ·
S3 quebrado com alternativa ou visivelmente errado · S4 cosmético) · passos · esperado · obtido · evidência · status.

Origem: suíte e2e (`npm run test:e2e`), 2ª execução em 2026-10-19: **13 aprovados, 12 reprovados de 25**.
Quase todas as reprovações vinham de BUG-01 (modal não fechava com Esc e travava o resto do teste).

## Abertos / a confirmar

| ID | sev. | o quê | status |
| --- | --- | --- | --- |
| BUG-04 | S2 (suspeita) | Quando o mentor muda o link para "Só ver", o visitante já dentro continua vendo as ferramentas de edição até recarregar. O servidor já descarta as escritas dele (testado com `realtime/scripts/late-writer.mjs`), então o que ele faz some sem aviso. | **a confirmar** pelo teste F10-H1, que não chegou a rodar por causa do BUG-01 |
| BUG-05 | ? | F05: depois de Ctrl+D o quadro ficou vazio e "Refazer" ativo (algo desfez a criação). Não reproduziu isolado (2 tentativas, texto curto e longo). | **a confirmar** na próxima execução completa; pode ser efeito do teste anterior |

## Corrigidos (sem rodar a suíte completa de novo)

| ID | sev. | passos | esperado | obtido | evidência | correção |
| --- | --- | --- | --- | --- | --- | --- |
| BUG-01 | S3 | Abrir "Compartilhar" (ou o painel de pessoas) e apertar Esc | o modal fecha | o 1º Esc só fecha o tooltip do botão "Fechar" (que recebeu o foco ao abrir); precisa de 2 Esc | screenshots em `test-results/*F04-E1*`; snapshot com `dialog` ainda aberto | botão de fechar do Modal/Drawer sem tooltip (`IconButton tooltip={false}`) |
| BUG-02 | S4 | Abrir o painel logo depois de criar um quadro | sem erro | "Minified React error #418" (hidratação): "editado há X segundos" calculado com horas diferentes no servidor e no navegador | F01-E4 e F12-H4 | `suppressHydrationWarning` no texto relativo do BoardCard |
| BUG-03 | S4 (a11y) | axe no quadro | sem violação | `label-content-name-mismatch`: botão "1 pessoa no quadro" mostra as iniciais "DM" | F01-H1 | avatares dentro do botão com `aria-hidden` |
| BUG-00 | S4 (a11y) | leitor de tela no quadro | a área do canvas tem nome | `role="application"` sem nome: o Konva não repassa `role`/`aria-label` do `<Stage>` para o DOM | 1ª execução: 21 falhas | `role`, `aria-label` e `aria-roledescription` no contêiner HTML |

## Erros da própria suíte (não eram bugs do app)

- O `playwright.config.ts` apagava `.data-test/` ao ser carregado, e o Playwright recarrega o config a cada novo
  worker (depois de cada falha), apagando os dados no meio da execução. Movido para `e2e/global-setup.ts`.
