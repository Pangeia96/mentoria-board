# O que corrigir e como se posicionar

Base: `replica/reviews.csv` → `replica/feedback.md` (gerado por `replica/research/rank.py`).

## Amostra e limites (leia antes)

- **406 linhas com link**: 275 avaliações da App Store (EUA 245, Brasil 30; média 2,86; 130 com nota 1–2)
  e 131 comentários do Hacker News que citam o Miro.
- **Só 2 fontes.** A Wish List oficial do Miro (community.miro.com/ideas) não pôde ser lida: a página é montada
  por JavaScript e a leitura só retornou o cabeçalho. G2, Capterra, Trustpilot e Google Play não foram usados
  porque não têm feed ou API pública que permita isso; Reddit exige a API autenticada.
- **Viés:** a App Store fala do **app de iPhone/iPad**, então problemas de celular e tablet aparecem muito mais
  do que apareceriam no uso pelo navegador. O Hacker News tem muito ruído (currículos e menções de passagem); por isso
  ele quase não entra nas listas abaixo.
- Temas descartados por ruído na classificação: "IA empurrada" ("ai" casa com "Air" de iPad Air), "facilitação"
  (quase só currículos no HN) e "suporte" (a maioria é "Pencil support", suporte à caneta).

## 1. O que odeiam

