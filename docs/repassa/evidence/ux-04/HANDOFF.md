# RePassa · Handoff UX-04

Branch `feat/UX-04-reservations-pickups`, baseada em `origin/main` no commit `d8660d1`. Alterações locais preservadas pelo Codex/Astra, retomadas e validadas pelo Devin.

## Implementado

- `/minhas-reservas` lista o histórico real com paginação, situação, endereço e instruções. Verifica a reserva antes de mostrar o código, permite copiá-lo, exibe o prazo em São Paulo e confirma o cancelamento.
- `/instituicao/retirada` usa o vínculo autorizado, valida o código e exige confirmação da entrega física. Um resultado incerto direciona para o estoque. O caminho plural redireciona para o singular preservando a instituição selecionada.
- O detalhe do material reconcilia respostas perdidas consultando o histórico. O código fica na área do estudante. O painel institucional lê o novo endpoint de resumo do DEV-04.

## Arquivos alterados

- Serviços e testes em `src/data/` — `auth*`, `myReservations*`, `operations*`, `reservation*`.
- Interface em `src/App.tsx`, `src/components/MaterialCover.tsx`, `src/pages/{Detail,Institution,PickupDesk,Reservations}.tsx`, `src/pages/{collection,institution,reservations}.css` e `src/ui/{PrivateArea,Shell}.tsx`.
- `playwright.config.mjs`, testes e fixtures em `tests/browser/`, `README.md`, `docs/repassa/SCREENS.md` e capturas nesta pasta.

## Evidências registradas

- Lint e TypeScript, build, 32 testes unitários e 33 testes Playwright no Chrome passaram.
- O QA isolado reportou 17 testes DEV-04 aprovados após migração em PostgreSQL 16 e confirmou no Chrome doação, recebimento, reserva com resposta perdida, retirada, bloqueio entre instituições, rejeição de reuso e conclusão persistida. Foram 12 verificações axe em quatro telas a 390, 768 e 1440 px, sem violações ou transbordamento horizontal.
- O MCP OmniRoute recebeu **3 tarefas** no perfil `free-only`. Gemini `gemini-3.1-flash-lite` fez a pesquisa. Groq `openai/gpt-oss-120b` recebeu a revisão de QA e retornou sem texto. Groq `openai/gpt-oss-20b` propôs melhorias de implementação. O MCP registrou 688 tokens de entrada, 927 de saída e US$ 0.

## Pendências resolvidas nesta retomada

- Cancelamento validado no navegador contra API real: PostgreSQL 16 descartável embutido (`test/helpers/pg-daemon.mjs`), migração aplicada, seed sintético, backend NestJS em `127.0.0.1:3001` e Vite em modo `api` na porta 4272. Login como estudante do seed, reserva confirmada, código revelado (`Mostrar código`), cancelamento confirmado, aviso "Reserva cancelada.", rótulo "Cancelada" persistido após reload. Verificação via API: `status: CANCELED`, `pickupCode: null`, material de volta a `AVAILABLE`. Captura: `cancelamento-real-1440.png`. Ambiente descartável encerrado (Vite, backend e daemon PG terminados; cluster temporário apagado).
- Revisadas as capturas 390/768/1440: nenhum problema comprovado; nenhuma correção aplicada. Lint/typecheck, build, 32 unitários e 33 Playwright (Chrome) reexecutados e verdes.

## Pendências que permanecem

- A validação manual com leitor de tela segue pendente.
- Commits, publicação da branch, PR e verificação dos checks do GitHub — em andamento nesta sessão.