1. **Não funciona direito no tablet/celular** (travar, não carregar, pinça que dá zoom na interface, caneta).
   120 linhas, 2 fontes (77 com nota 1–3).
   - “It still has terrible performance on larger boards, and trackpad pinch-to-zoom still just zooms the entire interface (not the board).” — [App Store, nota 2, 2026-03-19](https://apps.apple.com/us/app/id1180074773?see-all=reviews#review-13865994382)
   - “When I need to type into a notecard, the keyboard constantly blocks it, so I can’t see what I’m typing.” — [App Store, nota 1, 2024-09-28](https://apps.apple.com/us/app/id1180074773?see-all=reviews#review-11775061011)
2. **Lento e pesado**, principalmente com quadro grande ou várias pessoas. 50 linhas, 2 fontes (32 com nota 1–3).
   - “trash. lags hard makes my device overheat and not even a old device” — [App Store, nota 1, 2026-04-05](https://apps.apple.com/us/app/id1180074773?see-all=reviews#review-13927067141)
   - “couldn’t use them in real time because the app was too laggy when multiple students joined it.” — [App Store, nota 1, 2023-10-25](https://apps.apple.com/us/app/id1180074773?see-all=reviews#review-10514793126)
3. **Entrar é um sofrimento**: link mágico que não chega, SSO que não volta para o app, convidado que precisa de conta.
   32 linhas, 2 fontes (24 com nota 1–3).
   - “No link. App never sends sign in link.” — [App Store, nota 1, 2026-09-20](https://apps.apple.com/us/app/id1180074773?see-all=reviews#review-14572724159)
   - “In order to access the whiteboard students needed to make their own accounts.” — [App Store, nota 1, 2023-10-25](https://apps.apple.com/us/app/id1180074773?see-all=reviews#review-10514793126)
4. **Cobrança que pega de surpresa** e dificuldade para cancelar. 34 linhas no tema de preço, 2 fontes (17 com nota 1–3).
   - “every time a student made an account to join the whiteboard, the company charged my card WITHOUT ever asking my approval” — [App Store, nota 1, 2023-10-25](https://apps.apple.com/us/app/id1180074773?see-all=reviews#review-10514793126)
   - “I will be charged a prorated amount of 7usd for some reason. This is on top of the monthly subscription!” — [App Store, nota 1, 2023-11-29](https://apps.apple.com/us/app/id1180074773?see-all=reviews#review-10638941425)
   - “I couldn’t even cancel my subscription before they charged me cause if some weird pop up!” — [App Store, nota 1, 2022-01-10](https://apps.apple.com/us/app/id1180074773?see-all=reviews#review-8226947592)
5. **Perder trabalho na sincronização.** 25 linhas, 2 fontes (15 com nota 1–3).
   - “The “syncing” process that automatically kicks in frequently destroys local changes you make to a board which can’t be recovered.” — [App Store, nota 1, 2022-09-19](https://apps.apple.com/us/app/id1180074773?see-all=reviews#review-9100053421)
6. **Difícil de achar as coisas / poluído.** 32 linhas, 2 fontes (13 com nota 1–3).
   - “It's ridiculously difficult to find features that I know the app has” — [App Store, nota 1, 2025-07-12](https://apps.apple.com/us/app/id1180074773?see-all=reviews#review-12884083921)

## 2. O que falta (pedidos pelo nome)

Todos **finos** (1 avaliação cada, 1 fonte); listados como pistas, não como tendência:
- modo offline / sem colaboração — “Hate lack of offline mode or even just non collaborative mode.” — [App Store, nota 3](https://apps.apple.com/us/app/id1180074773?see-all=reviews#review-8076975592)
- esconder o nome dos frames — “They don’t allow you to toggle the names of frames off.” — [App Store, nota 1, 2026-07-26](https://apps.apple.com/us/app/id1180074773?see-all=reviews#review-14352311308)
- caneta que respeita a ferramenta escolhida — “It would be nice if the pencil would act the same as touch with whatever tool is selected, rather than always jumping to pen.” — [App Store, nota 4](https://apps.apple.com/us/app/id1180074773?see-all=reviews#review-10534738758)
- abrir o quadro direto pelo link no celular — “The app should open boards from URLs on a mobile device.” — [App Store, nota 2, 2021-10-05](https://apps.apple.com/us/app/id1180074773?see-all=reviews#review-7880150991)
- modo escuro — “Please add dark mode ASAP” — [App Store, nota 5](https://apps.apple.com/us/app/id1180074773?see-all=reviews#review-6047258678)
- modo apresentação no app — “Present mode is missing” — [App Store, nota 3](https://apps.apple.com/us/app/id1180074773?see-all=reviews#review-9777301489)

## 3. O que não está resolvido (grupos que o Miro atende mal)

1. **Quem trabalha com clientes 1:1 (mentoria, coaching, terapia, consultoria).** 33 linhas citam clientes/sessão;
   a maioria fala de o app falhar justo na sessão. Tema com volume mediano; o sinal mais forte é de qualidade, não de quantidade.
   - “Now the app simply does not work for my clients and me.” — [App Store, nota 1, 2020-04-28](https://apps.apple.com/us/app/id1180074773?see-all=reviews#review-5877765400)
   - “not a mobile product that works for me to create quick visual maps of concepts with clients.” — [App Store, nota 3, 2023-11-12](https://apps.apple.com/us/app/id1180074773?see-all=reviews#review-10580208677)
2. **Professores e tutores com alunos que não deveriam precisar de conta.** 15 linhas (fino em volume, forte em impacto).
   - “I assumed that only the creator would need to pay for an account. I was wrong about that” — [App Store, nota 1, 2023-10-25](https://apps.apple.com/us/app/id1180074773?see-all=reviews#review-10514793126)
   - “My tutor and I have been using another whiteboard website/app that you’ve recently bought, so we have to use Miro now.” — [App Store, nota 2, 2021-03-16](https://apps.apple.com/us/app/id1180074773?see-all=reviews#review-7109675764)

## 4. Plano de correções (evidência × custo)

| # | o que fazer | tamanho | skill | evidência |
| --- | --- | --- | --- | --- |
| 1 | **Aluno nunca paga e nunca precisa de conta.** Já entra pelo link com o nome (feito); garantir no preço: cobrança só por mentor, preço fixo, sem cobrança por convidado | S | `/replica-launch` (preço) | conta/login 32 linhas; cobrança por aluno ([link](https://apps.apple.com/us/app/id1180074773?see-all=reviews#review-10514793126)) |
| 2 | **Cobrança sem surpresa:** preço fixo mensal, aviso por e-mail antes de cada cobrança, cancelar com 1 clique no Customer Portal, sem pró-rata escondido | S | `/replica-backend` (Stripe) + `/replica-launch` | preço 34 linhas, 3 citações de cobrança/cancelamento |
| 3 | **Tablet e celular pelo navegador funcionando de verdade:** pinça só no quadro (nunca na interface), caneta (Apple Pencil/S Pen) desenha sem a mão atrapalhar (rejeição de palma via `pointerType`), teclado não cobre o texto, link abre direto no quadro | M | `/replica-build` | celular/tablet 120 linhas (com viés de App Store) |
| 4 | **Nunca perder trabalho:** edição offline curta com cópia local (y-indexeddb), aviso claro de "salvo" / "não salvo", histórico de versões para voltar atrás (tabela `board_snapshots` já existe) | M | `/replica-build` + `/replica-backend` | perda/sincronização 25 linhas |
| 5 | **Rápido em quadro grande e com várias pessoas:** desenhar só o que está na tela, teste de carga com 1.000 objetos e 15 pessoas, meta de 60 fps | M | `/replica-build` + `/replica-test` | lento 50 linhas; "too laggy when multiple students joined" |
| 6 | **Modo sessão enxuto:** barra só com as ferramentas de uma mentoria, modelos próprios (roda da vida, plano de carreira, metas) e o lápis mágico em destaque | M | `/replica-build` + `/replica-brand` | difícil/poluído 32 linhas; grupo de clientes 1:1 |
| 7 | Esconder o nome dos frames (opção) | S | `/replica-build` | fino: 1 avaliação |

## 5. Posicionamento

**A — Mentores e coaches (recomendado)**
> Para mentores e coaches que perdem o começo da sessão fazendo o cliente criar conta e brigar com uma ferramenta pesada,
> o {app} abre o quadro pelo link: o mentorado digita o nome e vocês já estão desenhando juntos, com lápis mágico para apontar.
> Evidência: conta/login (32 linhas) e clientes/sessão (33 linhas), 2 fontes.

**B — Professores e tutores particulares**
> Para professores e tutores que levaram susto com cobrança por aluno, o {app} cobra só de quem ensina: alunos entram
> sem conta e sem custo.
> Evidência: preço/cobrança (34 linhas) e ensino (15 linhas, fino), 2 fontes.

**C — Quem trabalha no tablet**
> Para quem quer desenhar no tablet e encontra um app que trava, o {app} funciona no navegador do iPad com caneta e pinça certas.
> Evidência: celular/tablet (120 linhas), mas com viés forte de App Store. Hoje o produto ainda não entrega isso (item 3 do plano).

**Recomendação: A.** É o público do seu negócio, o produto já entrega o principal (entrada sem conta, tempo real, lápis
mágico, trazer todos para a minha visão) e a dor aparece nas avaliações em palavras quase iguais. B fica como público secundário
(mesmo produto, outra página de venda). C só depois do item 3.

Regras para a venda: não usar o nome Miro no nome do app, em anúncios ou na loja; as citações acima são pesquisa,
**não** depoimentos para a página. Uma página de comparação nominal é assunto para um advogado no Brasil.
